import { sep } from 'path'
import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { completeFileAndDirectoryPaths } from '../../util/fs/completion'
import { expandFileAndDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const unloadCommand: CommandDescription = {
    prefix: ':unload',
    description: 'Remove file or directory from the chat context (supports wildcards)',
    expectsArgs: true,
    handler: handleUnload,
    complete: completeUnload,
}

async function handleUnload(context: ChatContext, args: string): Promise<void> {
    return handleUnloadPatterns(
        context,
        args.split(' ').filter(p => p.trim() !== ''),
    )
}

async function handleUnloadPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    const set = new Set([
        ...context.contextStateManager.files().keys(),
        ...context.contextStateManager.directories().keys(),
    ])

    const matchedPaths =
        patterns.length > 0 ? await filterIgnoredPaths(await expandFileAndDirectoryPatterns(patterns)) : Array.from(set)

    const paths: string[] = []
    for (const path of matchedPaths) {
        for (const candidate of [path, path + sep]) {
            if (set.has(candidate)) {
                paths.push(candidate)
            }
        }
    }

    if (paths.length === 0) {
        console.log(chalk.red.bold('No entries removed from context.'))
        console.log('')
        return
    }

    context.provider.conversationManager.recordUnload(paths)

    if (patterns.length === 0) {
        console.log(`${chalk.dim('ℹ')} Removed all entries from context.`)
        console.log('')
    } else {
        const message = paths.map(path => `${chalk.dim('ℹ')} Removed "${chalk.red(path)}" from context.`).join('\n')
        console.log(message)
        console.log('')
    }
}

function completeUnload(_context: ChatContext, args: string): Promise<CompleterResult> {
    return completeFileAndDirectoryPaths(args)
}
