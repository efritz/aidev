import { readFile } from 'fs/promises'
import chalk from 'chalk'
import { AssistantMessage, MetaMessage, UserMessage } from '../messages/messages'
import { findMatchingRule } from '../rules/matcher'
import { findTool } from '../tools/tools'
import { replayWriteFile } from '../util/fs/write'
import { reviver, SaveFilePayload } from './commands/save'
import { ChatContext, swapProvider } from './context'
import { formatMessage } from './output'

export async function loadHistory(context: ChatContext, historyFilename: string): Promise<void> {
    const content = await readFile(historyFilename, 'utf8')
    const { model, messages, contextFiles, contextDirectories }: SaveFilePayload = JSON.parse(content, reviver)

    await swapProvider(context, model)
    context.provider.conversationManager.setMessages(messages)
    contextFiles.forEach(({ path, inclusionReasons }) =>
        inclusionReasons.forEach(reason => context.contextStateManager.addFiles(path, reason)),
    )
    contextDirectories.forEach(({ path, inclusionReasons }) =>
        inclusionReasons.forEach(reason => context.contextStateManager.addDirectories(path, reason)),
    )

    replayMessages(context)
}

export function replayMessages(context: ChatContext): void {
    for (const message of context.provider.conversationManager.visibleMessages()) {
        switch (message.role) {
            case 'meta':
                replayMetaMessage(context, message)
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

function replayMetaMessage(context: ChatContext, message: MetaMessage): void {
    switch (message.type) {
        case 'branch':
            console.log(`${chalk.dim('𐌖')} Created branch "${message.name}"`)
            console.log()
            break

        case 'savepoint':
            console.log(`${chalk.dim('📌')} Saved state as "${message.name}"`)
            console.log()
            break

        // @ts-expect-error: intentional fallthrough
        case 'stash':
            if (!message.fromStash) {
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

        case 'rule':
            for (const rule of message.rules) {
                if (findMatchingRule(context.rules, rule)) {
                    console.log(`${chalk.dim('ℹ')} Activated rule "${chalk.red(rule.description)}"`)
                } else {
                    console.log(chalk.yellow(`ℹ Activated rule "${chalk.red(rule.description)}" cannot be found`))
                }
            }

            console.log()
            break

        case 'load':
            for (const path of message.paths) {
                console.log(`${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`)
            }
            console.log()
            break

        case 'loaddir':
            for (const path of message.paths) {
                console.log(`${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`)
            }
            console.log()
            break

        case 'unload':
            for (const path of message.paths) {
                console.log(`${chalk.dim('ℹ')} Removed "${chalk.red(path)}" from context.`)
            }
            console.log()
            break

        case 'addTodo':
            console.log(`${chalk.green('✓')} Added todo: ${chalk.dim(message.description)}`)
            console.log()
            break

        case 'completeTodo':
            console.log(`${chalk.green('✓')} Completed todo: ${chalk.dim(message.taskId)}`)
            console.log()
            break

        case 'cancelTodo':
            console.log(`${chalk.red('✗')} Canceled todo: ${chalk.dim(message.taskId)}`)
            console.log()
            break

        case 'summary': {
            const target = message.fromSavepoint
                ? `savepoint "${message.fromSavepoint}"`
                : 'beginning of the conversation'
            console.log(`${chalk.dim('📋')} Conversation summary from ${target}:`)
            console.log()
            console.log(message.content)
            console.log()
            break
        }
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
            for (const result of message.results) {
                const tool = findTool(result.toolUse.name)
                const args = result.toolUse.parameters ? JSON.parse(result.toolUse.parameters) : {}
                tool.replay(args, result)
                console.log()
            }
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
