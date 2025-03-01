import chalk from 'chalk'
import { indexWorkspace } from '../../embeddings/workspace'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const indexCommand: CommandDescription = {
    prefix: ':index',
    description: 'Index the current workspace',
    handler: handleIndex,
}

async function handleIndex(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :index.'))
        console.log()
        return
    }

    await indexWorkspace(context)
}
