import chalk from 'chalk'
import { AssistantMessage } from '../messages/messages'
import { createXmlPartialClosingTagPattern, createXmlPartialOpeningTagPattern, createXmlPattern } from '../util/xml/xml'

const partialTagPatterns = ['thought'].flatMap(name => [
    createXmlPartialOpeningTagPattern(name),
    createXmlPartialClosingTagPattern(name),
])

const formattedPatterns = [
    {
        pattern: createXmlPattern('thought'),
        formatter: (_openingTag: string, content: string, _closingTag: string) => {
            return chalk.italic.grey(content.trim())
        },
    },
]

export function formatMessage(message: AssistantMessage): string {
    if (message.type === 'text') {
        let content = message.content.trim()

        // Remove opening and closing tags that haven't been completely omitted.
        // This stops us from "flashing" tags that will be removed once completed.
        // This also helps us deal with an easier pattern in the next steps where
        // we want to colorize partial output that doesn't yet have a closing tag.
        partialTagPatterns.forEach(pattern => {
            content = content.replace(pattern, '')
        })

        // Colorize finished or partially opened blocks
        formattedPatterns.forEach(({ pattern, formatter }) => {
            content = content.replace(pattern, (_, openTag, content, closingTag) =>
                formatter(openTag, content, closingTag),
            )
        })

        // Colorize all other output as cyan
        return chalk.cyan(content)
    }

    return ''
}
