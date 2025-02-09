import Groq from 'groq-sdk'
import { ChatCompletionChunk, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'
import { ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { Limiter } from '../../util/ratelimits/limiter'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createGroqProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ProviderSpec> {
    const providerName = 'Groq'
    const apiKey = await getKey(providerName)
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createGroqProvider(providerName, apiKey ?? '', limiter),
    }
}

function createGroqProvider(providerName: string, apiKey: string, limiter: Limiter) {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const client = new Groq({ apiKey })
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
            createStreamReducer,
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
        : toolDefinitions.map(
              ({ name, description, parameters }): ChatCompletionTool => ({
                  type: 'function',
                  function: {
                      name,
                      description,
                      parameters,
                  },
              }),
          )

    return limiter.wrap(model, async (messages, signal) => {
        return client.chat.completions.create(
            {
                model,
                messages,
                stream: true,
                temperature,
                max_tokens: maxTokens,
                tools,
            },
            { signal },
        )
    })
}
