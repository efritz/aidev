import { Rule as SerializableRule, ToolUse } from '../messages/messages'

export type Rule = Omit<SerializableRule, 'condition'> & { matcher: RuleMatcher }

export interface RuleMatcherFactory {
    parseMatchConfig(config: Record<string, any>): RuleMatcher
}

export interface RuleMatcher {
    condition(): string
    matches(tool: ToolUse): boolean
}
