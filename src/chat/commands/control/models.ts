import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const modelsCommand: CommandDescription = {
    prefix: ':models',
    description: 'List available models',
    handler: handleModels,
}

async function handleModels(context: ChatContext, args: string) {
    console.log()
    console.log(context.providers.formattedModels)
    console.log()
    return
}
