import { z } from 'zod'
import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const summarizeConversationSchema = z.object({})

type SummarizeConversationArgs = z.infer<typeof summarizeConversationSchema>
type SummarizeConversationResult = { summary: string }

class SummarizeConversationAgent implements Agent<SummarizeConversationArgs, SummarizeConversationResult> {
    model(context: ChatContext): string {
        return context.preferences.chat.defaultModel
    }

    async buildSystemPrompt(_context: ChatContext, _args: SummarizeConversationArgs): Promise<string> {
        return `You are a conversation summarizer. Your task is to create a concise but comprehensive summary of the conversation provided to you.

The summary should:
- Capture the main topics discussed
- Include key decisions made
- Note important code changes or implementations
- Preserve context that would be needed to continue the conversation effectively
- Be written in a clear, structured format

Focus on actionable items, technical details, and the overall flow of the conversation. Omit redundant information but keep essential context.`
    }

    async buildUserMessage(context: ChatContext, _args: SummarizeConversationArgs): Promise<string> {
        const messages = context.conversationManager.visibleMessages()

        // Convert messages to a readable format for summarization
        const conversationText = messages
            .map(message => {
                switch (message.role) {
                    case 'user':
                        if (message.type === 'text') {
                            return `User: ${message.content}`
                        } else if (message.type === 'tool_result') {
                            return `Tool Result (${message.toolUse.name}): ${JSON.stringify(message.result)}`
                        }
                        break
                    case 'assistant':
                        if (message.type === 'text') {
                            return `Assistant: ${message.content}`
                        } else if (message.type === 'tool_use') {
                            const toolCalls = message.tools.map(tool => `${tool.name}(${tool.parameters})`).join(', ')
                            return `Assistant used tools: ${toolCalls}`
                        }
                        break
                    case 'meta':
                        // Include relevant meta messages in summary context
                        if (message.type === 'load' || message.type === 'loaddir') {
                            return `Files loaded: ${message.paths.join(', ')}`
                        } else if (message.type === 'unload') {
                            return `Files unloaded: ${message.paths.join(', ')}`
                        }
                        break
                }
                return ''
            })
            .filter(text => text.length > 0)
            .join('\n\n')

        return `Please summarize the following conversation:\n\n${conversationText}`
    }

    async processMessage(
        _context: ChatContext,
        content: string,
        _args: SummarizeConversationArgs,
    ): Promise<SummarizeConversationResult> {
        return { summary: content.trim() }
    }
}

const agent = new SummarizeConversationAgent()

async function execute(
    context: ChatContext,
    toolUseId: string,
    args: SummarizeConversationArgs,
): Promise<ExecutionResult<SummarizeConversationResult>> {
    try {
        const result = await runAgent(context, agent, args)

        // Record the summary as a meta message
        context.conversationManager.recordSummary(result.summary)

        return { result }
    } catch (error: any) {
        return { error }
    }
}

function replay(_args: SummarizeConversationArgs, result: ToolResult<SummarizeConversationResult>): void {
    if (result.result) {
        console.log(`Conversation summarized: ${result.result.summary.substring(0, 100)}...`)
    }
}

function serialize(result: ToolResult<SummarizeConversationResult>) {
    if (result.error) {
        return { result: `Error: ${result.error.message}` }
    }

    if (result.canceled) {
        return { result: 'Summarization was canceled.' }
    }

    if (!result.result) {
        return { result: 'No summary generated.' }
    }

    return {
        result: `Conversation has been summarized. The summary has been recorded as a meta message and will be used to filter visible messages in future interactions.`,
        suggestions:
            'The conversation history before this summary will now be hidden from the model context, helping to manage token usage while preserving essential context.',
    }
}

export const summarizeConversation: Tool<typeof summarizeConversationSchema, SummarizeConversationResult> = {
    name: 'summarize_conversation',
    description:
        'Summarize the current conversation and create a meta message that will filter out previous messages from the visible context.',
    schema: summarizeConversationSchema,
    enabled: true,
    execute,
    replay,
    serialize,
}
