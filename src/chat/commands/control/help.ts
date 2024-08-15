import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'
import { commands } from '../commands'

export const helpCommand: CommandDescription = {
    prefix: ':help',
    description: 'Show this message',
    handler: handleHelp,
}

async function handleHelp(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :help.'))
        console.log()
        return
    }

    const maxWidth = commands.reduce((max, { prefix }) => Math.max(max, prefix.length), 0)

    console.log()
    for (const { prefix, description } of commands) {
        console.log(`${prefix.padEnd(maxWidth)} - ${description}`)
    }
    console.log()
}
