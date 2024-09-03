import chalk from 'chalk'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readDirectories: Tool = {
    name: 'read_directories',
    description: [
        'Add directory paths to be included in the conversation context.',
        'The tool result will contain a list of available concrete paths.',
        'The tool result will not contain any directory entries, but the directory entries will be included in the conversation context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            paths: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target directory paths to list.',
                items: {
                    type: JSONSchemaDataType.String,
                    description: [
                        'A target directory path or glob pattern.',
                        'Glob patterns are expanded into a set of matching paths.',
                        'Paths that do not exist or refer to a non-directory are ignored.',
                    ].join(' '),
                },
            },
        },
        required: ['paths'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const directoryPaths: string[] = result.result || []

        const message = directoryPaths
            .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
            .join('\n')
        console.log(message)
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        const { paths: patterns } = args as { paths: string[] }

        const directoryPaths = (await filterIgnoredPaths(await expandDirectoryPatterns(patterns))).sort()

        for (const path of directoryPaths) {
            context.contextState.addDirectory(path, { type: 'tool_use', toolUseId })
        }

        const message = directoryPaths
            .map(path => `${chalk.dim('ℹ')} Added directory "${chalk.red(path)}" into context.`)
            .join('\n')
        console.log(message)
        console.log('')

        return { result: directoryPaths, reprompt: true }
    },
    serialize: (result?: any) => (result ? JSON.stringify({ paths: result as string[] }) : ''),
}
