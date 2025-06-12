import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent, Tool } from '@anthropic-ai/sdk/resources/messages'
import { toJsonSchema } from '../../tools/tool'
import { filterTools } from '../../tools/tools'
import { Limiter, wrapAsyncIterable } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import {
    ChatProvider,
    ChatProviderFactory,
    ChatProviderOptions,
    ChatProviderSpec,
    registerModelLimits,
} from '../chat_provider'
import { createChatProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

const providerName = 'Anthropic'

export const AnthropicChatProviderFactory = {
    name: providerName,
    create: createAnthropicChatProviderSpec,
}

async function createAnthropicChatProviderSpec(
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
        factory: createAnthropicChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createAnthropicChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ChatProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = options?.maxTokens || 4096,
        allowedTools,
    }: ChatProviderOptions): Promise<ChatProvider> => {
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
            allowedTools,
        })

        return createChatProvider({
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
    allowedTools,
}: {
    client: Anthropic
    limiter: Limiter
    model: string
    system: string
    temperature?: number
    maxTokens: number
    allowedTools?: string[]
}): StreamFactory<MessageStreamEvent, MessageParam> {
    const tools = filterTools(allowedTools).map(
        ({ name, description, schema }): Tool => ({
            name,
            description,
            input_schema: toJsonSchema(schema),
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
