import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { Tool } from '../tool'

const SubmitResultSchema = z.object({
    result: z.string().describe('The final result to submit.'),
})

type SubmitResultArguments = z.infer<typeof SubmitResultSchema>
type SubmitResultResult = string

export const submitResult: Tool<typeof SubmitResultSchema, SubmitResultResult> = {
    name: 'submit_result',
    description: [
        'Submit the final result.',
        'Use this tool when you have completed your task and are ready to provide the final response.',
    ].join(' '),
    schema: SubmitResultSchema,
    enabled: true,
    agentContext: [{ type: 'subagent', required: true }],
    execute: async (_context: ChatContext, _toolUseId: string, { result }: SubmitResultArguments) => ({
        result,
    }),
    replay: () => {},
    serialize: (result: { result?: string }) => ({ result: result.result }),
}
