import { ToolUse } from '../messages/messages'

export type Rule = {
    description: string
    tool: string
    timing: 'pre' | 'post'
    matcher: RuleMatcher
    body: string
}

export type SerializableRule = Omit<Rule, 'matcher'> & { condition: string }

export interface RuleMatcherFactory {
    parseMatchConfig(config: Record<string, any>): RuleMatcher
}

export interface RuleMatcher {
    condition(): string
    matches(tool: ToolUse): boolean
}
