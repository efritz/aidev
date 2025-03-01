import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'
import { replayMessages } from '../history'

export const undoCommand: CommandDescription = {
    prefix: ':undo',
    description: 'Undo the last action in the conversation',
    handler: handleUndo,
}

async function handleUndo(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :undo.'))
        console.log()
        return
    }

    if (!context.provider.conversationManager.undo()) {
        console.log(chalk.red('Nothing to undo.'))
        console.log()
        return
    }

    console.clear()
    replayMessages(context)
    console.log(chalk.yellow('Undid last action.'))
    console.log()
}
