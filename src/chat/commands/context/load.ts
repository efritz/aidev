import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { completeFilePaths, parseArgsWithEscapedSpaces } from '../../../util/fs/completion'
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
    return handleLoadPatterns(context, parseArgsWithEscapedSpaces(args))
}

export async function handleLoadPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :load.'))
        console.log()
        return
    }

    const paths = await filterIgnoredPaths(await expandFilePatterns(patterns))

    if (paths.length === 0) {
        console.log(chalk.red.bold('No files matched the provided patterns.'))
        console.log('')
        return
    }

    await context.contextStateManager.addFiles(paths, { type: 'explicit' })

    paths.sort()
    const message = paths.map(path => `${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`).join('\n')
    console.log(message)
    console.log('')
}

function completeLoad(context: ChatContext, args: string): Promise<CompleterResult> {
    return completeFilePaths(args)
}
