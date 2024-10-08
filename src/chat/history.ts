import { readFile } from 'fs/promises'
import chalk from 'chalk'
import { AssistantMessage, Message, MetaMessage, UserMessage } from '../messages/messages'
import { tools } from '../tools/tools'
import { replayWriteFile } from '../util/fs/write'
import { reviver, SaveFilePayload } from './commands/conversation/save'
import { ChatContext } from './context'
import { formatMessage } from './output'

export async function loadHistory(context: ChatContext, historyFilename: string): Promise<void> {
    const content = await readFile(historyFilename, 'utf8')
    const { messages, contextFiles, contextDirectories }: SaveFilePayload = JSON.parse(content, reviver)

    context.provider.conversationManager.setMessages(messages)
    context.contextStateManager.files = new Map(Object.entries(contextFiles))
    context.contextStateManager.directories = new Map(Object.entries(contextDirectories))

    replayMessages(context.provider.conversationManager.visibleMessages())
}

export function replayMessages(messages: Message[]): void {
    for (const message of messages) {
        switch (message.role) {
            case 'meta':
                replayMetaMessage(message)
                break

            case 'user':
                replayUserMessage(message)
                break

            case 'assistant':
                replayAssistantMessage(message)
                break
        }
    }
}

function replayMetaMessage(message: MetaMessage): void {
    switch (message.type) {
        case 'branch':
            console.log(`${chalk.dim('𐌖')} Created branch "${message.name}"`)
            console.log()
            break

        case 'savepoint':
            console.log(`${chalk.dim('📌')} Saved state as "${message.name}"`)
            console.log()
            break

        case 'stash':
            if (message.fromStash) {
                // fallthrough
            } else {
                // skip; replayed via tool_result message
                break
            }

        case 'applyStash':
            replayWriteFile({
                path: message.path,
                contents: message.content,
                proposedContents: message.content,
                originalContents: message.originalContent,
                stashed: message.type === 'stash',
                fromStash: true,
            })
            break

        case 'unstash':
            console.log(`${chalk.dim('ℹ')} Unstashed file "${chalk.red(message.path)}"`)
            console.log()
            break
    }
}

function replayUserMessage(message: UserMessage): void {
    switch (message.type) {
        case 'text': {
            console.log(message.replayContent ?? `$ ${message.content}`)
            console.log()
            break
        }

        case 'tool_result': {
            const tool = tools.find(({ name }) => name === message.toolUse.name)
            if (!tool) {
                throw new Error(`Tool not found: ${message.toolUse.name}`)
            }

            const args = message.toolUse.parameters ? JSON.parse(message.toolUse.parameters) : {}
            tool.replay(args, message)
            console.log()
            break
        }
    }
}

function replayAssistantMessage(message: AssistantMessage): void {
    const content = formatMessage(message)
    if (content) {
        console.log(content)
        console.log()
    }
}
