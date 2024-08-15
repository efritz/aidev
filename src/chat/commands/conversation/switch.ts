import chalk from 'chalk'
import { ChatContext } from '../../context'
import { replayMessages } from '../../history'
import { CommandDescription } from '../command'

export const switchCommand: CommandDescription = {
    prefix: ':switch',
    description: 'Switch to an existing branch in the conversation history.',
    expectsArgs: true,
    handler: handleSwitch,
    complete: completeSwitch,
}

async function handleSwitch(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :switch.'))
        console.log()
        return
    }
    const name = parts[0]

    if (!context.provider.conversationManager.switchBranch(name)) {
        console.log(chalk.red.bold(`Branch "${name}" does not exist.`))
        console.log()
        return
    }

    console.clear()
    replayMessages(context.provider.conversationManager.visibleMessages())
}

function completeSwitch(context: ChatContext, args: string): [string[], string] {
    return [context.provider.conversationManager.branches().filter(name => name.startsWith(args)), args]
}
