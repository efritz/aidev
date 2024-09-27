import chalk from 'chalk'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, replayWriteFile, WriteResult } from '../../util/fs/write'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

export const writeFile: Tool = {
    name: 'write_file',
    description: [
        'Write file contents to disk, creating intermediate directories if necessary.',
        'The user may choose to modify the file content before writing it to disk. The tool result will include the user-supplied content, if any.',
        'If the conversation context already contains the target path, the conversation will be updated to include the new contents.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
        properties: {
            path: {
                type: JSONSchemaDataType.String,
                description: 'The target path.',
            },
            contents: {
                type: JSONSchemaDataType.String,
                description: 'The contents of the file.',
            },
        },
        required: ['path', 'contents'],
    },
    replay: (args: Arguments, { result, error }: ToolResult) => {
        const writeResult = result as WriteResult
        if ('userCanceled' in writeResult) {
            console.log(`${chalk.dim('ℹ')} No file was written.`)
            console.log()
            return
        }

        const { path, contents: proposedContents } = args as { path: string; contents: string }
        const contents = writeResult.userEditedContents ?? proposedContents
        replayWriteFile({ ...writeResult, path, contents, proposedContents, error })
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }
        const originalContents = await safeReadFile(path)
        const result = await executeWriteFile({ ...context, path, contents, originalContents })
        return { result }
    },
    serialize: (result?: any) => {
        if (!result) {
            return ''
        }

        const writeResult = result as WriteResult
        return 'userCanceled' in writeResult
            ? JSON.stringify(writeResult)
            : JSON.stringify({
                  stashed: writeResult.stashed,
                  userEditedContents: writeResult.userEditedContents,
              })
    },
}
