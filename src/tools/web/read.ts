import chalk from 'chalk'
import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { prefixFormatter, withProgress } from '../../util/progress/progress'
import { createXmlPattern } from '../../util/xml/xml'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type WebResult = {
    url: string
    error?: string
    summary?: Summary
}

type Summary = {
    content: string
    links: string[]
}

type State = {
    url: string
    response?: Errorable<ResponseAndContent>
    summary?: Errorable<Summary>
}

type Errorable<T> = Partial<T> & { error?: Error }

type ResponseAndContent = {
    response: Response
    content: string
}

const headers: Record<string, string> = {}

export const readWeb: Tool<WebResult[]> = {
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
    replay: (_args: Arguments, { result }: ToolResult<WebResult[]>) => {
        console.log(`${chalk.green('✔')} Read ${result?.length ?? 0} pages.`)
        console.log()
        console.log(
            (result ?? [])
                .map(
                    ({ url, error }) =>
                        `${error ? chalk.red('✖') : chalk.green('✔')} ${error ? 'Failed to read' : 'Read'} "${chalk.red(url)}".`,
                )
                .join('\n'),
        )
    },
    execute: async (
        context: ChatContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<WebResult[]>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { urls } = args as { urls: string[] }

        const error = (...erroables: (Errorable<any> | undefined)[]) =>
            erroables.find(erroable => erroable?.error)?.error

        const icon = (response?: Errorable<ResponseAndContent>, summary?: Errorable<Summary>) =>
            error(response, summary) ? chalk.red('✖') : summary ? chalk.green('✔') : chalk.dim('ℹ')

        const verb = (response?: Errorable<ResponseAndContent>, summary?: Errorable<Summary>) =>
            error(response, summary) ? 'Failed to read' : summary ? 'Read' : response ? 'Summarizing' : 'Reading'

        const formatOutput = (snapshot?: State[]) =>
            (snapshot ?? [])
                .map(
                    ({ url, response, summary }) =>
                        `${icon(response, summary)} ${verb(response, summary)} "${chalk.red(url)}".`,
                )
                .join('\n')

        const summaries = await context.interruptHandler.withInterruptHandler(signal =>
            withProgress<State[]>(
                async update => {
                    const state = new Map<string, State>()
                    const values = () => [...state.values()].sort((a, b) => a.url.localeCompare(b.url))

                    const readOne = async (url: string) => {
                        state.set(url, { url })
                        update(values())

                        const response = await readUrl(url, signal)
                        state.set(url, { url, response })
                        update(values())

                        if (!response.error) {
                            const summary = await translate(context, url, response.content ?? '', signal)
                            state.set(url, { url, response, summary })
                            update(values())
                        }
                    }

                    await Promise.all(urls.map(readOne))
                    return values()
                },
                {
                    progress: prefixFormatter(`Reading ${urls.length} pages...`, formatOutput),
                    success: prefixFormatter(`Read ${urls.length} pages.`, formatOutput),
                    failure: prefixFormatter(`Failed to read ${urls.length} pages.`, formatOutput),
                },
            ),
        )
        if (!summaries.ok) {
            throw summaries.error
        }

        return {
            result: summaries.response.map(({ url, response, summary }) => ({
                url,
                error: error(response, summary)?.message,
                summary:
                    summary && !summary.error
                        ? { content: summary.content ?? '', links: summary.links ?? [] }
                        : undefined,
            })),
            reprompt: true,
        }
    },
    serialize: ({ result }: ToolResult<WebResult[]>) => JSON.stringify(result),
}

async function readUrl(url: string, signal?: AbortSignal): Promise<Errorable<ResponseAndContent>> {
    try {
        const response = await fetch(url, {
            headers,
            redirect: 'follow',
            signal,
        })

        const content = await response.text()
        return { response, content }
    } catch (error: any) {
        return { error }
    }
}

async function translate(
    context: ChatContext,
    url: string,
    content: string,
    signal?: AbortSignal,
): Promise<Errorable<Summary>> {
    try {
        return await runAgent(context, translatorAgent, { url, content }, signal)
    } catch (error: any) {
        return { error }
    }
}

const translatorAgent: Agent<{ url: string; content: string }, Summary> = {
    model: context => context.preferences.webTranslatorModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async (_, { url, content }) => {
        return userMessageTemplate.replace('{{url}}', url).replace('{{content}}', content)
    },
    processMessage: async (_, content) => {
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

        return {
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
