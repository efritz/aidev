import { z } from 'zod'
import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { Tool } from '../tool'
import { enabledToolNames } from '../tools'

const AgentSchema = z.object({
    systemPrompt: z.string().describe('The system prompt/instruction for the sub-agent'),
    allowedTools: z
        .array(z.string())
        .optional()
        .describe('List of tool names the sub-agent can use. If not provided, uses all available tools'),
    userMessage: z.string().describe('The user message/task for the sub-agent to process'),
})

type AgentArguments = z.infer<typeof AgentSchema>
type AgentResult = string

export const agent: Tool<typeof AgentSchema, AgentResult> = {
    name: 'agent',
    description: [
        'Invoke a sub-agent with a custom system prompt and optional tool subset to handle a specific task',
    ].join(' '),
    schema: AgentSchema,
    enabled: true,
    execute: async (context: ChatContext, _toolUseId: string, args: AgentArguments) => {
        // Validate tool names if provided
        const availableTools = enabledToolNames()
        if (args.allowedTools) {
            const invalidTools = args.allowedTools.filter(tool => !availableTools.includes(tool))
            if (invalidTools.length > 0) {
                throw new Error(
                    `Invalid tool names: ${invalidTools.join(', ')}. Available tools: ${availableTools.join(', ')}`,
                )
            }
        }

        const agent: Agent<{ userMessage: string }, string> = {
            model: () => 'sonnet',
            allowedTools: () => args.allowedTools ?? [],
            quiet: () => false,
            buildSystemPrompt: async (_context: ChatContext, _args: any) => args.systemPrompt,
            buildUserMessage: async (_context: ChatContext, args: { userMessage: string }) => args.userMessage,
            processMessage: async (_context: ChatContext, submittedAnswer: string, _args: any) => submittedAnswer,
        }

        // TODO - signal
        const result = await runAgent(context, agent, { userMessage: args.userMessage })
        console.log({ result })

        return {
            result: result as string,
            reprompt: false,
        }
    },
    replay: (_args: AgentArguments, result: { result?: string; error?: Error; canceled?: boolean }) => {
        if (result.error) {
            console.log(`Agent execution failed: ${result.error.message}`)
        } else if (result.canceled) {
            console.log('Agent execution was canceled')
        } else {
            console.log(`Agent completed with result: ${result.result}`)
        }
    },
    serialize: (result: { result?: string; error?: Error; canceled?: boolean }) => {
        if (result.error) {
            return { result: `Error: ${result.error.message}` }
        } else if (result.canceled) {
            return { result: 'Agent execution was canceled' }
        } else {
            return { result: result.result || 'No result provided' }
        }
    },
}
