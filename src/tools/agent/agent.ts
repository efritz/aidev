import chalk from 'chalk'
import { z } from 'zod'
import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { Tool, ToolResult } from '../tool'

const AgentSchema = z.object({
    agentInstructions: z.string().describe('The system prompt/instruction for the sub-agent.'),
    instanceInstructions: z.string().describe('The user message/task for the sub-agent to process.'),
    allowedTools: z.array(z.string()).optional().describe('List of tool names the sub-agent can use.'),
})

type AgentArguments = z.infer<typeof AgentSchema>
type AgentResult = string

export const agent: Tool<typeof AgentSchema, AgentResult> = {
    name: 'agent',
    description: [
        'Invoke a sub-agent with a custom system prompt and optional tool subset to handle a specific task.',
    ].join(' '),
    schema: AgentSchema,
    enabled: true,
    agentContext: [{ type: 'main', required: false }],
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        { agentInstructions, instanceInstructions, allowedTools }: AgentArguments,
    ) => {
        const agent: Agent<undefined, string> = {
            model: (context: ChatContext) => context.preferences.subagentModel,
            allowedTools: () => allowedTools ?? [],
            quiet: () => false,
            buildPrompt: async () => ({ agentInstructions, instanceInstructions }),
            processResult: async (_context: ChatContext, result: string, _args: any) => result,
        }

        const result = await context.interruptHandler.withInterruptHandler(signal => runAgent(context, agent, signal))

        console.log(`${chalk.dim('ℹ')} Sub-agent result:`)
        console.log(chalk.cyanBright.bold(result.trim()))
        console.log()

        return { result }
    },
    replay: (_args: AgentArguments, { result, error }: ToolResult<AgentResult>) => {
        if (!result) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
        } else {
            console.log(`${chalk.dim('ℹ')} Sub-agent result:`)
            console.log(chalk.cyanBright.bold(result.trim()))
        }
    },
    serialize: ({ result, error }: ToolResult<AgentResult>) => ({ result, error }),
}
