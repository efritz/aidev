import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const ThinkSchema = z.object({
    thoughts: z.string().describe('Your thoughts, reasoning, or approach to the problem.'),
})

type ThinkArguments = z.infer<typeof ThinkSchema>

type ThinkResult = {
    thoughts: string
}

export const think: Tool<typeof ThinkSchema, ThinkResult> = {
    name: 'think',
    description: [
        'Use this tool to think about something.',
        'It will not obtain new information or have any side effects - it just logs the thought.',
        'Use it when complex reasoning or brainstorming is needed.',
    ].join(' '),
    schema: ThinkSchema,
    enabled: true,
    replay: (_args: ThinkArguments, { result }: ToolResult<ThinkResult>) => {
        if (result) {
            console.log(chalk.italic.grey(result.thoughts.trim()))
        }
    },
    execute: async (
        _context: ChatContext,
        _toolUseId: string,
        { thoughts }: ThinkArguments,
    ): Promise<ExecutionResult<ThinkResult>> => {
        console.log(chalk.italic.grey(thoughts.trim()))
        return { result: { thoughts }, reprompt: true }
    },
    serialize: ({ result }: ToolResult<ThinkResult>) => ({
        result: { thoughts: result?.thoughts },
    }),
}
