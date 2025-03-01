import chalk from 'chalk'
import { executeCommand, formatShellResult, serializeOutput, ShellResult } from '../../util/shell/exec'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const shellCommand: CommandDescription = {
    prefix: ':shell',
    description: 'Execute a shell command and record it in the conversation',
    expectsArgs: true,
    handler: handleShell,
}

async function handleShell(context: ChatContext, command: string): Promise<void> {
    const result = await executeCommand(context, command)

    context.provider.conversationManager.pushUser({
        type: 'text',
        content: serializeCommand({ command, ...result }),
        replayContent: serializeReplay({ command, ...result }),
    })
}

function serializeCommand({
    command,
    result,
    error,
    canceled,
}: {
    command: string
    result?: ShellResult
    error?: Error
    canceled?: boolean
}): string {
    const payload = JSON.stringify({
        error,
        canceled,
        command,
        outut: serializeOutput(result?.output),
    })

    return `I ran a command in the shell.\n\n${payload}\n\n`
}

function serializeReplay({
    command,
    result,
    error,
    canceled,
}: {
    command: string
    result?: ShellResult
    error?: Error
    canceled?: boolean
}): string {
    return `$ :shell ${chalk.red(command)}\n${formatShellResult({ result, error, canceled }).trim()}`
}
