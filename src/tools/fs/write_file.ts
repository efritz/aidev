import { writeFile as _writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import chalk from 'chalk'
import { diffLines } from 'diff'
import { safeReadFile } from '../../util/fs/safe'
import { CancelError } from '../../util/interrupts/interrupts'
import { withContentEditor, withDiffEditor } from '../../util/vscode/edit'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export type WriteResult = { userCanceled: true } | { stashed: boolean; userEditedContents?: string }

export const writeFile: Tool = {
    name: 'write_file',
    description: [
        'Write file contents to disk, creating intermediate directories if necessary.',
        'The user may choose to modify the file content before writing it to disk. The tool result will include the user-supplied content, if any.',
        'If the conversation context already contains the target path, the conversation will be updated to include the new contents.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            path: {
                type: JSONSchemaDataType.String,
                description: 'The target path.',
            },
            contents: {
                type: JSONSchemaDataType.String,
                description: 'The contents of the file.',
            },
        },
        required: ['path', 'contents'],
    },
    replay: (args: Arguments, { result, error }: ToolResult) => {
        const writeResult = result as WriteResult
        if ('userCanceled' in writeResult) {
            console.log(chalk.dim('ℹ') + ' No file was written.')
            return
        }

        const { path, contents: originalContents } = args as { path: string; contents: string }
        const contents = writeResult.userEditedContents ?? originalContents
        replayWriteFile(path, contents, originalContents, writeResult.stashed, error)
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }
        const result = await executeWriteFile(context, path, contents)
        return { result }
    },
    serialize: (result?: any) => (result ? JSON.stringify(result as WriteResult) : ''),
}

export function replayWriteFile(
    path: string,
    contents: string,
    originalContents: string,
    stashed: boolean,
    error?: Error,
) {
    const verb = stashed ? 'Stashed' : 'Wrote'
    const edited = contents !== originalContents

    console.log(`${chalk.dim('ℹ')} ${verb} file "${chalk.red(path)}"${edited ? ' (contents edited by user)' : ''}:`)
    console.log()
    console.log(formatDiff(contents, originalContents))

    if (error) {
        console.log()
        console.log(chalk.bold.red(error))
    }
}

export async function executeWriteFile(
    context: ExecutionContext,
    path: string,
    contents: string,
): Promise<WriteResult> {
    const originalContents = await safeReadFile(path)
    console.log(formatDiff(contents, originalContents))

    const result = await confirmWrite(context, path, contents, originalContents)
    if (!result) {
        console.log(chalk.dim('ℹ') + ' No file was written.\n')
        return { userCanceled: true }
    }
    const { contents: editedContents, stash } = result

    if (stash) {
        context.contextStateManager.stashFile(path, originalContents)
        console.log(`${chalk.dim('ℹ')} Stashed file.`)
    } else {
        const dir = dirname(path)
        await mkdir(dir, { recursive: true })
        await _writeFile(path, editedContents)
        console.log(`${chalk.dim('ℹ')} Wrote file.`)
    }

    return {
        stashed: stash,
        userEditedContents: contents !== editedContents ? editedContents : undefined,
    }
}

async function confirmWrite(
    context: ExecutionContext,
    path: string,
    contents: string,
    originalContents: string,
): Promise<{ contents: string; stash: boolean } | undefined> {
    while (true) {
        const choice = await context.prompter.choice(`Write contents to "${path}"`, [
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
                    const newContents = await withDiffEditor(context.interruptHandler, path, contents)
                    if (newContents !== contents) {
                        contents = newContents
                        displayDiff(contents, originalContents)
                    }
                    break
                }

                case 'e': {
                    const newContents = await withContentEditor(context.interruptHandler, contents)
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
