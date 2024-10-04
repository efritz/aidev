import chalk from 'chalk'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, WriteResult as InternalWriteResult, replayWriteFile } from '../../util/fs/write'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type WriteResult = { stashed: boolean; originalContents: string; userEditedContents?: string }

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
    replay: (args: Arguments, { result, error, canceled }: ToolResult) => {
        const writeResult = result as WriteResult | undefined
        if (!writeResult) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
            return
        }

        const { path, contents: proposedContents } = args as { path: string; contents: string }
        const contents = writeResult.userEditedContents ?? proposedContents
        replayWriteFile({ ...writeResult, path, contents, proposedContents, error, canceled })
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { path, contents } = args as { path: string; contents: string }
        const originalContents = await safeReadFile(path)
        const result = await executeWriteFile({ ...context, path, contents, originalContents })
        return writeExecutionResultFromWriteResult(result)
    },
    serialize: ({ result, canceled }: ToolResult) => {
        if (canceled) {
            return JSON.stringify({ canceled: true })
        }

        const writeResult = result as InternalWriteResult
        return JSON.stringify({
            stashed: writeResult.stashed,
            userEditedContents: writeResult.userEditedContents,
        })
    },
}

function writeExecutionResultFromWriteResult(writeResult: InternalWriteResult): ExecutionResult {
    const result: WriteResult = {
        stashed: writeResult.stashed ?? false,
        originalContents: writeResult.originalContents,
        userEditedContents: writeResult.userEditedContents,
    }

    return { result, canceled: writeResult?.canceled }
}
