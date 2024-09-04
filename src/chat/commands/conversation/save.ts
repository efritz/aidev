import { writeFile } from 'fs/promises'
import chalk from 'chalk'
import { ContextDirectory, ContextFile } from '../../../context/state'
import { Message } from '../../../messages/messages'
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
    const contextFiles: Record<string, ContextFile> = Array.from(context.contextStateManager.files).reduce(
        (obj: any, [key, value]) => {
            obj[key] = value
            return obj
        },
        {},
    )
    const contextDirectories: Record<string, ContextDirectory> = Array.from(
        context.contextStateManager.directories,
    ).reduce((obj: any, [key, value]) => {
        obj[key] = value
        return obj
    }, {})

    const contents: SaveFilePayload = { messages, contextFiles, contextDirectories }
    await writeFile(filename, JSON.stringify(contents, replacer, '\t'))

    console.log(`Chat history saved to ${filename}\n`)
}

export type SaveFilePayload = {
    messages: Message[]
    contextFiles: Record<string, ContextFile>
    contextDirectories: Record<string, ContextDirectory>
}

function replacer(key: string, value: any): any {
    return value instanceof Error ? { type: 'ErrorMessage', message: value.message } : value
}

export function reviver(key: string, value: any): any {
    if (value && value.type === 'ErrorMessage') {
        return new Error(value.message)
    }

    return value
}
