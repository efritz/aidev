import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext, swapProvider } from '../../context'
import { CommandDescription } from '../command'

export const modelCommand: CommandDescription = {
    prefix: ':model',
    description: 'Switch to a different model',
    expectsArgs: true,
    handler: handleModel,
    complete: completeModel,
}

async function handleModel(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one model name.'))
        console.log()
        return
    }

    const modelName = parts[0]
    if (!context.providers.modelNames.includes(modelName)) {
        console.log(chalk.red.bold(`Invalid model name: ${modelName}`))
        console.log()
        console.log('Valid models:')
        console.log(context.providers.formattedModels)
        console.log()
        return
    }

    try {
        swapProvider(context, modelName)
        console.log(`${chalk.dim('ℹ')} Switched to model "${modelName}".`)
        console.log()
    } catch (error: any) {
        console.log(chalk.red.bold(`Failed to switch models: ${error.message}`))
        console.log()
    }
}

async function completeModel(context: ChatContext, args: string): Promise<CompleterResult> {
    return [context.providers.modelNames.filter(name => name.startsWith(args)), args]
}
