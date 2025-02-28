import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { ChatCompletionTool } from 'openai/resources'
import { enabledTools } from '../../tools/tools'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Groq'

export const GroqProviderFactory = {
    name: providerName,
    create: createGroqProviderSpec,
}

export async function createGroqProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ProviderSpec> {
    const apiKey = await getKey(providerName)
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createGroqProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createGroqProvider(providerName: string, apiKey: string, limiter: Limiter, tracker: UsageTracker) {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
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

        return createProvider({
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
              ({ name, description, parameters }): ChatCompletionTool => ({
                  type: 'function',
                  function: {
                      name,
                      description,
                      parameters,
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
