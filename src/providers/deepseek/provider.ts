import { Limiter } from '../../util/ratelimits/limiter'
import { UsageTracker } from '../../util/usage/tracker'
import { getKey } from '../keys'
import { createOpenAICompatibleProvider } from '../openai/provider'
import { Preferences } from '../preferences'
import { ProviderFactory, ProviderSpec } from '../provider'

const providerName = 'DeepSeek'

export const DeepSeekProviderFactory = {
    name: providerName,
    create: createDeepSeekProviderSpec,
}

export async function createDeepSeekProviderSpec(
    preferences: Preferences,
    limiter: Limiter,
    tracker: UsageTracker,
): Promise<ProviderSpec> {
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createDeepSeekProvider(providerName, apiKey ?? '', limiter, tracker),
    }
}

const baseURL = 'https://api.deepseek.com/v1'

function createDeepSeekProvider(
    providerName: string,
    apiKey: string,
    limiter: Limiter,
    tracker: UsageTracker,
): ProviderFactory {
    return createOpenAICompatibleProvider(providerName, apiKey, limiter, tracker, baseURL)
}
