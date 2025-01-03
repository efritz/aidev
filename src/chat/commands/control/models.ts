import { formattedModels } from '../../../providers/providers'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const modelsCommand: CommandDescription = {
    prefix: ':models',
    description: 'List available models',
    handler: handleModels,
}

async function handleModels(context: ChatContext, args: string) {
    console.log()
    console.log(formattedModels)
    console.log()
    return
}
