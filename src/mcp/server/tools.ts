import { window } from 'vscode'
import { JSONSchemaDataType } from '../../tools/tool'

export const tools = [
    {
        name: 'editor-notice',
        description: 'Display a message in the editor.',
        inputSchema: {
            type: JSONSchemaDataType.Object,
            properties: {
                message: { type: JSONSchemaDataType.String },
            },
            required: ['message'],
        },
        execute: async (args: any): Promise<{ content: any[] }> => {
            const editorNoticeArgs = args as { message: string }
            await window.showInformationMessage(editorNoticeArgs.message)
            return { content: [] }
        },
    },
]
