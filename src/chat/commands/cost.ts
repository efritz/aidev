import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const costCommand: CommandDescription = {
    prefix: ':cost',
    description: 'Get cost of the current conversation',
    handler: handleCost,
}

async function handleCost(context: ChatContext, _args: string) {
    const usage = context.tracker
        .all()
        .map(u => ({
            modelName: u.modelName,
            inputTokens: u.usage.inputTokens,
            outputTokens: u.usage.outputTokens,
        }))
        .sort((a, b) => b.outputTokens - a.outputTokens || b.inputTokens - a.inputTokens)

    if (usage.length === 0) {
        console.log('No usage found')
        console.log()
        return
    }

    const maxModelName = Math.max(...usage.map(u => u.modelName.length))
    const maxInputTokens = Math.max(...usage.map(u => u.inputTokens.toString().length))
    const maxOutputTokens = Math.max(...usage.map(u => u.outputTokens.toString().length))

    console.log()
    for (const { modelName, inputTokens, outputTokens } of usage) {
        console.log(
            `${chalk.bold(modelName.padStart(maxModelName, ' '))}: ${inputTokens.toString().padStart(maxInputTokens, ' ')} input tokens, ${outputTokens.toString().padStart(maxOutputTokens, ' ')} output tokens`,
        )
    }
    console.log()
}
