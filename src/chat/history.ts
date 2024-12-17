import { readFile } from 'fs/promises'
import chalk from 'chalk'
import { AssistantMessage, MetaMessage, UserMessage } from '../messages/messages'
import { tools } from '../tools/tools'
import { replayWriteFile } from '../util/fs/write'
import { reviver, SaveFilePayload } from './commands/conversation/save'
import { ChatContext, swapProvider } from './context'
import { formatMessage } from './output'

export async function loadHistory(
    context: ChatContext,
    usingDefaultModel: boolean,
    historyFilename: string,
): Promise<void> {
    const content = await readFile(historyFilename, 'utf8')
    const { model, messages, contextFiles, contextDirectories }: SaveFilePayload = JSON.parse(content, reviver)

    if (usingDefaultModel) {
        await swapProvider(context, model)
    }

    context.provider.conversationManager.setMessages(messages)
    context.contextStateManager.files = new Map(Object.entries(contextFiles))
    context.contextStateManager.directories = new Map(Object.entries(contextDirectories))

    replayMessages(context)
}

export function replayMessages(context: ChatContext): void {
    let emitNewline = false
    for (const [path, file] of context.contextStateManager.files.entries()) {
        if (file.inclusionReasons.some(r => r.type === 'explicit')) {
            emitNewline = true
            console.log(`${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`)
        }
    }

    for (const [path, dir] of context.contextStateManager.directories.entries()) {
        if (dir.inclusionReasons.some(r => r.type === 'explicit')) {
            emitNewline = true
            console.log(`${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`)
        }
    }

    if (emitNewline) {
        console.log()
    }

    for (const message of context.provider.conversationManager.visibleMessages()) {
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
