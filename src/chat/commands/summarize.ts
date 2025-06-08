import chalk from 'chalk'
import { Agent, runAgent } from '../../agent/agent'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const summarizeCommand: CommandDescription = {
    prefix: ':summarize',
    description: 'Summarize the current conversation and create a meta message',
    handler: handleSummarize,
}

async function handleSummarize(context: ChatContext, args: string): Promise<void> {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length > 1) {
        console.log(chalk.red.bold('Expected at most one savepoint name for :summarize.'))
        console.log()
        return
    }
    const savepoint = parts.length === 1 ? parts[0] : undefined

    if (savepoint && !context.provider.conversationManager.savepoints().includes(savepoint)) {
        console.log(chalk.red.bold(`Savepoint "${savepoint}" not found.`))
        console.log()
        return
    }

    const summary = await runAgent(context, summarizeConversationAgent, { savepoint })
    context.provider.conversationManager.recordSummary(summary, savepoint)

    const target = savepoint ? `savepoint "${savepoint}"` : 'beginning of the conversation'
    console.log(`${chalk.dim('📋')} Conversation summary from ${target}:`)
    console.log()
    console.log(summary)
    console.log()
}

const summarizeConversationAgent: Agent<{ savepoint?: string }, string> = {
    model: context => context.preferences.summarizerModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async (context, args) => {
        const { savepoint } = args
        const messages = savepoint
            ? context.provider.conversationManager.messagesFromSavepoint(savepoint)
            : context.provider.conversationManager.visibleMessages()

        const conversationJson = messages.map(message => JSON.stringify(message)).join('\n')

        const rangeDescription = savepoint
            ? `from savepoint "${savepoint}" to the current message`
            : 'the entire visible conversation'

        return userMessageTemplate.replace('{{range}}', rangeDescription).replace('{{conversation}}', conversationJson)
    },
    processMessage: async (_, content) => content.trim(),
}

const systemPromptTemplate = `
You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the conversation provided to you.

The summary should:
- Capture the main topics discussed
- Include key decisions made
- Note important code changes or implementations
- Preserve context that would be needed to continue the conversation effectively
- Be written in a clear, structured format

Focus on actionable items, technical details, and the overall flow of the conversation. Omit redundant information but keep essential context.
`

const userMessageTemplate = `
Please summarize {{range}}.

The conversation section to be summarized is provided below:

{{conversation}}
`
