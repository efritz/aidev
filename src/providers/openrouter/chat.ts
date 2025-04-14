import { Limiter } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { ChatProviderFactory, ChatProviderSpec } from '../chat_provider'
import { getKey } from '../keys'
import { createOpenAICompatibleChatProvider } from '../openai/chat'
import { Preferences } from '../preferences'

const providerName = 'OpenRouter'

export const OpenRouterChatProviderFactory = {
    name: providerName,
    create: createOpenRouterChatProviderSpec,
}

async function createOpenRouterChatProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ChatProviderSpec> {
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createOpenRouterChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

const baseURL = 'https://openrouter.ai/api/v1'

function createOpenRouterChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ChatProviderFactory {
    return createOpenAICompatibleChatProvider(providerName, apiKey, limiter, tracker, baseURL)
}
