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
            shouldThrow: {
                description: 'True if there should be an error thrown',
                type: JSONSchemaDataType.Boolean,
            },
        },
        required: ['duration'],
    },
    execute: async (context: ExecutionContext, args: any): Promise<{ content: any[] }> => {
        context.log('executing tool')

        if (args.shouldThrow) {
            throw new Error('Failing to do something correctly!')
        }

        const longTaskArgs = args as { duration: number }
        for (let i = 0; i < longTaskArgs.duration; i++) {
            context.signal.throwIfAborted()

            await window.showInformationMessage(`Doing something... ${i + 1}/${longTaskArgs.duration}`)

            context.log(`progress: ${i}`)
            await context.notify({ progress: i, total: longTaskArgs.duration })
        }

        context.signal.throwIfAborted()

        context.log('done')
        await window.showInformationMessage('Done!')

        return {
            content: [
                { type: 'text', text: 'done' },
                { type: 'resource', resource: { uri: 'foo://bar/baz/bonk/', text: 'tee hee haa haa' } },
                {
                    type: 'resource',
                    resource: {
                        uri: 'foo://bar/baz/bonk/',
                        blob: Buffer.from(JSON.stringify('oh boy this was a secret!!')).toString('base64'),
                    },
                },
                { type: 'text', text: `${longTaskArgs.duration}` },
            ],
        }
    },
}
