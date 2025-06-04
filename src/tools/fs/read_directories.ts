import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { normalizeDirectoryPath } from '../../util/fs/normalize'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const ReadDirectoriesSchema = z.object({
    paths: z
        .array(
            z
                .string()
                .describe(
                    [
                        'A target directory path or glob pattern.',
                        'Glob patterns are expanded into a set of matching paths.',
                        'Paths that do not exist or refer to a non-directory are ignored.',
                    ].join(' '),
                ),
        )
        .describe(
            [
                'A list of target directory paths to read.',
                'Paths can be absolute or relative to the current working directory.',
            ].join(' '),
        ),
})

type ReadDirectoriesArguments = z.infer<typeof ReadDirectoriesSchema>

type ReadDirectoriesResult = string[]

export const readDirectories: Tool<typeof ReadDirectoriesSchema, ReadDirectoriesResult> = {
    name: 'read_directories',
    description: [
        'Add specific directory listings to the conversation context.',
        'The conversation context is always up-to date. Specifying a directory already in the context will not update the context.',
        'The tool result will contain a list of concrete paths loaded into the context.',
    ].join(' '),
    schema: ReadDirectoriesSchema,
    enabled: true,
    replay: (_args: ReadDirectoriesArguments, { result }: ToolResult<ReadDirectoriesResult>) => {
        console.log(
            (result ?? [])
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
    },
    execute: async (
        context: ChatContext,
        toolUseId: string,
        { paths: patterns }: ReadDirectoriesArguments,
    ): Promise<ExecutionResult<ReadDirectoriesResult>> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const directoryPaths = (await filterIgnoredPaths(await expandDirectoryPatterns(patterns)))
            .map(normalizeDirectoryPath)
            .sort()

        context.contextStateManager.addDirectories(directoryPaths, { type: 'tool_use', toolUseId })

        console.log(
            directoryPaths
                .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
                .join('\n'),
        )
        console.log('')

        return { result: directoryPaths, reprompt: true }
    },
    serialize: ({ result }: ToolResult<ReadDirectoriesResult>) => ({
        result: { paths: result ?? [] },
    }),
}
