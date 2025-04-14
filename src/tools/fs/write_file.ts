import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, WriteResult as InternalWriteResult, replayWriteFile } from '../../util/fs/write'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'
import { writeFileOperationMatcher } from './matcher'

type WriteResult = {
    stashed: boolean
    originalContents: string
    userEditedContents?: string
}

export const writeFile: Tool<WriteResult> = {
    name: 'write_file',
    description: [
        'Write file contents to disk, creating intermediate directories if necessary.',
        'The user may choose to modify the file content before writing it to disk. The tool result will include the user-supplied content, if any.',
        'The written file will be automatically added to the conversation context and will be included in the next interaction.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
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
    enabled: true,
    replay: (args: Arguments, { result, error, canceled }: ToolResult<WriteResult>) => {
        if (!result) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
        } else {
            const { path, contents: proposedContents } = args as { path: string; contents: string }
            const contents = result && result.userEditedContents ? result.userEditedContents : proposedContents
            replayWriteFile({ ...result, path, contents, proposedContents, error, canceled })
        }
    },
    execute: async (
        context: ChatContext,
        toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<WriteResult>> => {
        const { path, contents } = args as { path: string; contents: string }
        const originalContents = await safeReadFile(path)
        const result = await executeWriteFile({ ...context, path, contents, originalContents })
        await context.contextStateManager.addFiles(path, { type: 'tool_use', toolUseClass: 'write', toolUseId })
        return writeExecutionResultFromWriteResult(result)
    },
    serialize: ({ result, error, canceled }: ToolResult<WriteResult>) => ({
        result: {
            error,
            canceled,
            stashed: result?.stashed ?? false,
            userEditedContents: result?.userEditedContents,
        },
        suggestions: (result?.stashed
            ? [
                  'The user stashed but has not applied the new version of the file.',
                  'No files were modified by this tool invocation.',
                  'The current, unchanged content of the file remains available in the subsequent context.',
              ]
            : canceled
              ? [
                    'The user canceled the file edit.',
                    'No files were modified by this tool invocation.',
                    'The current, unchanged content of the file remains available in the subsequent context.',
                ]
              : error
                ? [
                      'There was an error applying edits to the file.',
                      'No files were modified by this tool invocation.',
                      'The current, unchanged content of the file remains available in the subsequent context.',
                      'Please check the error message in the tool result and try again.',
                  ]
                : [
                      'The file has been successfully edited.',
                      'The updated content of the file is available in the subsequent context.',
                  ]
        ).join('\n'),
    }),
    ruleMatcherFactory: writeFileOperationMatcher,
}

function writeExecutionResultFromWriteResult(writeResult: InternalWriteResult): ExecutionResult<WriteResult> {
    const result: WriteResult = {
        stashed: writeResult.stashed ?? false,
        originalContents: writeResult.originalContents,
        userEditedContents: writeResult.userEditedContents,
    }

    return {
        result,
        canceled: writeResult?.canceled,
        reprompt: writeResult?.canceled ? false : undefined,
    }
}
