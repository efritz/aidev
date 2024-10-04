import chalk from 'chalk'
import { structuredPatch } from 'diff'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile, WriteResult as InternalWriteResult, replayWriteFile } from '../../util/fs/write'
import { ExecutionContext } from '../context'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type Edit = { search: string; replacement: string }
type EditResult = { stashed: boolean; originalContents: string; userEdits?: Edit[] }

export const editFile: Tool = {
    name: 'edit_file',
    description: [
        'Edit the contents of an existing file.',
        'The user may choose to modify the edit before writing it to disk. The tool result will include the user-supplied edits, if any.',
        'If the conversation context already contains the target path, the conversation will be updated to include the edited contents.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        description: 'The command payload.',
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
    replay: (args: Arguments, { result, error, canceled }: ToolResult) => {
        const editResult = result as EditResult | undefined
        if (!editResult) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
            return
        }

        const { path, edits: proposedEdits } = args as { path: string; edits: Edit[] }
        const contents = applyEdits(editResult.originalContents, editResult.userEdits ?? proposedEdits)
        const proposedContents = applyEdits(editResult.originalContents, proposedEdits)
        replayWriteFile({ ...editResult, path, contents, proposedContents, error, canceled })
    },
    execute: async (context: ExecutionContext, toolUseId: string, args: Arguments): Promise<ExecutionResult> => {
        const { path, edits } = args as { path: string; edits: Edit[] }
        const originalContents = await safeReadFile(path)
        const contents = applyEdits(originalContents, edits)
        const result = await executeWriteFile({ ...context, path, contents, originalContents })
        return editExecutionResultFromWriteResult(result)
    },
    serialize: ({ result, canceled }: ToolResult) => {
        if (canceled) {
            return JSON.stringify({ canceled: true })
        }

        const editResult = result as EditResult
        return JSON.stringify({
            stashed: editResult.stashed,
            userEdits: editResult.userEdits,
        })
    },
}

function editExecutionResultFromWriteResult(writeResult: InternalWriteResult): ExecutionResult {
    const editResult: EditResult = {
        stashed: writeResult.stashed ?? false,
        originalContents: writeResult.originalContents,
    }
    if (writeResult.userEditedContents) {
        editResult.userEdits = editsFromDiff(writeResult.originalContents, writeResult.userEditedContents)
    }

    return { result: editResult, canceled: writeResult?.canceled }
}

function applyEdits(content: string, edits: Edit[]): string {
    for (const edit of edits) {
        if (!isUniqueSubstring(content, edit.search)) {
            throw new Error(`The search string "${edit.search}" must appear exactly once in the file.`)
        }

        content = content.replace(edit.search, edit.replacement)
    }

    return content
}

function editsFromDiff(original: string, modified: string): Edit[] {
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

        edits.push({ search: extractSearch(), replacement: extractReplacement() })
    }

    return edits
}

function isUniqueSubstring(content: string, search: string): boolean {
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

    return count === 1
}
