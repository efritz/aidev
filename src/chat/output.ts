import chalk from 'chalk'
import { AssistantMessage } from '../messages/messages'

export function formatMessage(message: AssistantMessage): string {
    if (message.type === 'text') {
        const content = message.content.trim()
        if (content) {
            return chalk.cyan(content)
        }
    }

    return ''
}
