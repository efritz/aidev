import {
    Content,
    EnhancedGenerateContentResponse,
    FunctionDeclaration,
    FunctionDeclarationSchema,
    GoogleGenerativeAI,
} from '@google/generative-ai'
import { AgentType, toJsonSchema } from '../../tools/tool'
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

const providerName = 'Google'

export const GoogleChatProviderFactory = {
    name: providerName,
    create: createGoogleChatProviderSpec,
}

async function createGoogleChatProviderSpec(
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
        factory: createGoogleChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

function createGoogleChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ChatProviderFactory {
    return async ({
        contextState,
        model: { name: modelName, model },
        system,
        temperature = 0.0,
        maxTokens = 4096,
        allowedTools,
        agentType,
    }: ChatProviderOptions): Promise<ChatProvider> => {
        const client = new GoogleGenerativeAI(apiKey)
        const modelTracker = tracker.trackerFor(modelName)

        const createStream = createStreamFactory({
            client,
            limiter,
            model,
            system,
            temperature,
            maxTokens,
            allowedTools,
            agentType,
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
    agentType,
}: {
    client: GoogleGenerativeAI
    limiter: Limiter
    model: string
    system: string
    temperature?: number
    maxTokens?: number
    allowedTools?: string[]
    agentType: AgentType
}): StreamFactory<EnhancedGenerateContentResponse, Content> {
    const tools = [
        {
            functionDeclarations: filterTools(allowedTools, agentType).map(
                ({ name, description, schema }): FunctionDeclaration => ({
                    name,
                    description,
                    parameters: toJsonSchema(schema) as FunctionDeclarationSchema,
                }),
            ),
        },
    ]

    return wrapAsyncIterable(limiter, model, async (messages: Content[], signal?: AbortSignal) => {
        const m = client.getGenerativeModel({
            model,
            systemInstruction: system,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
            tools,
        })

        const { response, stream } = await m.generateContentStream({ contents: messages }, { signal })
        response.catch(() => {}) // Prevent uncaught exceptions during streaming
        return stream
    })
}
