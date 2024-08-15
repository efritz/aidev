import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from './../command'

export const savepointCommand: CommandDescription = {
    prefix: ':savepoint',
    description: 'Register a savepoint in the conversation history.',
    expectsArgs: true,
    handler: handleSavepoint,
}

async function handleSavepoint(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :savepoint.'))
        console.log()
        return
    }
    const name = parts[0]

    if (!context.provider.conversationManager.addSavepoint(name)) {
        console.log(chalk.red.bold(`Savepoint "${name}" already exists.`))
        console.log()
        return
    }

    console.log(`${chalk.dim('📌')} Savepoint "${name}" registered.`)
    console.log()
}
