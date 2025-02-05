import chalk from 'chalk'
import { Response } from '../messages/messages'
import { ProgressFunction } from '../providers/provider'
import { shouldReprompt } from '../reprompt/mediator'
import { CancelError } from '../util/interrupts/interrupts'
import { prefixFormatter, ProgressResult, withProgress } from '../util/progress/progress'
import { handleCommand } from './commands/commands'
import { ExitError } from './commands/control/exit'
import { ChatContext } from './context'
import { formatMessage } from './output'
import { runToolsInMessages } from './tools'

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
    while (await promptOnce(context)) {}
}

function promptOnce(context: ChatContext): Promise<boolean> {
    return context.interruptHandler.withInterruptHandler(
        async signal => {
            const result = await promptWithProgress(context, signal)
            if (!result.ok) {
                return false
            }

            const { ranTools, reprompt } = await runToolsInMessages(context, result.response.messages)

            if (ranTools) {
                if (reprompt === true) {
                    // Some tool explicitly requested a re-prompt
                    return true
                }

                if (reprompt === false) {
                    // Some tool explicitly requested to not re-prompt
                    return false
                }

                // All tools are ambivalent; check with reprmopt mediator if there is more to do
                // to fulfill the current user request.
                const result = await shouldRepromptWithProgress(context, signal)
                if (!result.ok) {
                    return false
                }

                return result.response
            }

            return false
        },
        {
            throwOnCancel: false,
        },
    )
}

function promptWithProgress(context: ChatContext, signal?: AbortSignal): Promise<ProgressResult<Response>> {
    const formatResponse = (r?: Response): string =>
        (r?.messages || [])
            .map(formatMessage)
            .filter(message => message !== '')
            .join('\n\n')

    return withProgress<Response>(progress => context.provider.prompt(progress, signal), {
        progress: prefixFormatter('Generating response...', formatResponse),
        success: prefixFormatter('Generated response.', formatResponse),
        failure: prefixFormatter('Failed to generate response.', formatResponse),
    })
}

function shouldRepromptWithProgress(context: ChatContext, signal?: AbortSignal): Promise<ProgressResult<boolean>> {
    return withProgress(
        async progress => {
            const reprompt = await shouldReprompt(context, signal)
            progress(reprompt)
            return reprompt
        },
        {
            progress: () => 'Checking if re-prompt is necessary...',
            success: reprompt => (reprompt ? 'Assistant will continue...' : 'Assistant is done.'),
            failure: (_, error) => `Failed to check if re-prmopt is necessary.\n\n${chalk.red(error)}`,
        },
    )
}
