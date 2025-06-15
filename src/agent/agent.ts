import { ChatContext } from '../chat/context'
import { runToolsInResponse } from '../chat/tools'
import { createContextState } from '../context/state'
import { Response } from '../messages/messages'
import { filterTools } from '../tools/tools'
import { withProgress } from '../util/progress/progress'

export interface Agent<T, R> {
    model(context: ChatContext): string
    allowedTools(): string[]
    quiet(): boolean
    buildSystemPrompt(context: ChatContext, args: T): Promise<string>
    buildUserMessage(context: ChatContext, args: T): Promise<string>
    processResult(context: ChatContext, result: string, args: T): Promise<R>
}

export async function runAgent<T, R>(
    context: ChatContext,
    agent: Agent<T, R>,
    args: T,
    _signal?: AbortSignal, // TODO - use
): Promise<R> {
    const modelName = agent.model(context)
    const tools = filterTools(agent.allowedTools(), 'subagent').map(tool => tool.name)
    const quiet = agent.quiet()

    // TODO - rewrite existing agent system prompts
    // TODO - restructure system prompt around this a bit
    const epilogue = [
        'When submitting a final response, use the submit_result tool.',
        'Do not submit a final response via text.',
        'If you do not use this tool, the coordinator will keep reprompting you and may cause an endless loop.',
    ].join(' ')

    const system = (await agent.buildSystemPrompt(context, args)) + '\n\n' + epilogue
    const userMessage = await agent.buildUserMessage(context, args)
    const contextStateManager = await createContextState()

    const provider = await context.providers.createProvider({
        contextState: contextStateManager,
        modelName,
        system,
        allowedTools: tools,
        agentType: 'subagent',
    })

    const subContext: ChatContext = {
        ...context,
        provider,
        contextStateManager,
        tools,
    }

    try {
        subContext.provider.conversationManager.pushUser({
            type: 'text',
            content: userMessage,
        })

        const result = await subContext.interruptHandler.withInterruptHandler(async signal => {
            // TODO - maximum runtime
            // TODO - maximum number of iterations

            while (true) {
                const response = quiet
                    ? await subContext.provider.prompt(() => {}, signal)
                    : await (async () => {
                          // TODO - make this better
                          const response2 = await withProgress<Response>(
                              progress => subContext.provider.prompt(progress, signal),
                              {
                                  progress: snapshot => `progress (${JSON.stringify(snapshot)})`,
                                  success: snapshot => `success (${JSON.stringify(snapshot)})`,
                                  failure: snapshot => `failure (${JSON.stringify(snapshot)})`,
                              },
                          )
                          if (!response2.ok) {
                              throw new Error('NOT OK')
                          }
                          return response2.response
                      })()

                await runToolsInResponse(subContext, response, signal)

                // TODO - validate somehow?
                const submitAnswerUse = response.messages
                    .flatMap(m => (m.type !== 'tool_use' ? [] : m.tools))
                    .find(tool => tool.name === 'submit_result')
                if (submitAnswerUse) {
                    const { result } = JSON.parse(submitAnswerUse.parameters) as { result: string }
                    return result
                }
            }
        })

        return await agent.processResult(subContext, result, args)
    } finally {
        contextStateManager.dispose()
    }
}
