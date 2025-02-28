import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent, Tool } from '@anthropic-ai/sdk/resources/messages'
import { enabledTools } from '../../tools/tools'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec, registerModelLimits } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Anthropic'

export const AnthropicProviderFactory = {
    name: providerName,
    create: createAnthropicProviderSpec,
}

export async function createAnthropicProviderSpec(
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
        factory: createAnthropicProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createAnthropicProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = options?.maxTokens || 4096,
        disableTools,
    }: ProviderOptions): Promise<Provider> => {
        const defaultHeaders = options?.headers
        const client = new Anthropic({ apiKey: apiKey, defaultHeaders })
        const modelTracker = tracker.trackerFor(modelName)

        const createStream = createStreamFactory({
            client,
            limiter,
            model,
            system,
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
            createConversation: () => createConversation(contextState),
        })
    }
}

function createStreamFactory({
    client,
    limiter,
    model,
    system,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: Anthropic
    limiter: Limiter
    model: string
    system: string
    temperature?: number
    maxTokens: number
    disableTools?: boolean
}): StreamFactory<MessageStreamEvent, MessageParam> {
    const tools = disableTools
        ? []
        : enabledTools.map(
              ({ name, description, parameters }): Tool => ({
                  name,
                  description,
                  input_schema: parameters,
              }),
          )

    return wrapAsyncIterable(limiter, model, async (messages: MessageParam[], signal?: AbortSignal) =>
        client.messages.stream(
            {
                model,
                system,
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
