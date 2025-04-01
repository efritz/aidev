import chalk from 'chalk'
import { CommandDescription } from '../command'
import { commands } from '../commands'
import { ChatContext } from '../context'

export const helpCommand: CommandDescription = {
    prefix: ':help',
    description: 'Show this message',
    handler: handleHelp,
}

async function handleHelp(_context: ChatContext, args: string) {
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
