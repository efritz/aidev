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
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :summarize.'))
        console.log()
        return
    }

    const summary = await runAgent(context, summarizeConversationAgent, args)
    context.provider.conversationManager.recordSummary(summary)

    console.log(`${chalk.dim('📋')} Previous conversation summary:`)
    console.log()
    console.log(summary)
    console.log()
}

const summarizeConversationAgent: Agent<{}, string> = {
    model: context => context.preferences.summarizerModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async (context, _args) =>
        userMessageTemplate.replace(
            '{{conversation}}',
            context.provider.conversationManager
                .visibleMessages()
                .map(message => JSON.stringify(message))
                .join('\n'),
        ),
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
Please summarize the following conversation:

{{conversation}}
`
