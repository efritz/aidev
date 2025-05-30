import { writeFile as _writeFile, mkdir } from 'fs/promises'
import { dirname, relative, resolve } from 'path'
import chalk from 'chalk'
import { diffLines } from 'diff'
import { ContextStateManager } from '../../context/state'
import { ChatProvider } from '../../providers/chat_provider'
import { CancelError, InterruptHandler } from '../../util/interrupts/interrupts'
import { withContentEditor, withDiffEditor } from '../../util/vscode/edit'
import { Prompter } from '../prompter/prompter'

export type WriteResult = {
    stashed?: boolean
    originalContents: string
    userEditedContents?: string
    canceled?: boolean
}

let allowWorkspaceWrites = false

function isPathInWorkspace(path: string): boolean {
    return !relative(process.cwd(), resolve(path)).startsWith('..')
}

export async function executeWriteFile({
    provider,
    prompter,
    interruptHandler,
    contextStateManager,
    path,
    contents,
    originalContents,
    fromStash = false,
    yolo = false,
}: {
    provider: ChatProvider
    prompter: Prompter
    interruptHandler: InterruptHandler
    contextStateManager: ContextStateManager
    path: string
    contents: string
    originalContents: string
    fromStash?: boolean
    yolo?: boolean
}): Promise<WriteResult> {
    console.log(formatDiff(contents, originalContents))

    const result = await confirmWrite({ prompter, interruptHandler, path, contents, originalContents, yolo })
    if (!result) {
        console.log(`${chalk.dim('ℹ')} No file was written.`)
        console.log()
        return { originalContents, canceled: true }
    }
    const { contents: editedContents, stash } = result

    if (stash) {
        provider.conversationManager.stashFile(path, editedContents, originalContents, fromStash)
    } else {
        const dir = dirname(path)
        await mkdir(dir, { recursive: true })
        await _writeFile(path, editedContents)

        if (fromStash) {
            contextStateManager.addFiles(path, {
                type: 'stash_applied',
                metaMessageId: provider.conversationManager.applyStashedFile(path, editedContents, originalContents),
            })
        }
    }

    console.log()
    replayWriteFileHeader({ path, contents: editedContents, proposedContents: contents, stashed: stash, fromStash })
    console.log()

    return {
        stashed: stash,
        originalContents,
        userEditedContents: contents !== editedContents ? editedContents : undefined,
    }
}

export function replayWriteFile({
    path,
    contents,
    proposedContents,
    originalContents,
    stashed = false,
    fromStash = false,
    error = undefined,
    canceled = false,
}: {
    path: string
    contents: string
    proposedContents: string
    originalContents: string
    stashed?: boolean
    fromStash?: boolean
    error?: Error
    canceled?: boolean
}) {
    replayWriteFileHeader({ path, contents, proposedContents, stashed, fromStash, canceled })

    console.log()
    console.log(formatDiff(contents, originalContents))

    if (canceled) {
        console.log()
        console.log(`${chalk.dim('ℹ')} No file was written.`)
        console.log()
    }
    if (error) {
        console.log()
        console.log(chalk.bold.red(error))
        console.log()
    }
}

function replayWriteFileHeader({
    path,
    contents,
    proposedContents,
    stashed,
    fromStash = false,
    canceled = false,
}: {
    path: string
    contents: string
    proposedContents: string
    stashed: boolean
    fromStash?: boolean
    canceled?: boolean
}) {
    const action = canceled ? 'Proposed changes to' : stashed ? 'Stashed' : fromStash ? 'Applied stashed' : 'Wrote'
    const edited = contents !== proposedContents

    console.log(`${chalk.dim('ℹ')} ${action} file "${chalk.red(path)}"${edited ? ' (contents edited by user)' : ''}`)
}

async function confirmWrite({
    prompter,
    interruptHandler,
    path,
    contents,
    originalContents,
    yolo = false,
}: {
    prompter: Prompter
    interruptHandler: InterruptHandler
    path: string
    contents: string
    originalContents: string
    yolo?: boolean
}): Promise<{ contents: string; stash: boolean } | undefined> {
    if (yolo) {
        return { contents, stash: false }
    }

    if (allowWorkspaceWrites && isPathInWorkspace(path)) {
        console.log(`${chalk.dim('ℹ')} File write automatically approved (based on previous "always" selection)`)
        return { contents, stash: false }
    }

    while (true) {
        const choices = [
            { name: 'y', description: 'write file to disk' },
            { name: 'n', description: 'skip write and continue conversation', isDefault: true },
            originalContents === ''
                ? { name: 'e', description: 'edit file contents in vscode' }
                : { name: 'd', description: 'edit file contents in vscode (diff mode)' },
            { name: 's', description: 'stash file contents' },
        ]

        if (isPathInWorkspace(path)) {
            choices.push({ name: 'a', description: 'always allow writes to workspace files for this session' })
        }

        const choice = await prompter.choice(`Write contents to "${path}"`, choices)

        try {
            switch (choice) {
                case 'y':
                    return { contents, stash: false }
                case 'n':
                    return undefined
                case 's':
                    return { contents, stash: true }
                case 'a':
                    if (isPathInWorkspace(path)) {
                        allowWorkspaceWrites = true
                        console.log(`${chalk.green('✓')} File path added to allow list for this session`)
                        return { contents, stash: false }
                    }
                    break

                case 'd': {
                    const newContents = await withDiffEditor(interruptHandler, path, contents)
                    if (newContents !== contents) {
                        contents = newContents
                        displayDiff(contents, originalContents)
                    }
                    break
                }

                case 'e': {
                    const newContents = await withContentEditor(interruptHandler, contents, path)
                    if (newContents !== contents) {
                        contents = newContents
                        displayDiff(contents, originalContents)
                    }
                    break
                }
            }
        } catch (error: any) {
            if (!(error instanceof CancelError)) {
                throw error
            }
        }
    }
}

function displayDiff(contents: string, originalContents: string) {
    console.log()
    console.log(`${chalk.dim('ℹ')} File contents edited:`)
    console.log()
    console.log(formatDiff(contents, originalContents))
}

const contextSize = 5

function formatDiff(contents: string, originalContents: string): string {
    const changes = diffLines(originalContents, contents).flatMap(
        (change): { lines: string[]; added?: boolean; removed?: boolean; header?: boolean }[] => {
            const lines = trimFinalNewline(change.value).split('\n')

            if (change.added || change.removed || lines.length <= 2 * contextSize) {
                return [{ lines, added: change.added, removed: change.removed }]
            }

            return [
                { lines: lines.slice(0, contextSize) },
                { lines: ['', '@@ ... @@', ''], header: true },
                { lines: lines.slice(-contextSize) },
            ]
        },
    )

    // Remove leading context
    if (changes.length >= 2 && changes[1].header) {
        changes.splice(0, 2)
    }

    // Remove trailing context
    if (changes.length >= 2 && changes[changes.length - 2].header) {
        changes.splice(-2)
    }

    return changes
        .flatMap(change => {
            if (change.header) {
                return change.lines.map(line => chalk.magenta(line))
            } else if (change.added) {
                return change.lines.map(line => chalk.green(`+ ${line}`))
            } else if (change.removed) {
                return change.lines.map(line => chalk.red(`- ${line}`))
            } else {
                return change.lines.map(line => chalk.grey(`  ${line}`))
            }
        })
        .join('\n')
        .trim()
}

function trimFinalNewline(line: string): string {
    return line.endsWith('\n') ? line.slice(0, -1) : line
}
