import { OpenAI } from 'openai'
import { ChatCompletionChunk, ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources'
import { enabledTools } from '../../tools/tools'
import { toIterable } from '../../util/iterable/iterable'
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
import { createStreamReducer, toChunk } from './reducer'

const providerName = 'OpenAI'

export const OpenAIChatProviderFactory = {
    name: providerName,
    create: createOpenAIChatProviderSpec,
}

async function createOpenAIChatProviderSpec(
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
        factory: createOpenAIChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createOpenAIChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ChatProviderFactory {
    return createOpenAICompatibleChatProvider(providerName, apiKey, limiter, tracker)
}

export function createOpenAICompatibleChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
    baseURL?: string,
): ChatProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model, options },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        disableTools,
    }: ChatProviderOptions): Promise<ChatProvider> => {
        const client = new OpenAI({ apiKey, baseURL })
        const modelTracker = tracker.trackerFor(modelName)

        const createStream = createStreamFactory({
            client,
            limiter,
            model,
            temperature: Math.max(temperature, options?.minimumTempature ?? 0),
            maxTokens,
            supportsTools: (options?.supportsTools ?? true) && !disableTools,
            supportsStreaming: options?.supportsStreaming ?? true,
        })

        return createChatProvider({
            providerName,
            modelName,
            system,
            createStream,
            createStreamReducer: () => createStreamReducer(modelTracker),
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
        ? enabledTools.map(
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

    // TODO - signal should return a cancellation error
    return wrapAsyncIterable(limiter, model, async (messages: ChatCompletionMessageParam[], signal?: AbortSignal) => {
        const options = {
            model,
            messages,
            stream: true,
            temperature,
            max_completion_tokens: maxTokens,
            tools,
        }

        return supportsStreaming
            ? client.chat.completions.create(
                  { ...options, stream_options: { include_usage: true }, stream: true },
                  { signal },
              )
            : client.chat.completions
                  .create({ ...options, stream: false }, { signal })
                  .then(toChunk)
                  .then(chunk => toIterable(async () => chunk))
    })
}
