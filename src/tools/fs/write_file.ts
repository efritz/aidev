import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, WriteResult as InternalWriteResult, replayWriteFile } from '../../util/fs/write'
import { ExecutionResult, Tool, ToolResult } from '../tool'
import { writeFileOperationMatcher } from './matcher'

const WriteFileSchema = z.object({
    path: z.string().describe('The target path.'),
    contents: z.string().describe('The contents of the file.'),
})

type WriteFileArguments = z.infer<typeof WriteFileSchema>

type WriteFileResult = {
    stashed: boolean
    originalContents: string
    userEditedContents?: string
}

export const writeFile: Tool<typeof WriteFileSchema, WriteFileResult> = {
    name: 'write_file',
    description: [
        'Write file contents to disk, creating intermediate directories if necessary.',
        'The user may choose to modify the file content before writing it to disk. The tool result will include the user-supplied content, if any.',
        'The file will be added to the subsequent conversation context.',
    ].join(' '),
    schema: WriteFileSchema,
    enabled: true,
    agentContext: [
        { type: 'main', required: true },
        { type: 'subagent', required: false },
    ],
    replay: (
        { path, contents: proposedContents }: WriteFileArguments,
        { result, error, canceled }: ToolResult<WriteFileResult>,
    ) => {
        if (!result) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
        } else {
            const contents = result && result.userEditedContents ? result.userEditedContents : proposedContents
            replayWriteFile({ ...result, path, contents, proposedContents, error, canceled })
        }
    },
    execute: async (
        context: ChatContext,
        toolUseId: string,
        { path, contents }: WriteFileArguments,
    ): Promise<ExecutionResult<WriteFileResult>> => {
        const originalContents = await safeReadFile(path)
        const result = await executeWriteFile({ ...context, path, contents, originalContents, yolo: context.yolo })
        context.contextStateManager.addFiles(path, { type: 'tool_use', toolUseId })
        return writeExecutionResultFromWriteResult(result)
    },
    serialize: ({ result, error, canceled }: ToolResult<WriteFileResult>) => ({
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
                    'The user canceled the file write.',
                    'No files were modified by this tool invocation.',
                    'The current, unchanged content of the file remains available in the subsequent context.',
                ]
              : error
                ? [
                      'There was an error writing the file.',
                      'No files were modified by this tool invocation.',
                      'The current, unchanged content of the file remains available in the subsequent context.',
                      'Please check the error message in the tool result and try again.',
                  ]
                : [
                      'The file has been successfully written.',
                      'The updated content of the file is available in the subsequent context.',
                      'Carefully review the new state of the file before continuing.',
                  ]
        ).join('\n'),
    }),
    ruleMatcherFactory: writeFileOperationMatcher('write_file'),
}

function writeExecutionResultFromWriteResult(writeResult: InternalWriteResult): ExecutionResult<WriteFileResult> {
    const result: WriteFileResult = {
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
