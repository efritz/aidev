import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { Tool } from '../tool'

const SubmitAnswerSchema = z.object({
    answer: z.string().describe('The final answer or result to submit'),
})

type SubmitAnswerArguments = z.infer<typeof SubmitAnswerSchema>
type SubmitAnswerResult = string

export const submitAnswer: Tool<typeof SubmitAnswerSchema, SubmitAnswerResult> = {
    name: 'submit_answer',
    description: [
        'Submit the final answer or result.',
        'Use this tool when you have completed your task and are ready to provide the final response.',
    ].join(' '),
    schema: SubmitAnswerSchema,
    enabled: true,
    execute: async (_context: ChatContext, _toolUseId: string, { answer }: SubmitAnswerArguments) => ({
        result: answer,
    }),
    replay: () => {},
    serialize: (result: { result?: string }) => ({ result: result.result }),
}
