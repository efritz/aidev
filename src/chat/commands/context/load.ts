import chalk from 'chalk'
import { completeFilePaths } from '../../../util/fs/completion'
import { expandFilePatterns } from '../../../util/fs/glob'
import { filterIgnoredPaths } from '../../../util/fs/ignore'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

export const loadCommand: CommandDescription = {
    prefix: ':load',
    description: 'Load file contents into the chat context (supports wildcards)',
    expectsArgs: true,
    handler: handleLoad,
    complete: completeLoad,
}

async function handleLoad(context: ChatContext, args: string): Promise<void> {
    return handleLoadPatterns(
        context,
        args.split(' ').filter(p => p.trim() !== ''),
    )
}

export async function handleLoadPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :load.'))
        console.log()
        return
    }

    const filePaths = (await filterIgnoredPaths(expandFilePatterns(patterns))).sort()

    if (filePaths.length === 0) {
        console.log(chalk.red.bold('No files matched the provided patterns.'))
        console.log('')
        return
    }

    for (const path of filePaths) {
        context.contextState.addFile(path, { type: 'explicit' })
    }

    const message = filePaths.map(path => `${chalk.dim('ℹ')} Added file "${chalk.red(path)}" into context.`).join('\n')
    console.log(message)
    console.log('')
}

function completeLoad(context: ChatContext, args: string) {
    return completeFilePaths(args)
}
