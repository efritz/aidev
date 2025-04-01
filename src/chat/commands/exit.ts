import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const exitCommand: CommandDescription = {
    prefix: ':exit',
    description: 'Exit the chat',
    handler: handleExit,
}

export class ExitError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ExitError'
    }
}

async function handleExit(_context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :exit.'))
        console.log()
        return
    }

    console.log('Goodbye!\n')
    throw new ExitError('User exited.')
}
