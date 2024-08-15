import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import chalk from 'chalk'
import * as diffLib from 'diff'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const writeFile: Tool = {
    name: 'write_file',
    description: 'Write file content to disk, creating intermediate directories if necessary.',
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
    replay: (args: Arguments, result: ToolResult) => {
        const { path, contents } = args as { path: string; contents: string }

        console.log(`${chalk.dim('ℹ')} Wrote file "${chalk.red(path)}":`)
        console.log()
        console.log(formatContent(contents))
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }

        console.log(formatContent(contents))

        if (await confirmWrite(context, path, contents)) {
            const dir = dirname(path)
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true })
            }

            writeFileSync(path, contents)
            console.log(`${chalk.dim('ℹ')} Wrote file.`)
            return { result: { userCanceled: false } }
        } else {
            console.log(chalk.dim('ℹ') + ' No file was written.\n')
            return { result: { userCanceled: true } }
        }
    },
    serialize: (result?: any) => JSON.stringify(result as { userCanceled: Boolean }),
}

async function confirmWrite(context: ExecutionContext, path: string, contents: string): Promise<boolean> {
    while (true) {
        const choice = await context.prompter.choice(`Write contents to "${path}"`, [
            { name: 'y', description: 'write file to disk' },
            { name: 'n', description: 'skip write and continue conversation', isDefault: true },
            { name: 'd', description: 'show file diff' },
        ])

        switch (choice) {
            case 'y':
                return true
            case 'n':
                return false

            case 'd':
                await showDiff(context, path, contents)
                break
        }
    }
}

function formatContent(contents: string): string {
    return contents
        .split('\n')
        .map(line => `> ${chalk.red(line)}`)
        .join('\n')
}

async function showDiff(context: ExecutionContext, path: string, newContents: string) {
    if (!existsSync(path)) {
        console.log(chalk.yellow(`File ${path} does not exist. Creating a new file.`))
        console.log(chalk.green('New file contents:'))
        console.log(newContents)
        return
    }

    const oldContents = readFileSync(path, 'utf8')

    console.log(chalk.cyan(`Diff for ${path}:`))
    await displayDiffBlocks(context, createDiffBlocks(oldContents, newContents))
}

function createDiffBlocks(oldContents: string, newContents: string): string[] {
    const diff = diffLib.diffLines(oldContents, newContents)
    const blocks: string[] = []
    let currentBlock: string[] = []
    let unchangedLines = 0
    const contextLines = 3

    diff.forEach((part, index) => {
        const lines = part.value.trim().split('\n')

        if (part.added || part.removed) {
            if (unchangedLines > 0) {
                currentBlock.push(
                    ...formatUnchangedLines(diff[index - 1].value.trim().split('\n').slice(-contextLines)),
                )
            }
            unchangedLines = 0

            lines.forEach(line => {
                if (part.added) {
                    currentBlock.push(chalk.green(`+ ${line}`))
                } else {
                    currentBlock.push(chalk.red(`- ${line}`))
                }
            })
        } else {
            unchangedLines += lines.length
            if (unchangedLines > contextLines * 2) {
                if (currentBlock.length > 0) {
                    currentBlock.push(...formatUnchangedLines(lines.slice(0, contextLines)))
                    blocks.push(currentBlock.join('\n'))
                    currentBlock = []
                }
            } else {
                currentBlock.push(...formatUnchangedLines(lines))
            }
        }
    })

    if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'))
    }

    return blocks
}

function formatUnchangedLines(lines: string[]): string[] {
    return lines.map(line => chalk.gray(`  ${line}`))
}

async function displayDiffBlocks(context: ExecutionContext, blocks: string[]) {
    let current = 0
    while (current < blocks.length) {
        console.log(blocks[current])
        console.log(chalk.yellow(`\nBlock ${current + 1} of ${blocks.length}`))

        const hasPrev = current > 0
        const hasNext = current < blocks.length - 1

        const choice = await context.prompter.choice('Diff navigation', [
            ...(hasNext ? [{ name: 'n', description: 'Next block', isDefault: true }] : []),
            ...(hasPrev ? [{ name: 'p', description: 'Previous block' }] : []),
            ...[{ name: 'q', description: 'Quit', isDefault: !hasNext }],
        ])

        switch (choice) {
            case 'q':
                return

            case 'n':
                current++
                break

            case 'p':
                current--
                break
        }
    }
}
