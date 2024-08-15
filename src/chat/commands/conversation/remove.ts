import chalk from 'chalk'
import { ChatContext } from '../../context'
import { replayMessages } from '../../history'
import { CommandDescription } from '../command'

export const removeCommand: CommandDescription = {
    prefix: ':remove',
    description: 'Remove a branch from the conversation history.',
    expectsArgs: true,
    handler: handleRemove,
    complete: completeRemove,
}

async function handleRemove(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :remove.'))
        console.log()
        return
    }
    const name = parts[0]

    if (name === 'main') {
        console.log(chalk.red.bold('Cannot remove the main branch.'))
        console.log()
        return
    }

    const { success, prunedBranches } = context.provider.conversationManager.removeBranch(name)
    if (!success) {
        console.log(chalk.red.bold(`Branch "${name}" does not exist.`))
        console.log()
        return
    }

    console.clear()
    replayMessages(context.provider.conversationManager.visibleMessages())

    if (prunedBranches.length > 0) {
        console.log(chalk.yellow(`${chalk.dim('𐌖')} Pruned branches "${prunedBranches.join(', ')}".`))
        console.log()
    }
}

function completeRemove(context: ChatContext, args: string): [string[], string] {
    const branches = context.provider.conversationManager.branches()
    return [branches.filter(name => name !== 'main' && name.startsWith(args)), args]
}
