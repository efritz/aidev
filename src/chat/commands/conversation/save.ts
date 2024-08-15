import { writeFileSync } from 'fs'
import chalk from 'chalk'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const saveCommand: CommandDescription = {
    prefix: ':save',
    description: 'Save the chat history',
    handler: handleSave,
}

async function handleSave(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :save.'))
        console.log()
        return
    }

    const messages = context.provider.conversationManager.messages()
    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`
    writeFileSync(
        filename,
        JSON.stringify(
            messages,
            (key: string, value: any): any =>
                value instanceof Error ? { type: 'ErrorMessage', message: value.message } : value,
            '\t',
        ),
    )
    console.log(`Chat history saved to ${filename}\n`)
}
