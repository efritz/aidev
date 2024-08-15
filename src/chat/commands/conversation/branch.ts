import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const branchCommand: CommandDescription = {
    prefix: ':branch',
    description: 'Create a new branch in the conversation history.',
    expectsArgs: true,
    handler: handleBranch,
}

async function handleBranch(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :branch.'))
        console.log()
        return
    }
    const name = parts[0]

    if (!context.provider.conversationManager.branch(name)) {
        console.log(chalk.red.bold(`Branch "${name}" already exists.`))
        console.log()
        return
    }

    console.log(`${chalk.dim('𐌖')} Created branch "${name}".`)
    console.log()
}
