import { readFileSync } from 'fs'
import chalk from 'chalk'
import { AssistantMessage, Message, MetaMessage, UserMessage } from '../messages/messages'
import { tools } from '../tools/tools'
import { ChatContext } from './context'
import { formatMessage } from './output'

export function loadHistory(context: ChatContext, historyFilename: string): void {
    const messages: Message[] = JSON.parse(readFileSync(historyFilename, 'utf8'), (key: string, value: any) => {
        if (value && value.type === 'ErrorMessage') {
            return new Error(value.message)
        }

        return value
    })

    context.provider.conversationManager.setMessages(messages)
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
            tool.replay(args, { result: message.result, error: message.error })
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
