import chalk from 'chalk'
import { CancelError } from '../../../util/interrupts/interrupts'
import { withContentEditor } from '../../../util/vscode/edit'
import { canPromptAssistant, ChatContext } from '../../context'
import { CommandDescription } from './../command'

export const promptCommand: CommandDescription = {
    prefix: ':prompt',
    description: 'Draft a prompt in VSCode.',
    handler: handlePrompt,
    continuePrompt: canPromptAssistant,
}

async function handlePrompt(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :prompt.'))
        console.log()
        return
    }

    try {
        const content = await withContentEditor(context.interruptHandler, '')
        if (content !== '') {
            context.provider.conversationManager.pushUser({ type: 'text', content })
        }
    } catch (error: any) {
        if (!(error instanceof CancelError)) {
            throw error
        }
    }
}
