import { ChatContext } from '../chat/context'
import { Rule as SerializableRule, ToolUse } from '../messages/messages'
import { hash } from '../util/hash/hash'
import { Rule } from './types'

export function matchNewPreInvocationRules(context: ChatContext, tools: ToolUse[]): Rule[] {
    return matchNewInvocationRules(context, tools, 'pre')
}

export function matchNewPostInvocationRules(context: ChatContext, tools: ToolUse[]): Rule[] {
    return matchNewInvocationRules(context, tools, 'post')
}

function matchNewInvocationRules(context: ChatContext, tools: ToolUse[], timing: string): Rule[] {
    const visibleRuleHashes = context.provider.conversationManager
        .visibleMessages()
        .filter(m => m.type === 'rule')
        .flatMap(m => m.rules)
        .map(r => hashRule(r))

    return context.rules
        .filter(rule => rule.timing === timing)
        .filter(rule => tools.some(tool => rule.matcher.matches(tool)))
        .filter(r => !visibleRuleHashes.includes(hashRule(r)))
}

export function findMatchingRule(rules: Rule[], target: SerializableRule): Rule | undefined {
    return rules.find(r => hashRule(r) === hashRule(target))
}

function hashRule(rule: Rule | SerializableRule): string {
    return hash(
        [
            rule.description,
            rule.tool,
            rule.timing,
            'condition' in rule ? rule.condition : rule.matcher.condition(),
        ].join('::'),
    )
}
