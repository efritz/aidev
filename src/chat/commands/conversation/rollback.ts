import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { ChatContext } from '../../context'
import { replayMessages } from '../../history'
import { CommandDescription } from './../command'

export const rollbackCommand: CommandDescription = {
    prefix: ':rollback',
    description: 'Rollback to a previously registered savepoint.',
    expectsArgs: true,
    handler: handleRollback,
    complete: completeRollback,
}

async function handleRollback(context: ChatContext, args: string): Promise<void> {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length !== 1) {
        console.log(chalk.red.bold('Expected exactly one name for :rollback.'))
        console.log()
        return
    }
    const name = parts[0]

    const { success, prunedBranches } = context.provider.conversationManager.rollbackToSavepoint(name)
    if (!success) {
        console.log(chalk.red.bold(`Savepoint "${name}" not found.`))
        console.log()
        return
    }

    console.clear()
    replayMessages(context.provider.conversationManager.visibleMessages())

    console.log(`${chalk.dim('📌')} Rolled back to savepoint "${name}".`)
    if (prunedBranches.length > 0) {
        console.log(chalk.yellow(`${chalk.dim('𐌖')} Pruned branches "${prunedBranches.join(', ')}".`))
        console.log()
    }
}

function completeRollback(context: ChatContext, args: string): CompleterResult {
    return [context.provider.conversationManager.savepoints().filter(name => name.startsWith(args)), args]
}
