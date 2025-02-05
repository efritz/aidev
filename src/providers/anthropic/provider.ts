import { Anthropic } from '@anthropic-ai/sdk'
import { MessageParam, MessageStreamEvent, Tool } from '@anthropic-ai/sdk/resources/messages'
import { tools as toolDefinitions } from '../../tools/tools'
import { createProvider, StreamFactory } from '../factory'
import { getKey } from '../keys'
import { Preferences } from '../preferences'
import { Provider, ProviderFactory, ProviderOptions, ProviderSpec } from '../provider'
import { createConversation } from './conversation'
import { createStreamReducer } from './reducer'

export async function createAnthropicProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'Anthropic'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createAnthropicProvider(providerName, apiKey ?? ''),
    }
}

function createAnthropicProvider(providerName: string, apiKey: string): ProviderFactory {
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
        const createStream = createStreamFactory({
            client,
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
            createStreamReducer,
            createConversation: () => createConversation(contextState),
        })
    }
}

function createStreamFactory({
    client,
    model,
    system,
    temperature,
    maxTokens,
    disableTools,
}: {
    client: Anthropic
    model: string
    system: string
    temperature?: number
    maxTokens: number
    disableTools?: boolean
}): StreamFactory<MessageStreamEvent, MessageParam> {
    const tools = disableTools
        ? []
        : toolDefinitions.map(
              ({ name, description, parameters }): Tool => ({
                  name,
                  description,
                  input_schema: parameters,
              }),
          )

    return async (messages, signal) => {
        return client.messages.stream(
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
        )
    }
}
