import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import chalk from 'chalk'
import { CancelError } from '../../util/interrupts/interrupts'
import { withDiffEditor } from '../../util/vscode/edit'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type WriteResult = { userCanceled: true } | { userEditedContents?: string }

export const writeFile: Tool = {
    name: 'write_file',
    description: [
        'Write file contents to disk, creating intermediate directories if necessary.',
        'The user may choose to modify the file content before writing it to disk.',
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

        console.log(
            `${chalk.dim('ℹ')} Wrote file "${chalk.red(path)}"${contents !== originalContents ? ' (contents edited by user)' : ''}:`,
        )
        console.log()
        console.log(formatContent(contents))

        if (error) {
            console.log()
            console.log(chalk.bold.red(error))
        }
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }

        console.log(formatContent(contents))

        const editedContents = await confirmWrite(context, path, contents)
        if (!editedContents) {
            console.log(chalk.dim('ℹ') + ' No file was written.\n')
            return { result: { userCanceled: true } }
        }

        const dir = dirname(path)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }

        writeFileSync(path, editedContents)
        console.log(`${chalk.dim('ℹ')} Wrote file.`)

        const result = {
            userEditedContents: editedContents !== contents ? editedContents : undefined,
        }

        return { result, reprompt: true }
    },
    serialize: (result?: any) => (result ? JSON.stringify(result as WriteResult) : ''),
}

async function confirmWrite(context: ExecutionContext, path: string, contents: string): Promise<string | undefined> {
    while (true) {
        const choice = await context.prompter.choice(`Write contents to "${path}"`, [
            { name: 'y', description: 'write file to disk' },
            { name: 'n', description: 'skip write and continue conversation', isDefault: true },
            { name: 'd', description: 'edit file contents in vscode' },
        ])

        switch (choice) {
            case 'y':
                return contents
            case 'n':
                return undefined

            case 'd':
                try {
                    contents = await withDiffEditor(context.interruptHandler, path, contents)

                    console.log()
                    console.log(`${chalk.dim('ℹ')} File contents edited:`)
                    console.log()
                    console.log(`${formatContent(contents)}`)
                } catch (error: any) {
                    if (!(error instanceof CancelError)) {
                        throw error
                    }
                }

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
