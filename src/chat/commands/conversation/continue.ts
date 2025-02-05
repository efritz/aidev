import chalk from 'chalk'
import { canPromptAssistant, ChatContext } from '../../context'
import { CommandDescription } from './../command'

export const continueCommand: CommandDescription = {
    prefix: ':continue',
    description: 'Re-prompt the assistant for a response without supplying a user message.',
    handler: handleContinue,
    valid: canPromptAssistant,
    continuePrompt: () => true,
}

async function handleContinue(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :continue.'))
        console.log()
        return
    }

    if (!canPromptAssistant(context)) {
        console.log(chalk.red('Cannot continue assistant response directly after an assistant message.'))
    }
}
