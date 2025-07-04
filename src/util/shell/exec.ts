import { spawn } from 'child_process'
import chalk from 'chalk'
import treeKill from 'tree-kill'
import { ChatContext } from '../../chat/context'
import { CancelError } from '../interrupts/interrupts'
import { prefixFormatter, Updater, withProgress } from '../progress/progress'

export type ShellResult = {
    userEditedCommand?: string
    output: OutputLine[]
}

export type OutputLine = {
    type: 'stdout' | 'stderr'
    content: string
}

export type ExecContext = Pick<ChatContext, 'interruptHandler' | 'preferences' | 'contextStateManager' | 'container'>

export async function executeCommand(
    context: ExecContext,
    command: string,
    signal?: AbortSignal, // TODO - check callers
): Promise<{ result?: ShellResult; error?: Error; canceled?: boolean }> {
    const response = await withProgress<OutputLine[]>(update => runCommand(context, command, update, signal), {
        progress: prefixFormatter('Executing command...', formatOutput),
        success: prefixFormatter('Command succeeded.', formatOutput),
        failure: prefixFormatter('Command failed.', formatOutput),
    })

    // Since we could have arbitrarily changed the filesystem, we issue an update to
    // all file contents and directory listings to be available before the next time
    // we construct a context message.

    context.contextStateManager.updateAllFiles()
    context.contextStateManager.updateAllDirectories()

    if (!response.ok) {
        return {
            result: { output: response.snapshot ?? [] },
            error: response.error,
            canceled: response.error instanceof CancelError ? true : undefined,
        }
    } else {
        return { result: { output: response.response } }
    }
}

async function runCommand(
    context: ExecContext,
    command: string,
    update: Updater<OutputLine[]> = () => {},
    signal?: AbortSignal,
): Promise<OutputLine[]> {
    const containerId = context.container?.containerId
    if (containerId) {
        command = `docker exec ${containerId} sh -c ${command}`
    }

    return execOnHost(context, command, update, signal)
}

export async function execOnHost(
    context: ExecContext,
    command: string,
    update: Updater<OutputLine[]> = () => {},
    _signal?: AbortSignal, // TODO - use
): Promise<OutputLine[]> {
    return context.interruptHandler.withInterruptHandler(signal => {
        return new Promise((resolve, reject) => {
            const output: OutputLine[] = []
            const aggregate = (type: 'stdout' | 'stderr', s: string) => {
                if (!signal.aborted) {
                    output.push({ content: s, type })
                    update(output)
                }
            }
            const shellCommand = context.preferences.shellCommand ?? 'zsh'
            const cmd = spawn(shellCommand, ['-c', command])
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

export function formatShellResult({
    result,
    error,
    canceled,
}: {
    result?: ShellResult
    error?: Error
    canceled?: boolean
}): string {
    let serialized = ''
    serialized += `${canceled || error ? chalk.red('✖') : chalk.green('✔')} Command ${canceled ? 'canceled' : error ? 'failed' : 'succeeded'}.`
    serialized += '\n'

    if (result && result.output.length > 0) {
        serialized += '\n'
        serialized += formatOutput(result.output)
        serialized += '\n'
    }

    if (error) {
        serialized += '\n'
        serialized += chalk.bold.red(error)
        serialized += '\n'
    }

    return serialized
}

export function formatCommand(command: string): string {
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

export function serializeOutput(output?: OutputLine[]): string {
    return (output || []).map(o => o.content).join('')
}
