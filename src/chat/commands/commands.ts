import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from '../context'
import { CommandDescription } from './command'
import { loadCommand } from './context/load'
import { exitCommand } from './control/exit'
import { helpCommand } from './control/help'
import { branchCommand } from './conversation/branch'
import { clearCommand } from './conversation/clear'
import { redoCommand } from './conversation/redo'
import { removeCommand } from './conversation/remove'
import { renameCommand } from './conversation/rename'
import { rollbackCommand } from './conversation/rollback'
import { saveCommand } from './conversation/save'
import { savepointCommand } from './conversation/savepoint'
import { statusCommand } from './conversation/status'
import { switchCommand } from './conversation/switch'
import { undoCommand } from './conversation/undo'

export const commands: CommandDescription[] = [
    helpCommand,
    exitCommand,
    saveCommand,
    loadCommand,
    clearCommand,
    savepointCommand,
    rollbackCommand,
    undoCommand,
    redoCommand,
    statusCommand,
    branchCommand,
    switchCommand,
    renameCommand,
    removeCommand,
]

export async function handleCommand(context: ChatContext, message: string): Promise<void> {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ').trim()

    for (const { prefix, handler } of commands) {
        if (command === prefix) {
            await handler(context, args)
            return
        }
    }

    console.log(chalk.red.bold(`Unknown command`))
    console.log()
}

export function completeCommand(context: ChatContext, message: string): CompleterResult | undefined {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ').trim()

    if (!command.startsWith(':')) {
        return undefined
    }

    for (const { prefix, complete } of commands) {
        if (complete && command === prefix) {
            return complete(context, args)
        }
    }

    return undefined
}
