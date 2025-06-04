import { execSync } from 'child_process'
import * as path from 'path'
import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const SearchWorkspaceRipgrepSchema = z.object({
    query: z.string().describe('The input search query.'),
})

type SearchWorkspaceRipgrepArguments = z.infer<typeof SearchWorkspaceRipgrepSchema>

type SearchWorkspaceRipgrepResult = {
    matches: Match[]
}

type Match = {
    filename: string
    lines?: string[]
}

export const searchWorkspaceRipgrep: Tool<typeof SearchWorkspaceRipgrepSchema, SearchWorkspaceRipgrepResult> = {
    name: 'search_workspace_ripgrep',
    description: [
        'Use ripgrep to search the current workspace for files containing the input query.',
        'The tool result will contain a set of filenames matching the input query.',
        'For source code files, the result will also contain the matching lines from the file.',
        'The query is treated as a regular expression - escape regex metacharacters (like parentheses, brackets, dots, etc.) with backslashes if you want to search for them literally.',
    ].join(' '),
    schema: SearchWorkspaceRipgrepSchema,
    enabled: true,
    replay: ({ query }: SearchWorkspaceRipgrepArguments, { result }: ToolResult<SearchWorkspaceRipgrepResult>) => {
        console.log(`${chalk.dim('ℹ')} Searched workspace with ripgrep for "${query}".`)
        console.log()
        displayMatches(result?.matches ?? [])
    },
    execute: async (
        _context: ChatContext,
        toolUseId: string,
        { query }: SearchWorkspaceRipgrepArguments,
    ): Promise<ExecutionResult<SearchWorkspaceRipgrepResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        console.log(`${chalk.dim('ℹ')} Searching workspace with ripgrep for "${query}"...`)
        console.log()

        const fileMatches = new Map<string, string[]>()
        for (const result of search(query)) {
            if (result.type === 'match') {
                const filename = path.relative(process.cwd(), result.data.path.text)
                const matchText = result.data.lines.text.trim()

                if (!fileMatches.has(filename)) {
                    fileMatches.set(filename, [])
                }

                fileMatches.get(filename)?.push(matchText)
            }
        }

        const matches: Match[] = Array.from(fileMatches.entries()).map(([filename, lines]) => ({
            filename,
            lines: lines.length > 0 ? lines : undefined,
        }))

        displayMatches(matches)
        console.log()

        return { result: { matches }, reprompt: true }
    },
    serialize: ({ result }: ToolResult<SearchWorkspaceRipgrepResult>) => ({ result: { paths: result ?? [] } }),
}

function search(query: string): any[] {
    let output: string
    try {
        output = execSync(`rg --json "${query}" .`).toString()
    } catch (error: any) {
        if (error.status === 1) {
            // No matches
            return []
        }

        throw error
    }

    return output
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line))
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
