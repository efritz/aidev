export interface UsageTracker {
    all(): ModelUsage[]
    trackerFor(modelName: string): ModelTracker
}

export interface ModelTracker {
    add(usage: Partial<Usage>): void
}

export type ModelUsage = {
    modelName: string
    usage: Usage
}

export type Usage = {
    inputTokens: number
    outputTokens: number
}

export function createUsageTracker(): UsageTracker {
    const usageByModelName = new Map<string, Usage>()

    const getOrCreateUsage = (modelName: string): Usage => {
        const usage = usageByModelName.get(modelName)
        if (usage) {
            return usage
        }

        const newUsage = { inputTokens: 0, outputTokens: 0 }
        usageByModelName.set(modelName, newUsage)
        return newUsage
    }

    return {
        all: () => [...usageByModelName.entries()].map(([modelName, usage]) => ({ modelName, usage })),
        trackerFor: modelName => ({
            add: newUsage => {
                const usage = getOrCreateUsage(modelName)
                usage.inputTokens += newUsage.inputTokens ?? 0
                usage.outputTokens += newUsage.outputTokens ?? 0
            },
        }),
    }
}
