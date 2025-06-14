import EventEmitter from 'events'
import { ChatContext } from '../chat/context'
import { promptWithPrefixes } from '../chat/output'
import { runToolsInResponse } from '../chat/tools'
import { createContextState } from '../context/state'
import { Response } from '../messages/messages'
import { filterTools } from '../tools/tools'
import { CancelError } from '../util/interrupts/interrupts'
import { withProgress } from '../util/progress/progress'

export interface Agent<T, R> {
    model(context: ChatContext): string
    allowedTools(): string[]
    quiet(): boolean
    buildSystemPrompt(context: ChatContext, args: T): Promise<string>
    buildUserMessage(context: ChatContext, args: T): Promise<string>
    processMessage(context: ChatContext, submittedAnswer: string, args: T): Promise<R>
}

export async function runAgent<T, R>(
    context: ChatContext,
    agent: Agent<T, R>,
    args: T,
    signal?: AbortSignal, // TODO - use
): Promise<R> {
    const modelName = agent.model(context)
    const tools = filterTools(Array.from(new Set([...agent.allowedTools(), 'submit_result']))).map(tool => tool.name)
    const quiet = agent.quiet()

    // TODO - restructure system prompt around this a bit
    const epilogue = 'When submitting a response, use the submit_result tool.'
    const system = (await agent.buildSystemPrompt(context, args)) + '\n\n' + epilogue
    const userMessage = await agent.buildUserMessage(context, args)

    const contextStateManager = await createContextState()

    const provider = await context.providers.createProvider({
        contextState: contextStateManager,
        modelName,
        system,
        allowedTools: tools,
    })

    const subContext: ChatContext = {
        ...context,
        provider,
        contextStateManager,
        tools,

        events: new EventEmitter(), // TODO - independent?
    }

    try {
        subContext.provider.conversationManager.pushUser({
            type: 'text',
            content: userMessage,
        })

        const submittedAnswer = await subContext.interruptHandler.withInterruptHandler(async signal => {
            let submittedAnswer: string | undefined

            while (!submittedAnswer) {
                const response = quiet
                    ? await subContext.provider.prompt(() => {}, signal)
                    : await (async () => {
                          const response2 = await withProgress<Response>(
                              progress => subContext.provider.prompt(progress, signal),
                              {
                                  progress: () => 'progress',
                                  success: () => 'success',
                                  failure: () => 'failure',
                              },
                          )
                          if (!response2.ok) {
                              throw new Error('NOT OK')
                          }
                          return response2.response
                      })()

                const submitAnswerUse = response.messages
                    .flatMap(m => (m.type !== 'tool_use' ? [] : m.tools))
                    .find(tool => tool.name === 'submit_result')

                if (submitAnswerUse) {
                    const params = submitAnswerUse.parameters ? JSON.parse(submitAnswerUse.parameters) : {}
                    submittedAnswer = params.answer
                }

                const shouldReprompt = await runToolsInResponse(subContext, response, signal)

                if (submittedAnswer) {
                    break
                }

                if (!shouldReprompt) {
                    // throw new Error('Agent completed without submitting an answer')
                }
            }

            return submittedAnswer
        })

        return await agent.processMessage(subContext, submittedAnswer, args)
        // } catch (error: any) {
        //     if (signal?.aborted) {
        //         throw new CancelError('Agent aborted.')
        //     }
        //     throw error
    } finally {
        contextStateManager.dispose()
    }
}
