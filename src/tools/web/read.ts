import chalk from 'chalk'
import { Agent, runAgent } from '../../agent/agent'
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

        // TODO - progress here

        const summaries = await Promise.all(
            (await Promise.all(urls.map(readUrl))).map(({ url, response, content }) => {
                if (!response.ok) {
                    throw new Error(`fetch error: ${response.status} ${response.statusText}\n${content}`) // TODO - return error instead
                } else {
                    return translate(context, url, content)
                }
            }),
        )

        console.log(summaries.map(({ url }) => `${chalk.dim('ℹ')} Read "${chalk.red(url)}".`).join('\n'))
        console.log()

        return { result: summaries, reprompt: true }
    },
    serialize: ({ result }: ToolResult<WebContent[]>) => JSON.stringify(result),
}

async function readUrl(url: string): Promise<{
    url: string
    response: Response
    content: string
}> {
    const response = await fetch(url, { headers })
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
    processMessage: async (_, content, { url }) => {
        const contentMatch = createXmlPattern('content').exec(content)
        if (!contentMatch) {
            throw new Error(`Translator did not provide content:\n\n${content}`)
        }

        const linksMatch = createXmlPattern('links').exec(content)
        if (!linksMatch) {
            throw new Error(`Translator did not provide links:\n\n${content}`)
        }

        console.log({
            text: linksMatch[2].trim(),
            linkMatches: matchAll(linksMatch[2].trim(), createXmlPattern('link')),
        })

        return {
            url,
            content: contentMatch[2].trim(),
            links: matchAll(linksMatch[2].trim(), createXmlPattern('link')),
        }
    },
}

function matchAll(text: string, pattern: RegExp): string[] {
    const matches: string[] = []

    while (true) {
        const match = pattern.exec(text)
        if (match === null) {
            break
        }

        matches.push(match[2])
    }

    return matches
}

const systemPromptTemplate = `
You are a webpage translator.
You are responsible for reading the content of a webpage and translating it into markdown.
You will be given the URL from which the webpage was read and the content of the webpage.

# Response

You should respond with two XML tags:

1. A <content> tag including the markdown translation of the webpage.
The markdown translation should maintain the original content hierarchy and formatting of the webpage.
The markdown translation should include only the main content of the webpage, excluding any headers, footers, or sidebars.

2. A <links> tag enumerating the set of unique URLs found in the original content.
Each URL should be supplied within a child <link> tag.
Each URL should be absolute - if the original URL is relative, you should resolve it relative to the webpage URL.

Your response should contain nothing else but these two tags.
`

const userMessageTemplate = `
URL: {{url}}

{{content}}
`
