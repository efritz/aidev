import { MetaMessage } from '../messages/messages'
import { Rule } from '../rules/types'

export type RulesManager = ReturnType<typeof createRuleManager>

export function createRuleManager(pushMeta: (message: MetaMessage) => void) {
    const addRules = (rules: Rule[]): void => {
        pushMeta({
            type: 'rule',
            rules: rules.map(({ matcher, ...rest }) => ({
                ...rest,
                condition: matcher.condition(),
            })),
        })
    }

    return {
        addRules,
    }
}
