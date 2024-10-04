import { spawn } from 'child_process'
import chalk from 'chalk'
import treeKill from 'tree-kill'
import { CancelError } from '../../util/interrupts/interrupts'
import { prefixFormatter, Updater, withProgress } from '../../util/progress/progress'
import { withContentEditor } from '../../util/vscode/edit'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type OutputLine = {
    type: 'stdout' | 'stderr'
    content: string
}

type ShellResult = {
    userEditedCommand?: string
    output: OutputLine[]
}

export const shellExecute: Tool = {
    name: 'shell_execute',
    description: 'Execute a zsh command.',
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            command: {
                type: JSONSchemaDataType.String,
                description: 'The zsh command to execute.',
            },
        },
        required: ['command'],
    },
    replay: (args: Arguments, { result, error, canceled }: ToolResult) => {
        const { command: originalCommand } = args as { command: string }

        if (canceled) {
            console.log(formatCommand(originalCommand))
            console.log()
            console.log(chalk.dim('ℹ') + ' No code was executed.')
            return
        }

        const shellResult = result as ShellResult | undefined
        if (!shellResult) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
            return
        }

        const command = shellResult.userEditedCommand ?? originalCommand

        console.log(
            `${chalk.dim('ℹ')} Executed shell command${command !== originalCommand ? ' (edited by user)' : ''}:`,
        )
        console.log()
        console.log(formatCommand(command))
        console.log(`${error ? chalk.red('✖') : chalk.green('✔')} Command ${error ? 'failed' : 'succeeded'}.`)
        console.log()
        console.log(formatOutput(result.output))

        if (error) {
            console.log()
            console.log(chalk.bold.red(error))
        }
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { command } = args as { command: string }
        console.log(formatCommand(command))

        const editedCommand = await confirmCommand(context, command)
        if (!editedCommand) {
            console.log(chalk.dim('ℹ') + ' No code was executed.\n')
            return { canceled: true }
        }

        const response = await withProgress<OutputLine[]>(update => runCommand(context, editedCommand, update), {
            progress: prefixFormatter('Executing command...', formatOutput),
            success: prefixFormatter('Command succeeded.', formatOutput),
            failure: prefixFormatter('Command failed.', formatOutput),
        })

        const userEditedCommand = editedCommand !== command ? editedCommand : undefined

        if (!response.ok) {
            console.log(chalk.bold.red(response.error))
            console.log()

            return { result: { userEditedCommand, output: response.snapshot ?? [] }, error: response.error }
        } else {
            return { result: { userEditedCommand, output: response.response } }
        }
    },
    serialize: ({ result, canceled }: ToolResult) => {
        if (canceled) {
            return JSON.stringify({ canceled: true })
        }

        const shellResult = result as ShellResult
        return JSON.stringify({
            userEditedCommand: shellResult.userEditedCommand,
            output: serializeOutput(shellResult.output),
        })
    },
}

function serializeOutput(output?: OutputLine[]): string {
    return (output || []).map(o => o.content).join('')
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

async function runCommand(
    context: ExecutionContext,
    command: string,
    update: Updater<OutputLine[]>,
): Promise<OutputLine[]> {
    return await context.interruptHandler.withInterruptHandler(signal => {
        return new Promise((resolve, reject) => {
            const output: OutputLine[] = []
            const aggregate = (type: 'stdout' | 'stderr', s: string) => {
                if (!signal.aborted) {
                    output.push({ content: s, type })
                    update(output)
                }
            }

            const cmd = spawn('zsh', ['-c', command])
            cmd.stdout.on('data', data => aggregate('stdout', data.toString()))
            cmd.stderr.on('data', data => aggregate('stderr', data.toString()))

            signal.addEventListener('abort', () => treeKill(cmd.pid!, 'SIGKILL'))

            cmd.on('exit', exitCode => {
                if (exitCode === 0 && !signal.aborted) {
                    resolve(output)
                } else {
                    reject(new Error(`exit code ${exitCode}`))
                }
            })
        })
    })
}

function formatCommand(command: string): string {
    return command
        .split('\n')
        .map(line => `> ${chalk.red(line)}`)
        .join('\n')
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
