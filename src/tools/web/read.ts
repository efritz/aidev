import chalk from 'chalk'
import { Agent, runAgent } from '../../agent/agent'
import { withProgress } from '../../util/progress/progress'
import { createXmlPattern } from '../../util/xml/xml'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type WebContent = {
    url: string
    content: string
    links: string[]
}

const headers: Record<string, string> = {}

export const readWeb: Tool<WebContent[]> = {
    name: 'read_web',
    description: ['Read a webpage and summarize its contents.'].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            urls: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target URLs to read.',
                items: {
                    type: JSONSchemaDataType.String,
                    description: 'A target URL.',
                },
            },
        },
        required: ['urls'],
    },
    enabled: true,
    replay: (args: Arguments, { result }: ToolResult<WebContent[]>) => {
        console.log((result ?? []).map(({ url }) => `${chalk.dim('ℹ')} Read "${chalk.red(url)}".`).join('\n'))
    },
    execute: async (
        context: ExecutionContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<WebContent[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { urls } = args as { urls: string[] }

        const signal: AbortSignal | undefined = undefined // TODO

        const summaries = await withProgress<WebContent[]>(
            async () =>
                Promise.all(
                    (await Promise.all(urls.map(url => readUrl(url, signal)))).map(({ url, response, content }) => {
                        if (!response.ok) {
                            throw new Error(`fetch error: ${response.status} ${response.statusText}\n${content}`) // TODO - return error instead
                        } else {
                            return translate(context, url, content)
                        }
                    }),
                ),
            {
                // TODO - better
                progress: () => `Reading "${urls.length} pages..."`,
                success: () => `Read "${urls.length} pages".`,
                failure: () => `Failed to read "${urls.length} pages".`,
            },
        )
        if (!summaries.ok) {
            throw summaries.error
        }

        console.log(summaries.response.map(({ url }) => `${chalk.dim('ℹ')} Read "${chalk.red(url)}".`).join('\n'))
        console.log()

        return { result: summaries.response, reprompt: true }
    },
    serialize: ({ result }: ToolResult<WebContent[]>) => JSON.stringify(result),
}

async function readUrl(
    url: string,
    signal?: AbortSignal,
): Promise<{
    url: string
    response: Response
    content: string
}> {
    const response = await fetch(url, { headers, redirect: 'follow', signal })
    const content = await response.text()
    return { url, response, content }
}

function translate(context: ExecutionContext, url: string, content: string): Promise<WebContent> {
    if (!context.preferences.webTranslatorModel) {
        // TODO - fall back to just including content
        throw new Error('No web translator model specified.')
    }

    return runAgent(context, translatorAgent, { url, content }, undefined)
}

const translatorAgent: Agent<{ url: string; content: string }, WebContent> = {
    model: context => context.preferences.webTranslatorModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async (_, { url, content }) => {
        return userMessageTemplate.replace('{{url}}', url).replace('{{content}}', content)
    },
    processMessage: async (_, content, { url, content: content2 }) => {
        console.log({ content, content2 })
        const contentMatch = createXmlPattern('content').exec(content)
        if (!contentMatch) {
            throw new Error(`Translator did not provide content:\n\n${content}`)
        }

        const linksMatch = createXmlPattern('links').exec(content)
        if (!linksMatch) {
            throw new Error(`Translator did not provide links:\n\n${content}`)
        }

        const links: string[] = []
        const linksBlob = linksMatch[2].trim()
        const linkPattern = createXmlPattern('link')

        while (true) {
            const match = linkPattern.exec(linksBlob)
            if (match === null) {
                break
            }

            links.push(match[2])
        }

        console.log({ url, content: contentMatch[2].trim(), links })

        return {
            url,
            content: contentMatch[2].trim(),
            links,
        }
    },
}

const systemPromptTemplate = `
You are a webpage translator.
You are responsible for reading the content of a webpage and translating it into markdown.
You will be given the URL from which the webpage was read and the raw content of the webpage.

# Response

You should respond with two XML tags:

1. A <links> tag listing the set of all href targets found in the raw content of the webpage.
Each target should be an absolute URL.
There may be targets that are relative to the current page (foo.html, ./foo.html, or ../foo.html) or to the current domain (/foo.html).
Resolve these relative targets in relation to the URL of the current webpage given as input.
Be sure to include all targets from the raw content, including targets found in headers, footers, navigation, and sidebars.
Each target should be supplied within a child <link> tag.

2. A <content> tag including the markdown translation of the webpage.
The markdown translation should maintain the original content hierarchy and formatting of the webpage.
The markdown translation should include only the main content of the webpage, excluding any headers, footers, or sidebars.
If there is no meaningful content, the <content> tag should be empty.

Your response should contain nothing else but these two tags.
`

const userMessageTemplate = `
URL: {{url}}

{{content}}
`
