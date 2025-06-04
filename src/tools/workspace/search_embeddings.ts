import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { indexWorkspace, isIndexUpToDate } from '../../indexing'
import { queryWorkspace } from '../../indexing/query'
import { ExecutionResult, Tool, ToolResult } from '../tool'

let alwaysRefreshWorkspaceIndex = false

const SearchWorkspaceEmbeddingsSchema = z.object({
    query: z.string().describe('The input embeddings search query.'),
})

type SearchWorkspaceEmbeddingsArguments = z.infer<typeof SearchWorkspaceEmbeddingsSchema>

type SearchWorkspaceEmbeddingsResult = {
    matches: Match[]
}

type Match = {
    filename: string
    names?: string[]
}

export const searchWorkspaceEmbeddings: Tool<typeof SearchWorkspaceEmbeddingsSchema, SearchWorkspaceEmbeddingsResult> =
    {
        name: 'search_workspace_embeddings',
        description: [
            'Use an embeddings index of the current workspace to find matching content against an input query.',
            'The tool result will contain a set of filenames matching the input query.',
            'For source code files, the result will also contain the names of the relevant components from the matching file.',
        ].join(' '),
        schema: SearchWorkspaceEmbeddingsSchema,
        enabled: true,
        replay: (
            { query }: SearchWorkspaceEmbeddingsArguments,
            { result }: ToolResult<SearchWorkspaceEmbeddingsResult>,
        ) => {
            console.log(`${chalk.dim('ℹ')} Queried workspace embeddings index for "${query}".`)
            console.log()
            displayMatches(result?.matches ?? [])
        },
        execute: async (
            context: ChatContext,
            toolUseId: string,
            { query }: SearchWorkspaceEmbeddingsArguments,
        ): Promise<ExecutionResult<SearchWorkspaceEmbeddingsResult>> => {
            if (!toolUseId) {
                throw new Error('No ToolUseId supplied.')
            }

            console.log(`${chalk.dim('ℹ')} Querying workspace embeddings index for "${query}"...`)
            console.log()

            if (!(await isIndexUpToDate(context))) {
                if (alwaysRefreshWorkspaceIndex) {
                    await indexWorkspace(context)
                } else {
                    console.log(chalk.red.bold('Workspace index is stale.'))

                    const choice = await context.prompter.choice(`Update workspace index?`, [
                        { name: 'y', description: 'yes' },
                        { name: 'n', description: 'no', isDefault: true },
                        { name: 'a', description: 'automatically refresh workspace index when stale for this session' },
                    ])

                    switch (choice) {
                        // @ts-expect-error: intentional fallthrough
                        case 'a':
                            alwaysRefreshWorkspaceIndex = true
                            console.log(`${chalk.green('✓')} Automatic index refreshes enabled for this session`)

                        case 'y':
                            await indexWorkspace(context)
                            break
                    }
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
            console.log()

            return { result: { matches }, reprompt: true }
        },
        serialize: ({ result }: ToolResult<SearchWorkspaceEmbeddingsResult>) => ({ result: { paths: result ?? [] } }),
    }

function displayMatches(matches: Match[]) {
    if (matches.length === 0) {
        console.log(`${chalk.dim('ℹ')} No files found in the workspace embeddings index matching the query.`)
    } else {
        for (const [i, { filename, names }] of matches.entries()) {
            if (names) {
                console.log(`#${(i + 1).toString().padStart(2, '0')}: Found matching file "${chalk.red(filename)}":`)

                for (const name of names) {
                    console.log(`     - "${chalk.red(name)}"`)
                }
            } else {
                console.log(`#${(i + 1).toString().padStart(2, '0')}: Found matching file "${chalk.red(filename)}".`)
            }
        }
    }
}
