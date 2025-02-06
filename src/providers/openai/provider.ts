import { OpenAI } from 'openai'
import { ChatCompletionChunk, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
import { tools as toolDefinitions } from '../../tools/tools'
import { toIterable } from '../../util/iterable/iterable'
import { Limiter } from '../../util/ratelimits/limiter'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer, toChunk } from './reducer'

export async function createOpenAIProviderSpec(preferences: Preferences, limiter: Limiter): Promise<ProviderSpec> {
    const providerName = 'OpenAI'
    const apiKey = await getKey(providerName)
    const models = preferences.providers[providerName] ?? []
    models.forEach(model => registerModelLimits(limiter, model))

    return {
        providerName,
        models,
        needsAPIKey: !apiKey,
        factory: createOpenAIProvider(providerName, apiKey ?? '', limiter),
    }
}

function createOpenAIProvider(providerName: string, apiKey: string, limiter: Limiter): ProviderFactory {
    return createOpenAICompatibleProvider(providerName, apiKey, limiter)
}

export function createOpenAICompatibleProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    baseURL?: string,
): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const client = new OpenAI({ apiKey, baseURL })
        const createStream = createStreamFactory({
            client,
            limiter,
            model,
            temperature: Math.max(temperature, options?.minimumTempature ?? 0),
            maxTokens,
            supportsTools: (options?.supportsTools ?? true) && !disableTools,
            supportsStreaming: options?.supportsStreaming ?? true,
        })

        return createProvider({
            providerName,
            modelName,
            system,
            createStream,
            createStreamReducer,
            createConversation: () =>
                createConversation(contextState, system, options?.systemMessageRole ?? 'developer'),
        })
    }
}

function createStreamFactory({
    client,
    limiter,
    model,
    temperature,
    maxTokens,
    supportsTools,
    supportsStreaming,
}: {
    client: OpenAI
    limiter: Limiter
    model: string
    temperature?: number
    maxTokens?: number
    supportsTools: boolean
    supportsStreaming: boolean
}): StreamFactory<ChatCompletionChunk, ChatCompletionMessageParam> {
    const tools = supportsTools
        ? toolDefinitions.map(
              ({ name, description, parameters }): ChatCompletionTool => ({
                  type: 'function',
                  function: {
                      name,
                      description,
                      parameters,
                  },
              }),
          )
        : undefined

    return limiter.wrap(model, async (messages, signal) => {
        const options = {
            model,
            messages,
            stream: true,
            temperature,
            max_completion_tokens: maxTokens,
            tools,
        }

        if (!supportsStreaming) {
            return toIterable(async () =>
                toChunk(await client.chat.completions.create({ ...options, stream: false }, { signal })),
            )
        }

        return client.chat.completions.create({ ...options, stream: true }, { signal })
    })
}
