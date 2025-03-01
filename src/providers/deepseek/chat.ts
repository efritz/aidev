import { Limiter } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { ChatProviderFactory, ChatProviderSpec } from '../chat_provider'
import { getKey } from '../keys'
import { createOpenAICompatibleChatProvider } from '../openai/chat'
import { Preferences } from '../preferences'

const providerName = 'DeepSeek'

export const DeepSeekChatProviderFactory = {
    name: providerName,
    create: createDeepSeekChatProviderSpec,
}

export async function createDeepSeekChatProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ChatProviderSpec> {
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createDeepSeekChatProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

const baseURL = 'https://api.deepseek.com/v1'

function createDeepSeekChatProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ChatProviderFactory {
    return createOpenAICompatibleChatProvider(providerName, apiKey, limiter, tracker, baseURL)
}
