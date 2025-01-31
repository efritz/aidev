import chalk from 'chalk'
import { Response } from '../messages/messages'
import { ProgressFunction } from '../providers/provider'
import { shouldReprompt } from '../reprompt/mediator'
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
    while (true) {
        const result = await promptWithProgress(context)
        if (!result.ok) {
            console.log(chalk.red(result.error))
            console.log()
            break
        }

        const { ranTools, reprompt } = await runToolsInMessages(context, result.response.messages)

        if (ranTools && (reprompt === true || (reprompt === undefined && (await shouldReprompt(context))))) {
            // Re-prompt if we ran tools and either (a) any tool requested we should explicitly re-prompt,
            // or (b) no tool requested we should NOT explicitly reprompt and our reprompt mediator indicates
            // we should continue.
            continue
        } else {
            break
        }
    }
}

async function promptWithProgress(context: ChatContext): Promise<ProgressResult<Response>> {
    const formatResponse = (r?: Response): string =>
        (r?.messages || [])
            .map(formatMessage)
            .filter(message => message !== '')
            .join('\n\n')

    let cancel = () => {}
    const prompt = (progress?: ProgressFunction): Promise<Response> => {
        return context.provider.prompt(progress, abort => {
            cancel = abort
        })
    }

    return await context.interruptHandler.withInterruptHandler(
        () =>
            withProgress<Response>(prompt, {
                progress: prefixFormatter('Generating response...', formatResponse),
                success: prefixFormatter('Generated response.', formatResponse),
                failure: prefixFormatter('Failed to generate response.', formatResponse),
            }),
        {
            throwOnCancel: false,
            onAbort: () => cancel(),
        },
    )
}
