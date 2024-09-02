import { writeFileSync } from 'fs'
import chalk from 'chalk'
import { ContextDirectory, ContextFile } from '../../../context/state'
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

    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`

    const messages = context.provider.conversationManager.messages()
    const contextFiles: Record<string, ContextFile> = Array.from(context.contextState.files).reduce(
        (obj: any, [key, value]) => {
            obj[key] = value
            return obj
        },
        {},
    )
    const contextDirectories: Record<string, ContextDirectory> = Array.from(context.contextState.directories).reduce(
        (obj: any, [key, value]) => {
            obj[key] = value
            return obj
        },
        {},
    )

    writeFileSync(
        filename,
        JSON.stringify(
            { messages, contextFiles, contextDirectories },
            (key: string, value: any): any =>
                value instanceof Error ? { type: 'ErrorMessage', message: value.message } : value,
            '\t',
        ),
    )
    console.log(`Chat history saved to ${filename}\n`)
}
