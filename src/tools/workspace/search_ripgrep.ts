import { execSync } from 'child_process'
import * as path from 'path'
import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type SearchResult = {
    matches: Match[]
}

type Match = {
    filename: string
    lines?: string[]
}

export const searchWorkspaceRipgrep: Tool<SearchResult> = {
    name: 'search_workspace_ripgrep',
    description: [
        'Use ripgrep to search the current workspace for files containing the input query.',
        'The tool result will contain a set of filenames matching the input query.',
        'For source code files, the result will also contain the matching lines from the file.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            query: {
                type: JSONSchemaDataType.String,
                description: 'The input search query.',
            },
        },
        required: ['query'],
    },
    enabled: true,
    replay: (args: Arguments, { result }: ToolResult<SearchResult>) => {
        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Searched workspace with ripgrep for "${query}".`)
        console.log()
        displayMatches(result?.matches ?? [])
    },
    execute: async (
        _context: ChatContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<SearchResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { query } = args as { query: string }
        console.log(`${chalk.dim('ℹ')} Searching workspace with ripgrep for "${query}"...`)
        console.log()

        // Execute ripgrep command
        const rgCommand = `rg --json "${query}" .`
        const output = execSync(rgCommand).toString()

        // Parse the JSON output
        const lines = output.trim().split('\n')
        const results = lines.map(line => JSON.parse(line))

        // Group results by file
        const fileMatches = new Map<string, string[]>()

        for (const result of results) {
            if (result.type === 'match') {
                const filename = path.relative(process.cwd(), result.data.path.text)
                const matchText = result.data.lines.text.trim()

                if (!fileMatches.has(filename)) {
                    fileMatches.set(filename, [])
                }

                fileMatches.get(filename)?.push(matchText)
            }
        }

        // Convert to the expected format
        const matches: Match[] = Array.from(fileMatches.entries()).map(([filename, lines]) => ({
            filename,
            lines: lines.length > 0 ? lines : undefined,
        }))

        displayMatches(matches)
        console.log()

        return { result: { matches }, reprompt: true }
    },
    serialize: ({ result }: ToolResult<SearchResult>) => ({ result: { paths: result ?? [] } }),
}

function displayMatches(matches: Match[]) {
    if (matches.length === 0) {
        console.log(`${chalk.dim('ℹ')} No files found in the workspace matching the query.`)
    } else {
        for (const [i, { filename, lines }] of matches.entries()) {
            if (lines) {
                console.log(`#${(i + 1).toString().padStart(2, '0')}: Found matching file "${chalk.red(filename)}":`)

                for (const line of lines) {
                    console.log(`     - "${chalk.red(line)}"`)
                }
            } else {
                console.log(`#${(i + 1).toString().padStart(2, '0')}: Found matching file "${chalk.red(filename)}".`)
            }
        }
    }
}
