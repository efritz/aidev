import chalk from 'chalk'
import { AssistantMessage, Response } from '../messages/messages'
import { prefixFormatter, ProgressResult, withProgress } from '../util/progress/progress'
import { createXmlPartialClosingTagPattern, createXmlPartialOpeningTagPattern } from '../util/xml/xml'
import { ChatContext } from './context'

export type Prefixes = {
    progressPrefix: string
    successPrefix: string
    failurePrefix: string
}

export function promptWithPrefixes(
    context: ChatContext,
    { progressPrefix, successPrefix, failurePrefix }: Prefixes,
    signal?: AbortSignal,
): Promise<ProgressResult<Response>> {
    const formatResponse = (r?: Response): string =>
        (r?.messages || [])
            .map(formatMessage)
            .filter(message => message !== '')
            .join('\n\n')

    return withProgress<Response>(progress => context.provider.prompt(progress, signal), {
        progress: prefixFormatter(progressPrefix, formatResponse),
        success: prefixFormatter(successPrefix, formatResponse),
        failure: prefixFormatter(failurePrefix, formatResponse),
    })
}

const partialTagPatterns: RegExp[] = [
    /* Currently empty */
].flatMap(name => [createXmlPartialOpeningTagPattern(name), createXmlPartialClosingTagPattern(name)])

const formattedPatterns: {
    pattern: RegExp
    formatter: (openingTag: string, content: string, closingTag: string) => string
}[] = [
    /* Currently empty */
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
