import { writeFile as _writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import chalk from 'chalk'
import { diffLines } from 'diff'
import { Provider } from '../../providers/provider'
import { withTempFileContents } from '../../util/fs/temp'
import { CancelError, InterruptHandler } from '../../util/interrupts/interrupts'
import { withContentEditor, withDiffEditor } from '../../util/vscode/edit'
import { Prompter } from '../prompter/prompter'

export type WriteResult = {
    stashed?: boolean
    originalContents: string
    userEditedContents?: string
    canceled?: boolean
}

export async function executeWriteFile({
    provider,
    prompter,
    interruptHandler,
    path,
    contents,
    originalContents,
    fromStash = false,
}: {
    provider: Provider
    prompter: Prompter
    interruptHandler: InterruptHandler
    path: string
    contents: string
    originalContents: string
    fromStash?: boolean
}): Promise<WriteResult> {
    console.log(formatDiff(contents, originalContents))

    const result = await confirmWrite({ prompter, interruptHandler, path, contents, originalContents })
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
            provider.conversationManager.applyStashedFile(path, editedContents, originalContents)
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
}: {
    prompter: Prompter
    interruptHandler: InterruptHandler
    path: string
    contents: string
    originalContents: string
}): Promise<{ contents: string; stash: boolean } | undefined> {
    while (true) {
        const choice = await prompter.choice(`Write contents to "${path}"`, [
            { name: 'y', description: 'write file to disk' },
            { name: 'n', description: 'skip write and continue conversation', isDefault: true },
            originalContents === ''
                ? { name: 'e', description: 'edit file contents in vscode' }
                : { name: 'd', description: 'edit file contents in vscode (diff mode)' },
            { name: 's', description: 'stash file contents' },
        ])

        try {
            switch (choice) {
                case 'y':
                    return { contents, stash: false }
                case 'n':
                    return undefined
                case 's':
                    return { contents, stash: true }

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
