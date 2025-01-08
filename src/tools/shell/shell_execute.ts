import chalk from 'chalk'
import { CancelError } from '../../util/interrupts/interrupts'
import {
    ShellResult as BaseShellResult,
    executeCommand,
    formatCommand,
    formatShellResult,
    serializeOutput,
} from '../../util/shell/exec'
import { withContentEditor } from '../../util/vscode/edit'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type OutputLine = {
    type: 'stdout' | 'stderr'
    content: string
}

type ShellResult = BaseShellResult & {
    userEditedCommand?: string
}

export const shellExecute: Tool<ShellResult> = {
    name: 'shell_execute',
    description: 'Execute a zsh command.',
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            command: {
                type: JSONSchemaDataType.String,
                description: 'The zsh command to execute.',
            },
        },
        required: ['command'],
    },
    replay: (args: Arguments, { result, error, canceled }: ToolResult<ShellResult>) => {
        const { command: originalCommand } = args as { command: string }

        const command = result && result.userEditedCommand ? result.userEditedCommand : originalCommand
        const verb = canceled ? 'Proposed' : 'Executed'
        const edited = command !== originalCommand

        console.log(`${chalk.dim('ℹ')} ${verb} shell command${edited ? ' (edited by user)' : ''}:`)
        console.log()
        console.log(formatCommand(command))
        console.log(formatShellResult({ result, error, canceled }))
    },
    execute: async (
        context: ExecutionContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<ShellResult>> => {
        const { command } = args as { command: string }
        console.log(formatCommand(command))

        const editedCommand = await confirmCommand(context, command)
        if (!editedCommand) {
            console.log(chalk.red('✖') + ' Command canceled.\n')
            return { canceled: true, reprompt: false }
        }

        const { result: baseResult, error, canceled } = await executeCommand(context, editedCommand)

        const userEditedCommand = editedCommand !== command ? editedCommand : undefined
        const output = baseResult?.output ?? []
        const result = { userEditedCommand, output }
        const reprompt = canceled === true ? false : undefined

        return { result, error, canceled, reprompt }
    },
    serialize: ({ result, error, canceled }: ToolResult<ShellResult>) =>
        JSON.stringify({
            error,
            canceled,
            userEditedCommand: result?.userEditedCommand ?? false,
            output: serializeOutput(result?.output),
        }),
}

async function confirmCommand(context: ExecutionContext, command: string): Promise<string | undefined> {
    while (true) {
        const choice = await context.prompter.choice('Execute this command', [
            { name: 'y', description: 'execute the command as-is' },
            { name: 'n', description: 'skip execution and continue conversation', isDefault: true },
            { name: 'e', description: 'edit this command in vscode' },
        ])

        switch (choice) {
            case 'y':
                return command
            case 'n':
                return undefined

            case 'e':
                try {
                    command = await withContentEditor(context.interruptHandler, command)

                    console.log()
                    console.log(`${chalk.dim('ℹ')} Command edited:`)
                    console.log()
                    console.log(`${formatCommand(command)}`)
                } catch (error: any) {
                    if (!(error instanceof CancelError)) {
                        throw error
                    }

                    console.log('User canceled edit')
                }

                break
        }
    }
}

function formatOutput(output?: OutputLine[]): string {
    const lines = (output || []).map(o => ({ ...o }))

    while (lines.length) {
        const n = lines.length
        const trimmed = lines[n - 1].content.trimEnd()
        lines[n - 1].content = trimmed
        if (trimmed) {
            break
        }

        lines.pop()
    }

    return lines.map(({ content, type }) => (type === 'stdout' ? chalk.cyanBright.bold : chalk.red)(content)).join('')
}
