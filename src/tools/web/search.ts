import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { getKey } from '../../providers/keys'
import { withProgress } from '../../util/progress/progress'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const SearchWebSchema = z.object({
    query: z.string().describe('The input search query.'),
})

type SearchWebArguments = z.infer<typeof SearchWebSchema>

type SearchWebResult = {
    matches: Match[]
}

type Match = {
    name: string
    title: string
    url: string
    description: string
}

type BraveResponse = {
    web: {
        results: {
            title: string
            url: string
            description: string
            profile: { name: string }
            meta_url: { path: string }
        }[]
    }
}

const braveApiKey = await getKey('brave')
const braveUrl = 'https://api.search.brave.com/res/v1/web/search'
const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip',
    'X-Subscription-Token': braveApiKey || '',
}

export const searchWeb: Tool<typeof SearchWebSchema, SearchWebResult> = {
    name: 'search_web',
    description: ['Use a search engine to find web pages matching an input query.'].join(' '),
    schema: SearchWebSchema,
    enabled: !!braveApiKey,
    replay: ({ query }: SearchWebArguments, { result }: ToolResult<SearchWebResult>) => {
        console.log(`${chalk.dim('ℹ')} Searched web for "${query}".`)
        console.log()
        displayMatches(result?.matches ?? [])
    },
    execute: async (
        _context: ChatContext,
        toolUseId: string,
        { query }: SearchWebArguments,
    ): Promise<ExecutionResult<SearchWebResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }
        if (!braveApiKey) {
            throw new Error('Brave API key is not defined.')
        }

        const resp = await withProgress<BraveResponse>(
            async () => {
                const url = new URL(braveUrl)
                url.searchParams.set('q', query)
                url.searchParams.set('count', '20')
                url.searchParams.set('offset', '0')

                const response = await fetch(url.toString(), { headers })
                if (!response.ok) {
                    throw new Error(
                        `Brave API error: ${response.status} ${response.statusText}\n${await response.text()}`,
                    )
                }

                return (await response.json()) as BraveResponse
            },
            {
                progress: () => `Searching web for "${query}..."`,
                success: () => `Searched web for "${query}".`,
                failure: () => `Failed to search web for "${query}".`,
            },
        )

        if (!resp.ok) {
            throw resp.error
        }

        const matches = resp.response.web.results.map(result => ({
            title: result.title,
            name: (result.profile.name + ' ' + result.meta_url.path.replaceAll(/\s+/g, ' ').trimStart()).trimEnd(),
            url: result.url,
            description: result.description,
        }))

        displayMatches(matches)
        console.log()

        return { result: { matches }, reprompt: true }
    },
    serialize: ({ result }: ToolResult<SearchWebResult>) => ({ result }),
}

function displayMatches(matches: Match[]) {
    if (matches.length === 0) {
        console.log(`${chalk.dim('ℹ')} No results match the query.`)
    } else {
        for (const [i, match] of matches.entries()) {
            console.log(
                `#${(i + 1).toString().padStart(2, '0')}: ${chalk.red(match.title)}\n     ${chalk.dim(`from ${match.name}`)}`,
            )
        }
    }
}
