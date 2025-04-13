import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { ToolUse } from '../../messages/messages'
import { RuleMatcher } from '../../rules/types'
import { CancelError } from '../../util/interrupts/interrupts'
import {
    ShellResult as BaseShellResult,
    executeCommand,
    formatCommand,
    formatShellResult,
    serializeOutput,
} from '../../util/shell/exec'
import { withContentEditor } from '../../util/vscode/edit'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type ShellResult = BaseShellResult & {
    userEditedCommand?: string
}

const allowedCommands: Set<string> = new Set()

export const shellExecute: Tool<ShellResult> = {
    name: 'shell_execute',
    description: 'Execute a shell command.',
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            command: {
                type: JSONSchemaDataType.String,
                description: 'The shell command to execute.',
            },
        },
        required: ['command'],
    },
    enabled: true,
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
        context: ChatContext,
        _toolUseId: string,
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
    serialize: ({ result, error, canceled }: ToolResult<ShellResult>) => ({
        error,
        canceled,
        userEditedCommand: result?.userEditedCommand ?? false,
        output: serializeOutput(result?.output),
    }),
    ruleMatcherFactory: {
        parseMatchConfig: (config: Record<string, any>): RuleMatcher => {
            if (typeof config['command'] !== 'string') {
                throw new Error('shell_execute matcher requires regex string')
            }

            try {
                const pattern = new RegExp(config['command'])

                return {
                    condition: () => `command matches ${pattern}`,
                    matches: (tool: ToolUse): boolean => {
                        if (tool.name !== 'shell_execute') {
                            return false
                        }

                        const { command } = JSON.parse(tool.parameters) as { command: string }
                        return pattern.test(command)
                    },
                }
            } catch (error: any) {
                throw new Error(`Invalid regex pattern: ${error.message}`)
            }
        },
    },
}

async function confirmCommand(context: ChatContext, command: string): Promise<string | undefined> {
    if (allowedCommands.has(command)) {
        console.log(`${chalk.dim('ℹ')} Command automatically approved (based on previous "always" selection)`)
        return command
    }

    while (true) {
        const choice = await context.prompter.choice('Execute this command', [
            { name: 'y', description: 'execute the command as-is' },
            { name: 'n', description: 'skip execution and continue conversation', isDefault: true },
            { name: 'e', description: 'edit this command in vscode' },
            { name: 'a', description: 'always execute this command for this session' },
        ])

        switch (choice) {
            case 'y':
                return command
            case 'n':
                return undefined
            case 'a':
                allowedCommands.add(command)
                console.log(`${chalk.green('✓')} Command added to allow list for this session`)
                return command
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
