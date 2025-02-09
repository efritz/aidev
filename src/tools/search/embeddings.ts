import chalk from 'chalk'
import { indexWorkspace, isIndexUpToDate } from '../../embeddings/workspace'
import { queryWorkspace } from '../../embeddings/workspace/query'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type SearchResult = {
    matches: Match[]
}

type Match = {
    filename: string
    names?: string[]
}

export const searchWorkspace: Tool<SearchResult> = {
    name: 'search_workspace',
    description: [
        'Use an embeddings index of the current workspace to find matching content against an input query.',
        'The tool result will contain a set of filenames matching the input query.',
        'For source code files, the result will also contain the names of the relevant components from the matching file.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            query: {
                type: JSONSchemaDataType.String,
                description: 'The input embeddings search query.',
            },
        },
        required: ['query'],
    },
    replay: (args: Arguments, { result }: ToolResult<SearchResult>) => {
        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Queried workspace index for "${query}".`)
        displayMatches(result?.matches ?? [])
    },
    execute: async (
        context: ExecutionContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<SearchResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Querying workspace index for "${query}"...`)

        if (!(await isIndexUpToDate(context))) {
            console.log(chalk.red.bold('Workspace index is stale.'))

            const choice = await context.prompter.choice(`Update workspace index?`, [
                { name: 'y', description: 'yes' },
                { name: 'n', description: 'no', isDefault: true },
            ])

            if (choice === 'y') {
                await indexWorkspace(context)
            }
        }

        const protoMatches: {
            filename: string
            names: string[]
        }[] = []

        for (const chunk of await queryWorkspace(context, query)) {
            let pair = protoMatches.find(t => t.filename === chunk.filename)
            if (!pair) {
                pair = { filename: chunk.filename, names: [] }
                protoMatches.push(pair)
            }

            pair.names.push(chunk.name ?? '')
        }

        const matches = protoMatches.map(({ filename, names }) => ({
            filename,
            names: !names.includes('') ? names : undefined,
        }))

        displayMatches(matches)
        return { result: { matches }, reprompt: true }
    },
    serialize: ({ result }: ToolResult<SearchResult>) => JSON.stringify({ paths: result ?? [] }),
}

function displayMatches(matches: Match[]) {
    if (matches.length === 0) {
        console.log(`${chalk.dim('ℹ')} No files found in the workspace embeddings index matching the query.`)
    } else {
        for (const { filename, names } of matches) {
            if (names) {
                console.log(`${chalk.dim('ℹ')} Found matching file "${chalk.red(filename)}":`)

                for (const name of names) {
                    console.log(`\t- "${chalk.red(name)}"`)
                }
            } else {
                console.log(`${chalk.dim('ℹ')} Found matching file "${chalk.red(filename)}".`)
            }
        }
    }
}
