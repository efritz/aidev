import { minimatch } from 'minimatch'
import { ToolUse } from '../../messages/messages'
import { RuleMatcher, RuleMatcherFactory } from '../../rules/types'

export const writeFileOperationMatcher = (toolName: string): RuleMatcherFactory => ({
    parseMatchConfig: (config: Record<string, any>): RuleMatcher => {
        if (typeof config['paths'] !== 'string') {
            throw new Error('file operation matcher requires glob pattern')
        }

        const patterns = config['paths']

        return {
            condition: () => `paths = ${patterns}`,
            matches: (tool: ToolUse): boolean => {
                if (tool.name !== toolName) {
                    return false
                }

                const { path } = JSON.parse(tool.parameters) as { path: string }
                return minimatch(path, patterns, { dot: true, matchBase: true })
            },
        }
    },
})
