import chalk from 'chalk'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { FilePayload } from '../../util/fs/read'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const readFiles: Tool = {
    name: 'read_files',
    description:
        'Read file contents. The tool result will contain the list of concrete file paths made available in the context.',
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
        const filePaths: string[] = result.result || []

        const message = filePaths
            .map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`)
            .join('\n')
        console.log(message)
        console.log('')
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { paths: patterns } = args as { paths: string[] }

        const filePaths = filterIgnoredPaths(expandFilePatterns(patterns)).sort()

        if (!toolUseId) {
            throw new Error('No ToolUseId supplied.')
        }

        for (const path of filePaths) {
            context.contextState.addFile(path, { type: 'tool_use', toolUseId })
        }

        const message = filePaths
            .map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`)
            .join('\n')
        console.log(message)
        console.log('')

        return { result: filePaths, reprompt: true }
    },
    serialize: (result?: any) => JSON.stringify({ contents: result as FilePayload[] }),
}
