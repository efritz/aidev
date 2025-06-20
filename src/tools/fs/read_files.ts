import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const ReadFilesSchema = z.object({
    paths: z
        .array(
            z
                .string()
                .describe(
                    [
                        'A target file path or glob pattern.',
                        'Glob patterns are expanded into a set of matching paths.',
                        'Paths that do not exist or refer to a non-file are ignored.',
                    ].join(' '),
                ),
        )
        .describe('A list of target file paths to read.'),
})

type ReadFilesArguments = z.infer<typeof ReadFilesSchema>

type ReadFileResult = string[]

export const readFiles: Tool<typeof ReadFilesSchema, ReadFileResult> = {
    name: 'read_files',
    description: [
        'Add specific files to the conversation context.',
        'The conversation context is always up-to date. Specifying a file already in the context will not update the context.',
        'The tool result will contain a list of concrete paths loaded into the context.',
    ].join(' '),
    schema: ReadFilesSchema,
    enabled: true,
    agentContext: [
        { type: 'main', required: true },
        { type: 'subagent', required: false },
    ],
    replay: (_args: ReadFilesArguments, { result }: ToolResult<ReadFileResult>) => {
        console.log(
            (result ?? []).map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
        )
    },
    execute: async (
        context: ChatContext,
        toolUseId: string,
        { paths: patterns }: ReadFilesArguments,
    ): Promise<ExecutionResult<ReadFileResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const filePaths = (await filterIgnoredPaths(await expandFilePatterns(patterns))).sort()
        context.contextStateManager.addFiles(filePaths, { type: 'tool_use', toolUseId })

        console.log(
            filePaths.map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n'),
        )
        console.log('')

        return { result: filePaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<ReadFileResult>) => ({
        result: { paths: result ?? [] },
    }),
}
