import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { expandFileAndDirectoryPatterns } from '../../../util/fs/glob'
import { filterIgnoredPaths } from '../../../util/fs/ignore'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

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
    const matchedPaths =
        patterns.length > 0
            ? await filterIgnoredPaths(await expandFileAndDirectoryPatterns(patterns))
            : [...context.contextStateManager.stashedFiles.keys()]

    const unstashedPaths: string[] = []
    for (const path of matchedPaths) {
        if (context.contextStateManager.stashedFiles.has(path)) {
            context.contextStateManager.stashedFiles.delete(path)
            unstashedPaths.push(path)
        }
    }

    if (unstashedPaths.length === 0) {
        console.log(chalk.red.bold('No stashed files matched the provided patterns.'))
        console.log('')
        return
    }

    unstashedPaths.sort()
    const message = unstashedPaths.map(path => `${chalk.dim('ℹ')} Unstashed "${chalk.red(path)}".`).join('\n')
    console.log(message)
    console.log('')
}

async function completeUnstash(context: ChatContext, args: string): Promise<CompleterResult> {
    const stashedPaths = Array.from(context.contextStateManager.stashedFiles.keys())
    if (args === '') {
        return [stashedPaths, args]
    }

    return [stashedPaths.filter(path => path.startsWith(args)), args]
}
