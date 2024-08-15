import chalk from 'chalk'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { DirectoryPayload, readDirectoryContents } from '../../util/fs/read'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readDirectories: Tool = {
    name: 'read_directories',
    description:
        'List directory entries. The tool result will contain a list of entries ({name, isFile, isDirectory}) for each valid input path.',
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            paths: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target directory paths to list.',
                items: {
                    type: JSONSchemaDataType.String,
                    description:
                        'A target directory path or glob pattern. Glob patterns are expanded into a set of matching paths. Paths that do not exist or refer to a non-directory are ignored.',
                },
            },
        },
        required: ['paths'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const { paths } = args as { paths: string[] }

        for (const path of paths) {
            console.log(`${chalk.dim('ℹ')} Read directory "${chalk.red(path)}" into context.`)
        }
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { paths: patterns } = args as { paths: string[] }

        const result = await readDirectoryContents(filterIgnoredPaths(expandDirectoryPatterns(patterns)))
        if (result.ok) {
            return { result: result.response, reprompt: true }
        } else {
            return { error: result.error }
        }
    },
    serialize: (result?: any) => JSON.stringify({ contents: result as DirectoryPayload[] }),
}
