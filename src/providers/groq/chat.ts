import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { ChatCompletionTool } from 'openai/resources'
import { toJsonSchema } from '../../tools/tool'
import { enabledTools } from '../../tools/tools'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { ChatProvider, ChatProviderOptions, ChatProviderSpec, registerModelLimits } from '../chat_provider'
import { createChatProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Groq'

export const GroqChatProviderFactory = {
    name: providerName,
    create: createGroqChatProviderSpec,
}

async function createGroqChatProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ChatProviderSpec> {
    const apiKey = await getKey(providerName)
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createGroqChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createGroqChatProvider(providerName: string, apiKey: string, limiter: Limiter, tracker: UsageTracker) {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ChatProviderOptions): Promise<ChatProvider> => {
        const client = new Groq({ apiKey })
        const modelTracker = tracker.trackerFor(modelName)

        const createStream = createStreamFactory({
            client,
            limiter,
            model,
            temperature,
            maxTokens,
            disableTools,
        })

        return createChatProvider({
            providerName,
            modelName,
            system,
            createStream,
            createStreamReducer: () => createStreamReducer(modelTracker),
            createConversation: () => createConversation(contextState, system),
        })
    }
}

function createStreamFactory({
    client,
    limiter,
    model,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: Groq
    limiter: Limiter
    model: string
    temperature?: number
    maxTokens?: number
    disableTools?: boolean
}): StreamFactory<ChatCompletionChunk, ChatCompletionMessageParam> {
    const tools = disableTools
        ? []
        : enabledTools.map(
              ({ name, description, schema }): ChatCompletionTool => ({
                  type: 'function',
                  function: {
                      name,
                      description,
                      parameters: toJsonSchema(schema),
                  },
              }),
          )

    return wrapAsyncIterable(limiter, model, async (messages: ChatCompletionMessageParam[], signal?: AbortSignal) =>
        client.chat.completions.create(
            {
                model,
                messages,
                stream: true,
                temperature,
                max_tokens: maxTokens,
                tools,
            },
            { signal },
        ),
    )
}
