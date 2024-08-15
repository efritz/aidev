import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const renameCommand: CommandDescription = {
    prefix: ':rename',
    description: 'Rename a branch in the conversation history.',
    expectsArgs: true,
    handler: handleRename,
    complete: completeRename,
}

async function handleRename(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 2) {
        console.log(chalk.red.bold('Expected exactly two names for :rename (old and new).'))
        console.log()
        return
    }
    const [oldName, newName] = parts

    if (!context.provider.conversationManager.branches().includes(oldName)) {
        console.log(chalk.red.bold(`Branch "${oldName}" does not exist.`))
        console.log()
        return
    }

    if (context.provider.conversationManager.branches().includes(newName)) {
        console.log(chalk.red.bold(`Branch "${newName}" already exists.`))
        console.log()
        return
    }

    if (!context.provider.conversationManager.renameBranch(oldName, newName)) {
        console.log(chalk.red.bold(`Failed to rename branch "${oldName}" to "${newName}".`))
        console.log()
        return
    }

    console.log(`${chalk.dim('𐌖')} Renamed branch "${oldName}" to "${newName}".`)
    console.log()
}

function completeRename(context: ChatContext, args: string): [string[], string] {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length === 0) {
        return [context.provider.conversationManager.branches(), args]
    }
    return [[], args]
}
