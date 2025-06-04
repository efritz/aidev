import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { CommandDescription } from './command'
import { branchCommand } from './commands/branch'
import { clearCommand } from './commands/clear'
import { continueCommand } from './commands/continue'
import { costCommand } from './commands/cost'
import { dumpCommand } from './commands/dump'
import { exitCommand } from './commands/exit'
import { helpCommand } from './commands/help'
import { indexCommand } from './commands/index'
import { loadCommand } from './commands/load'
import { loaddirCommand } from './commands/loaddir'
import { modelCommand } from './commands/model'
import { modelsCommand } from './commands/models'
import { promptCommand } from './commands/prompt'
import { redoCommand } from './commands/redo'
import { removeCommand } from './commands/remove'
import { renameCommand } from './commands/rename'
import { rollbackCommand } from './commands/rollback'
import { saveCommand } from './commands/save'
import { savepointCommand } from './commands/savepoint'
import { shellCommand } from './commands/shell'
import { statusCommand } from './commands/status'
import { switchCommand } from './commands/switch'
import { undoCommand } from './commands/undo'
import { unloadCommand } from './commands/unload'
import { unstashCommand } from './commands/unstash'
import { writeCommand } from './commands/write'
import { ChatContext } from './context'

export const commands: CommandDescription[] = [
    branchCommand,
    clearCommand,
    continueCommand,
    costCommand,
    dumpCommand,
    exitCommand,
    helpCommand,
    indexCommand,
    loadCommand,
    loaddirCommand,
    modelCommand,
    modelsCommand,
    promptCommand,
    redoCommand,
    removeCommand,
    renameCommand,
    rollbackCommand,
    saveCommand,
    savepointCommand,
    shellCommand,
    statusCommand,
    switchCommand,
    undoCommand,
    unloadCommand,
    unstashCommand,
    writeCommand,
]

export async function handleCommand(context: ChatContext, message: string): Promise<boolean> {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ')

    for (const { prefix, handler, continuePrompt } of commands) {
        if (command === prefix) {
            await handler(context, args)
            return continuePrompt?.(context, args) ?? false
        }
    }

    console.log(chalk.red.bold(`Unknown command`))
    console.log()
    return false
}

export async function completeCommand(context: ChatContext, message: string): Promise<CompleterResult | undefined> {
    const parts = message.split(' ')
    const command = parts[0]
    const args = parts.slice(1).join(' ')

    if (!command.startsWith(':')) {
        return undefined
    }

    for (const { prefix, expectsArgs, complete } of commands) {
        if (expectsArgs && command === prefix && prefix === message) {
            // Force insert missing space after command
            return [[command + ' '], command]
        }

        if (complete && command === prefix) {
            return complete(context, args)
        }
    }

    return undefined
}
