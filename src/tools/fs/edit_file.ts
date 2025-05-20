import chalk from 'chalk'
import { structuredPatch } from 'diff'
import { ChatContext } from '../../chat/context'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, WriteResult as InternalWriteResult, replayWriteFile } from '../../util/fs/write'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'
import { writeFileOperationMatcher } from './matcher'

type Edit = { search: string; replacement: string; isRegex?: boolean }
type EditResult = { stashed: boolean; originalContents: string; userEdits?: Edit[] }

export const editFile: Tool<EditResult> = {
    name: 'edit_file',
    description: [
        'Edit the contents of an existing file.',
        'The user may choose to modify the edit before writing it to disk. The tool result will include the user-supplied edits, if any.',
        'The file will be added to the subsequent conversation context.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            path: {
                type: JSONSchemaDataType.String,
                description: 'The target path.',
            },
            edits: {
                type: JSONSchemaDataType.Array,
                description: 'A list of line-delimited edits to make to the file.',
                items: {
                    type: JSONSchemaDataType.Object,
                    description: 'A single line-delimited edit to make to the file.',
                    properties: {
                        search: {
                            type: JSONSchemaDataType.String,
                            description: [
                                'The lines to replace.',
                                'This string MUST end with a newline character.',
                                'Additional newline characters may separate lines in the search string.',
                                'Sufficient context MUST be provided to guarantee that this is a unique occurrence in the original file.',
                            ].join(' '),
                        },
                        isRegex: {
                            type: JSONSchemaDataType.Boolean,
                            description: [
                                'Whether to interpret the search string as a regular expression.',
                                'If true, the search string will be treated as a JavaScript regular expression pattern.',
                                'Default is false.',
                            ].join(' '),
                        },
                        replacement: {
                            type: JSONSchemaDataType.String,
                            description: [
                                'The lines to replace the search string with.',
                                'This string may be empty.',
                                'If the string is not empty, it must end with a newline character.',
                                'Additional newline characters may separate lines in the replacement string.',
                            ].join(' '),
                        },
                    },
                    required: ['search', 'replacement'],
                },
            },
        },
        required: ['path', 'edits'],
    },
    enabled: true,
    replay: (args: Arguments, { result, error, canceled }: ToolResult<EditResult>) => {
        if (!result) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
        } else {
            const { path, edits: proposedEdits } = safeInterpretParameters(args)
            const contents = applyEdits(result.originalContents, result.userEdits ?? proposedEdits, path)
            const proposedContents = applyEdits(result.originalContents, proposedEdits, path)
            replayWriteFile({ ...result, path, contents, proposedContents, error, canceled })
        }
    },
    execute: async (context: ChatContext, toolUseId: string, args: Arguments): Promise<ExecutionResult<EditResult>> => {
        const { path, edits } = safeInterpretParameters(args)
        const originalContents = await safeReadFile(path)
        const contents = applyEdits(originalContents, edits, path)
        const result = await executeWriteFile({ ...context, path, contents, originalContents, yolo: context.yolo })
        context.contextStateManager.addFiles(path, { type: 'tool_use', toolUseId })
        return editExecutionResultFromWriteResult(result)
    },
    serialize: ({ result, error, canceled }: ToolResult<EditResult>) => ({
        result: {
            error,
            canceled,
            stashed: result?.stashed ?? false,
            userEdits: result?.userEdits,
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
                      'Carefully review the new state of the file before continuing.',
                  ]
        ).join('\n'),
    }),
    ruleMatcherFactory: writeFileOperationMatcher,
}

function editExecutionResultFromWriteResult(writeResult: InternalWriteResult): ExecutionResult<EditResult> {
    const editResult: EditResult = {
        stashed: writeResult.stashed ?? false,
        originalContents: writeResult.originalContents,
    }
    if (writeResult.userEditedContents) {
        editResult.userEdits = editsFromDiff(writeResult.originalContents, writeResult.userEditedContents)
    }

    return {
        result: editResult,
        canceled: writeResult?.canceled,
        reprompt: writeResult?.canceled ? false : undefined,
    }
}

function applyEdits(content: string, edits: Edit[], path: string): string {
    for (const edit of edits) {
        if (edit.isRegex) {
            try {
                // Create a RegExp object from the search string
                // Remove the trailing newline for regex pattern if it exists
                const searchPattern = edit.search.endsWith('\n') ? edit.search.slice(0, -1) : edit.search
                const regex = new RegExp(searchPattern, 'g')

                // Check if the regex matches anything in the content
                if (!regex.test(content)) {
                    throw new Error(
                        `The regex pattern was not found in the file "${path}":\n${formatCodeFence(edit.search)}\n\n` +
                            'Suggestions:\n' +
                            '- Check the latest version of the file to ensure the pattern can match.\n' +
                            '- Ensure the regex pattern is correct and try again.',
                    )
                }

                // Reset regex lastIndex
                regex.lastIndex = 0

                // Apply the replacement
                content = content.replace(regex, edit.replacement)
            } catch (error) {
                if (error instanceof SyntaxError) {
                    throw new Error(
                        `Invalid regex pattern in the search string for file "${path}":\n${formatCodeFence(edit.search)}\n\n` +
                            `Error: ${error.message}\n` +
                            'Suggestions:\n' +
                            '- Ensure the regex pattern is valid JavaScript regular expression syntax.\n' +
                            '- Escape special characters if needed.',
                    )
                }
                throw error
            }
        } else {
            const occurrences = countOccurrences(content, edit.search)

            if (occurrences === 0) {
                throw new Error(
                    `The search string was not found in the file "${path}":\n${formatCodeFence(edit.search)}\n\n` +
                        'Suggestions:\n' +
                        '- Check the latest version of the file to ensure the search string still exists.\n' +
                        '- Ensure the search string is correct and try again.\n' +
                        '- Consider using regex mode for more flexible matching.',
                )
            }

            if (occurrences > 1) {
                throw new Error(
                    `The search string appears ${occurrences} times in the file "${path}":\n${formatCodeFence(edit.search)}\n\n` +
                        'Suggestions:\n' +
                        '- Ensure the search string is unique within the file.\n' +
                        '- Expand the amount of text being replaced to make it unique.\n' +
                        '- Consider using regex mode with specific anchors or boundaries.',
                )
            }

            content = content.replace(edit.search, edit.replacement)
        }
    }

    return content
}

function editsFromDiff(original: string, modified: string): Edit[] {
    // Note: edits created from diff will never use regex mode
    const edits: Edit[] = []
    const originalLines = original.split('\n')
    const modifiedLines = modified.split('\n')
    const patch = structuredPatch('', '', original, modified, undefined, undefined, { context: 0 })

    for (const { oldStart, oldLines, newStart, newLines } of patch.hunks) {
        let leftContext = 0
        let rightContext = 0

        const extract = (lines: string[], start: number, length: number): string => {
            if (length === 0) {
                return ''
            }

            const end = start + length
            if (end >= lines.length) {
                return lines.slice(start, lines.length).join('\n')
            }

            return lines.slice(start, end).join('\n') + '\n'
        }

        const extractSearch = () =>
            extract(originalLines, oldStart - 1 - leftContext, oldLines + leftContext + rightContext)
        const extractReplacement = () =>
            extract(modifiedLines, newStart - 1 - leftContext, newLines + leftContext + rightContext)

        while (!isUniqueSubstring(original, extractSearch())) {
            let changed = false
            if (oldStart - 1 - leftContext > 0) {
                leftContext++
                changed = true
            }
            if (oldStart - 1 - leftContext + oldLines + leftContext + rightContext < originalLines.length) {
                rightContext++
                changed = true
            }
            if (!changed) {
                break
            }
        }

        if (!isUniqueSubstring(original, extractSearch())) {
            throw new Error(`Warning: Unable to create a unique edit for hunk at line ${oldStart}`)
        }

        edits.push({ search: extractSearch(), replacement: extractReplacement(), isRegex: false })
    }

    return edits
}

function isUniqueSubstring(content: string, search: string): boolean {
    return countOccurrences(content, search) === 1
}

function countOccurrences(content: string, search: string): number {
    let count = 0
    let position = 0

    while (true) {
        if (position > content.length - search.length) {
            break
        }

        const index = content.indexOf(search, position)
        if (index < 0) {
            break
        }

        count++
        position = index + 1
    }

    return count
}

const formatCodeFence = (content: string): string => '```\n' + content + '\n```'

const safeInterpretParameters = (args: Arguments): { path: string; edits: Edit[] } => {
    const { path, edits } = args as { path: string; edits: Edit[] | string }

    if (typeof edits === 'string') {
        // Try to strip XML control sequences from the tail of the string.
        // For example, Claude sometimes leaks `</invoke>` after an otherwise valid JSON object.
        const stripped = edits.replace(/<\/[^>]+>$/, '')

        try {
            return { path, edits: JSON.parse(stripped) }
        } catch (error) {
            throw new Error(
                [
                    'Unable to interpret "edits" parameter as a valid JSON object.',
                    formatCodeFence(stripped),
                    error,
                ].join('\n\n'),
            )
        }
    }

    return { path, edits }
}
