import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from '../context'
import { CommandDescription } from './command'
import { loadCommand } from './context/load'
import { loaddirCommand } from './context/loaddir'
import { unloadCommand } from './context/unload'
import { unstashCommand } from './context/unstash'
import { writeCommand } from './context/write'
import { exitCommand } from './control/exit'
import { helpCommand } from './control/help'
import { modelCommand } from './control/model'
import { modelsCommand } from './control/models'
import { shellCommand } from './control/shell'
import { branchCommand } from './conversation/branch'
import { clearCommand } from './conversation/clear'
import { continueCommand } from './conversation/continue'
import { dumpCommand } from './conversation/dump'
import { promptCommand } from './conversation/prompt'
import { redoCommand } from './conversation/redo'
import { removeCommand } from './conversation/remove'
import { renameCommand } from './conversation/rename'
import { rollbackCommand } from './conversation/rollback'
import { saveCommand } from './conversation/save'
import { savepointCommand } from './conversation/savepoint'
import { statusCommand } from './conversation/status'
import { switchCommand } from './conversation/switch'
import { undoCommand } from './conversation/undo'
import { indexCommand } from './embeddings'

export const commands: CommandDescription[] = [
    branchCommand,
    clearCommand,
    continueCommand,
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
