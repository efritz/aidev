import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const unstashCommand: CommandDescription = {
    prefix: ':unstash',
    description: 'Remove stashed file(s) from the chat context (supports wildcards)',
    expectsArgs: true,
    handler: handleUnstash,
    complete: completeUnstash,
}

async function handleUnstash(context: ChatContext, args: string): Promise<void> {
    return handleUnstashPatterns(
        context,
        args.split(' ').filter(p => p.trim() !== ''),
    )
}

export async function handleUnstashPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    const stashedFiles = context.provider.conversationManager.stashedFiles()
    const mismatchedPaths = patterns.filter(p => !stashedFiles.has(p))
    if (mismatchedPaths.length > 0) {
        for (const path of mismatchedPaths) {
            console.log(chalk.red.bold(`No stashed file matching: ${path}`))
        }
    } else {
        for (const path of patterns) {
            context.provider.conversationManager.unstashFile(path)
            console.log(`${chalk.dim('ℹ')} Unstashed file "${chalk.red(path)}"`)
        }
    }

    console.log('')
}

async function completeUnstash(context: ChatContext, args: string): Promise<CompleterResult> {
    const stashedPaths = Array.from(context.provider.conversationManager.stashedFiles().keys())
    if (args === '') {
        return [stashedPaths, args]
    }

    return [stashedPaths.filter(path => path.startsWith(args)), args]
}
