import { getKey } from '../keys'
import { createOpenAICompatibleProvider } from '../openai/provider'
import { Preferences } from '../preferences'
import { ProviderFactory, ProviderSpec } from '../provider'

export async function createDeepSeekProviderSpec(preferences: Preferences): Promise<ProviderSpec> {
    const providerName = 'DeepSeek'
    const apiKey = await getKey(providerName)

    return {
        providerName,
        models: preferences.providers[providerName] ?? [],
        needsAPIKey: !apiKey,
        factory: createDeepSeekProvider(providerName, apiKey ?? ''),
    }
}

const baseURL = 'https://api.deepseek.com/v1'

function createDeepSeekProvider(providerName: string, apiKey: string): ProviderFactory {
    return createOpenAICompatibleProvider(providerName, apiKey, baseURL)
}
