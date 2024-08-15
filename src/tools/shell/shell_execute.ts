import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { readFileSync, unlinkSync, writeFileSync } from 'fs'
import chalk from 'chalk'
import chokidar from 'chokidar'
import treeKill from 'tree-kill'
import { $ } from 'zx'
import { CancelError } from '../../util/interrupts/interrupts'
import { prefixFormatter, Updater, withProgress } from '../../util/progress/progress'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type OutputLine = {
    type: 'stdout' | 'stderr'
    content: string
}

type ShellResult =
    | { userCanceled: true }
    | {
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
    replay: (args: Arguments, { result, error }: ToolResult) => {
        const shellResult = result as ShellResult
        if ('userCanceled' in shellResult) {
            console.log(chalk.dim('ℹ') + ' No code was executed.')
            return
        }

        const { command: originalCommand } = args as { command: string }
        const command = shellResult.userEditedCommand ?? originalCommand

        console.log(`${chalk.dim('ℹ')} Executed ${command !== originalCommand ? '(edited) ' : ''}shell command:`)
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
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { command } = args as { command: string }

        console.log(formatCommand(command))

        const editedCommand = await confirmCommand(context, command)
        if (!editedCommand) {
            console.log(chalk.dim('ℹ') + ' No code was executed.\n')
            return { result: { userCanceled: true } }
        }

        const edit: { userEditedCommand?: string } = {}
        if (editedCommand !== command) {
            console.log()
            console.log(`${chalk.dim('ℹ')} Command edited:`)
            console.log()
            console.log(`${formatCommand(command)}`)

            edit.userEditedCommand = editedCommand
        }

        const response = await withProgress<OutputLine[]>(update => runCommand(context, editedCommand, update), {
            progress: prefixFormatter('Executing command...', formatOutput),
            success: prefixFormatter('Command succeeded.', formatOutput),
            failure: prefixFormatter('Command failed.', formatOutput),
        })

        if (!response.ok) {
            console.log(chalk.bold.red(response.error))
            console.log()

            const result = {
                userEditedCommand: editedCommand !== command ? editedCommand : undefined,
                output: response.snapshot,
            }

            return { result, error: response.error }
        } else {
            const result = {
                userEditedCommand: editedCommand !== command ? editedCommand : undefined,
                output: response.response,
            }

            return { result }
        }
    },
    serialize: (result?: any) => {
        const shellResult = result as ShellResult
        if ('userCanceled' in shellResult) {
            return JSON.stringify(shellResult)
        }

        return JSON.stringify({
            output: shellResult.output.map(({ content }) => content).join(''),
            ...(shellResult.userEditedCommand ? { userEditedCommand: shellResult.userEditedCommand } : {}),
        })
    },
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
                    return await editCommand(context, command)
                } catch (error: any) {
                    if (error instanceof CancelError) {
                        console.log('User canceled edit')
                        continue
                    }

                    throw error
                }

                break
        }
    }
}

async function editCommand(context: ExecutionContext, command: string): Promise<string> {
    const suffix = randomBytes(16).toString('hex')
    const tempPath = `/tmp/ai-shell-command-${suffix}`
    writeFileSync(tempPath, command)

    const watcher = chokidar.watch(tempPath, {
        persistent: true,
        ignoreInitial: true,
    })

    try {
        return await context.interruptHandler.withInterruptHandler(
            () =>
                new Promise<string>((resolve, reject) => {
                    watcher.on('change', () => {
                        const newContent = readFileSync(tempPath, 'utf-8')
                        if (newContent !== command) {
                            resolve(newContent)
                        }
                    })

                    const editor = $`e ${tempPath}`
                    editor.catch(error => reject(new Error(`Failed to open editor: ${error.message}`)))
                }),
        )
    } finally {
        watcher.close()
        unlinkSync(tempPath)
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
