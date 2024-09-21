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

    const contents: SaveFilePayload = {
        messages: context.provider.conversationManager.messages(),
        contextFiles: mapToRecord(context.contextStateManager.files),
        contextDirectories: mapToRecord(context.contextStateManager.directories),
        stashedFiles: mapToRecord(context.contextStateManager.stashedFiles),
    }

    const filename = `chat-${Math.floor(Date.now() / 1000)}.json`
    await writeFile(filename, JSON.stringify(contents, replacer, '\t'))
    console.log(`Chat history saved to ${filename}\n`)
}

function mapToRecord<K extends string | number | symbol, V>(map: Map<K, V>): Record<K, V> {
    return Array.from(map).reduce((obj: any, [key, value]) => {
        obj[key] = value
        return obj
    }, {})
}

export type SaveFilePayload = {
    messages: Message[]
    contextFiles: Record<string, ContextFile>
    contextDirectories: Record<string, ContextDirectory>
    stashedFiles: Record<string, string>
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
