import { window } from 'vscode'
import { JSONSchemaDataType } from '../../../../tools/tool'
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
        context.log('executing tool')

        const longTaskArgs = args as { duration: number }
        for (let i = 0; i < longTaskArgs.duration; i++) {
            await window.showInformationMessage(`Doing something... ${i + 1}/${longTaskArgs.duration}`)

            context.log(`progress: ${i}`)
            await context.notify({ progress: i, total: longTaskArgs.duration })
        }

        context.log('done')
        await window.showInformationMessage('Done!')

        return {
            content: [
                { type: 'text', text: 'done' },
                { type: 'text', text: `${longTaskArgs.duration}` },
            ],
        }
    },
}
