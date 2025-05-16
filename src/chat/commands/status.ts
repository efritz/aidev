import chalk from 'chalk'
import { getActiveFiles } from '../../context/conversation'
import { Branch } from '../../conversation/branches'
import { Message } from '../../messages/messages'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const statusCommand: CommandDescription = {
    prefix: ':status',
    description: 'Display the current branching structure and context files',
    handler: handleStatus,
}

async function handleStatus(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :status.'))
        console.log()
        return
    }

    const branchMetadata = context.provider.conversationManager.branchMetadata()
    const currentBranch = context.provider.conversationManager.currentBranch()

    console.log(chalk.bold('Current model:'))
    console.log()
    printCurrentModel(context)
    console.log()

    console.log(chalk.bold('Context files:'))
    console.log()
    printContextFiles(context)
    console.log()

    console.log(chalk.bold('Stashed files:'))
    console.log()
    printStashedFiles(context)
    console.log()

    console.log(chalk.bold('Branch structure:'))
    console.log()
    printBranch(branchMetadata, branchMetadata['main'], '', true, currentBranch)
    console.log()
}

function printCurrentModel(context: ChatContext) {
    console.log(chalk.cyan(`${context.provider.modelName} (${context.provider.providerName})`))
}

function printBranch(
    branchMetadata: Record<string, Branch>,
    node: Branch,
    prefix: string,
    isLast: boolean,
    currentBranch: string,
) {
    const branchColor = node.name === currentBranch ? chalk.green : chalk.yellow
    const userMessagesAhead = node.parent
        ? countUserMessages(node.messages) - countUserMessages(branchMetadata[node.parent].messages)
        : 0
    const messagesInfo = userMessagesAhead > 0 ? chalk.cyan(` (+${userMessagesAhead})`) : ''
    const children = Object.values(branchMetadata).filter(branch => branch.parent === node.name)
    const lastUserMessage = children.length > 0 ? getLastUserMessage(node.messages) : undefined
    const contextInfo = lastUserMessage ? chalk.gray(` - "${truncateMessage(lastUserMessage)}"`) : ''

    console.log(`${prefix}${isLast ? '└── ' : '├── '}${branchColor(node.name)}${messagesInfo}${contextInfo}`)

    const uniqueSavepoints = getUniqueSavepoints(node, branchMetadata)
    if (uniqueSavepoints.length > 0) {
        const savepointPrefix = prefix + (isLast ? '    ' : '│   ')
        uniqueSavepoints.forEach((savepoint, index) => {
            const isLastSavepoint = index === uniqueSavepoints.length - 1 && children.length === 0
            const messagesFromTip = savepoint.messagesFromTip > 0 ? chalk.cyan(` (-${savepoint.messagesFromTip})`) : ''
            const savepointInfo = savepoint.previousMessage
                ? chalk.gray(` - "${truncateMessage(savepoint.previousMessage)}"`)
                : ''
            console.log(
                `${savepointPrefix}${isLastSavepoint ? '└── ' : '├── '}${chalk.cyan('📌 ' + savepoint.name)}${messagesFromTip}${savepointInfo}`,
            )
        })
    }

    children.forEach((child, index) =>
        printBranch(
            branchMetadata,
            child,
            prefix + (isLast ? '    ' : '│   '),
            index === children.length - 1,
            currentBranch,
        ),
    )
}

function printContextFiles(context: ChatContext) {
    const files = getActiveFiles(context.provider.conversationManager, context.contextStateManager)

    if (files.length === 0) {
        console.log(chalk.yellow('No files in context.'))
        return
    }

    files.forEach(file => {
        const reasons = file.inclusionReasons.map(reason => {
            switch (reason.type) {
                case 'explicit':
                    // TODO - deduplicate?
                    return chalk.blue('added by user')
                case 'tool_use':
                    return chalk.magenta('added by tool use')
                case 'editor':
                    return chalk.green('open in editor')
            }
        })

        console.log(`${chalk.cyan(file.path)} - ${reasons.join(', ')}`)
    })
}

function printStashedFiles(context: ChatContext) {
    const stashedFiles = Array.from(context.provider.conversationManager.stashedFiles().keys())
    if (stashedFiles.length === 0) {
        console.log(chalk.yellow('No files are currently stashed.'))
        return
    }

    for (const file of stashedFiles) {
        console.log(chalk.cyan(file))
    }
}

const countUserMessages = (messages: Message[]): number => messages.filter(message => message.role === 'user').length

const getSavepoints = (messages: Message[]): string[] =>
    messages.filter(message => message.role === 'meta' && message.type === 'savepoint').map(({ name }) => name)

type SavepointInfo = {
    name: string
    messagesFromTip: number
    previousMessage: string | undefined
}

const getUniqueSavepoints = (branch: Branch, branchMetadata: Record<string, Branch>): SavepointInfo[] => {
    const parentSavepoints = branch.parent ? getSavepoints(branchMetadata[branch.parent].messages) : []
    const branchSavepoints = getSavepoints(branch.messages)

    return branchSavepoints
        .filter(savepoint => !parentSavepoints.includes(savepoint))
        .map(savepoint => {
            const savepointIndex = branch.messages.findIndex(isMatchingSavepoint(savepoint))
            const messagesFromTip =
                countUserMessages(branch.messages) - countUserMessages(branch.messages.slice(0, savepointIndex + 1))
            const previousMessage = getLastUserMessageBeforeSavepoint(branch.messages, savepoint)
            return { name: savepoint, messagesFromTip, previousMessage }
        })
}

const getLastUserMessage = (messages: Message[]): string | undefined =>
    messages
        .filter(message => message.role === 'user' && message.type === 'text')
        .map(({ content }) => content)
        .pop()

const getLastUserMessageBeforeSavepoint = (messages: Message[], name: string): string | undefined => {
    const savepointIndex = messages.findIndex(isMatchingSavepoint(name))
    return savepointIndex < 0 ? undefined : getLastUserMessage(messages.slice(0, savepointIndex))
}

const truncateMessage = (message: string, maxLength: number = 30): string =>
    message.length <= maxLength ? message : message.substring(0, maxLength - 3) + '...'

const isMatchingSavepoint =
    (name: string): ((message: Message) => boolean) =>
    (message: Message) =>
        message.role === 'meta' && message.type === 'savepoint' && message.name === name
