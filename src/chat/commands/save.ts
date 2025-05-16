import { writeFile } from 'fs/promises'
import chalk from 'chalk'
import { ContextDirectory } from '../../context/directories'
import { ContextFile } from '../../context/files'
import { Message } from '../../messages/messages'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

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

    const contents: SaveFilePayload = {
        model: context.provider.modelName,
        messages: context.provider.conversationManager.messages(),
        contextFiles: [
            ...context.contextStateManager
                .files()
                .values()
                .map(({ content: _, ...v }) => v),
        ],
        contextDirectories: [
            ...context.contextStateManager
                .directories()
                .values()
                .map(({ entries: _, ...v }) => v),
        ],
    }

    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`
    await writeFile(filename, JSON.stringify(contents, replacer, '\t'))
    console.log(`Chat history saved to ${filename}\n`)
}

export type SaveFilePayload = {
    model: string
    messages: Message[]
    contextFiles: Omit<ContextFile, 'content'>[]
    contextDirectories: Omit<ContextDirectory, 'entries'>[]
}

function replacer(_key: string, value: any): any {
    return value instanceof Error ? { type: 'ErrorMessage', message: value.message } : value
}

export function reviver(_key: string, value: any): any {
    if (value && value.type === 'ErrorMessage') {
        return new Error(value.message)
    }

    return value
}
