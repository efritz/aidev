import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { completeDirectoryPaths } from '../../../util/fs/completion'
import { expandDirectoryPatterns } from '../../../util/fs/glob'
import { filterIgnoredPaths } from '../../../util/fs/ignore'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const loaddirCommand: CommandDescription = {
    prefix: ':loaddir',
    description: 'Load directory entries into the chat context (supports wildcards)',
    expectsArgs: true,
    handler: handleLoaddir,
    complete: completeLoaddir,
}

async function handleLoaddir(context: ChatContext, args: string): Promise<void> {
    return handleLoaddirPatterns(
        context,
        args.split(' ').filter(p => p.trim() !== ''),
    )
}

export async function handleLoaddirPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :loaddir.'))
        console.log()
        return
    }

    const paths = await filterIgnoredPaths(await expandDirectoryPatterns(patterns))

    if (paths.length === 0) {
        console.log(chalk.red.bold('No directories matched the provided patterns.'))
        console.log('')
        return
    }

    for (const path of paths) {
        await context.contextStateManager.addDirectory(path, { type: 'explicit' })
    }

    paths.sort()
    const message = paths.map(path => `${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`).join('\n')
    console.log(message)
    console.log('')
}

function completeLoaddir(context: ChatContext, args: string): Promise<CompleterResult> {
    return completeDirectoryPaths(args)
}
