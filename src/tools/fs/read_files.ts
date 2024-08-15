import chalk from 'chalk'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { FilePayload, readFileContents } from '../../util/fs/read'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readFiles: Tool = {
    name: 'read_files',
    description:
        'Read file contents. The tool result will contain a list of entries ({name, contents}) for each valid input path.',
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            paths: {
                type: JSONSchemaDataType.Array,
                description: 'A list of target file paths to read.',
                items: {
                    type: JSONSchemaDataType.String,
                    description:
                        'A target file path or glob pattern. Glob patterns are expanded into a set of matching paths. Paths that do not exist or refer to a non-file are ignored.',
                },
            },
        },
        required: ['paths'],
    },
    replay: (args: Arguments, result: ToolResult) => {
        const { paths } = args as { paths: string[] }

        for (const path of paths) {
            console.log(`${chalk.dim('ℹ')} Read file "${chalk.red(path)}" into context.`)
        }
    },
    execute: async (context: ExecutionContext, args: Arguments): Promise<ExecutionResult> => {
        const { paths: patterns } = args as { paths: string[] }

        const result = await readFileContents(filterIgnoredPaths(expandFilePatterns(patterns)))
        if (result.ok) {
            return { result: result.response, reprompt: true }
        } else {
            return { error: result.error }
        }
    },
    serialize: (result?: any) => JSON.stringify({ contents: result as FilePayload[] }),
}
