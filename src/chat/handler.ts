import chalk from 'chalk'
import { CancelError } from '../util/interrupts/interrupts'
import { handleCommand } from './commands'
import { ExitError } from './commands/exit'
import { ChatContext } from './context'
import { promptWithPrefixes } from './output'
import { runToolsInResponse } from './tools'

export async function handler(context: ChatContext) {
    let restoreState = false

    while (true) {
        const controller = new AbortController()
        const previousRestoreState = restoreState
        restoreState = false

        const listener = () => {
            controller.abort()
            restoreState = true
        }

        context.contextStateManager.events.addListener('open-files-changed', listener)

        try {
            const currentBranch = context.provider.conversationManager.currentBranch()
            const prompt = `[${currentBranch}] $ `
            const message = await context.prompter.question(prompt, 'meta', controller.signal, previousRestoreState)
            await handle(context, message.trim())
        } catch (error: any) {
            if (error instanceof ExitError) {
                return
            }

            throw error
        } finally {
            context.contextStateManager.events.removeListener('open-files-changed', listener)
        }
    }
}

async function handle(context: ChatContext, message: string): Promise<void> {
    if (message === '') {
        return
    }

    if (message.startsWith(':')) {
        if (!(await handleCommand(context, message))) {
            return
        }
    } else {
        const prunedBranches = context.provider.conversationManager.pushUser({ type: 'text', content: message })
        if (prunedBranches.length > 0) {
            console.log(chalk.yellow(`${chalk.dim('𐌖')} Pruned branches: ${prunedBranches.join(', ')}`))
            console.log()
        }
    }

    await prompt(context)
}

async function prompt(context: ChatContext): Promise<void> {
    while (true) {
        try {
            const reprompt = await promptOnce(context)
            if (reprompt) {
                continue
            }
        } catch (error: any) {
            if (!(error instanceof CancelError)) {
                throw error
            }
        }

        break
    }
}

const responsePrefixes = {
    progressPrefix: 'Generating response...',
    successPrefix: 'Generated response.',
    failurePrefix: 'Failed to generate response.',
}

function promptOnce(context: ChatContext): Promise<boolean> {
    return context.interruptHandler.withInterruptHandler(async signal => {
        const result = await promptWithPrefixes(context, responsePrefixes, signal)
        if (!result.ok) {
            return false
        }

        return runToolsInResponse(context, result.response)
    })
}
