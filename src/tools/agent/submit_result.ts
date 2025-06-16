import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { Tool } from '../tool'

const SubmitResultSchema = z.object({
    result: z.string().describe('The final result to submit.'),
})

export type SubmitResultArguments = z.infer<typeof SubmitResultSchema>

export const submitResult: Tool<typeof SubmitResultSchema, undefined> = {
    name: 'submit_result',
    description: [
        'Submit the final result.',
        'Use this tool when you have completed your task and are ready to provide the final response.',
    ].join(' '),
    schema: SubmitResultSchema,
    enabled: true,
    agentContext: [{ type: 'subagent', required: true }],
    execute: async (_context: ChatContext, _toolUseId: string, _args: SubmitResultArguments) => ({}),
    replay: () => {},
    serialize: (result: { result?: string }) => ({ result: result.result }),
}
