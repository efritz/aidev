import { window } from 'vscode'
import { JSONSchemaDataType } from '../../../../tools/tool'
import { ExecutionContext } from '../context'
import { Tool } from '../tool'

export const editorNotice: Tool = {
    name: 'editor-notice',
    description: 'Display a message in the editor.',
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            message: {
                description: 'The message to display',
                type: JSONSchemaDataType.String,
            },
        },
        required: ['message'],
    },
    execute: async (context: ExecutionContext, args: any): Promise<{ content: any[] }> => {
        const editorNoticeArgs = args as { message: string }
        await window.showInformationMessage(editorNoticeArgs.message)
        return { content: [] }
    },
}
