import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'
import { replayMessages } from '../history'

export const redoCommand: CommandDescription = {
    prefix: ':redo',
    description: 'Redo the last undone action in the conversation',
    handler: handleRedo,
}

async function handleRedo(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :redo.'))
        console.log()
        return
    }

    if (!context.provider.conversationManager.redo()) {
        console.log(chalk.red('Nothing to redo.'))
        console.log()
        return
    }

    console.clear()
    replayMessages(context)
    console.log(chalk.yellow('Redid last undone action.'))
    console.log()
}
