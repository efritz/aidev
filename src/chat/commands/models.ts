import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const modelsCommand: CommandDescription = {
    prefix: ':models',
    description: 'List available models',
    handler: handleModels,
}

async function handleModels(context: ChatContext, _args: string) {
    console.log()
    console.log(context.providers.formattedModels)
    console.log()
}
