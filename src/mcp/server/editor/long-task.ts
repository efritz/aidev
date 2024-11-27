import { window } from 'vscode'
import { JSONSchemaDataType } from '../../../tools/tool'
import { ExecutionContext } from '../context'
import { Tool } from '../tool'

export const longTask: Tool = {
    name: 'long-task',
    description: 'Do something for a while.',
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            duration: {
                description: 'The nuber of seconds to do something',
                type: JSONSchemaDataType.Number,
            },
        },
        required: ['duration'],
    },
    execute: async (context: ExecutionContext, args: any): Promise<{ content: any[] }> => {
        const longTaskArgs = args as { duration: number }
        for (let i = 0; i < longTaskArgs.duration; i++) {
            await window.showInformationMessage(`Doing something... ${i + 1}/${longTaskArgs.duration}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        await window.showInformationMessage('Done!')
        return { content: [] }
    },
}
