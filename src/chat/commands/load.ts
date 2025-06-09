import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { completeFilePaths, parseArgsWithEscapedSpaces } from '../../util/fs/completion'
import { expandFilePatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const loadCommand: CommandDescription = {
    prefix: ':load',
    description:
        'Load file contents into the chat context (supports wildcards, use --force to ignore .aidev/ignore files)',
    expectsArgs: true,
    handler: handleLoad,
    complete: completeLoad,
}

async function handleLoad(context: ChatContext, args: string): Promise<void> {
    return handleLoadPatterns(context, parseArgsWithEscapedSpaces(args))
}

async function handleLoadPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    const forceIndex = patterns.indexOf('--force')
    const force = forceIndex !== -1
    if (force) {
        patterns.splice(forceIndex, 1)
    }

    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :load.'))
        console.log()
        return
    }

    const paths = await filterIgnoredPaths(await expandFilePatterns(patterns), false, force)

    if (paths.length === 0) {
        console.log(chalk.red.bold('No files matched the provided patterns.'))
        console.log('')
        return
    }

    const id = context.provider.conversationManager.recordLoad(paths)
    context.contextStateManager.addFiles(paths, { type: 'explicit', metaMessageId: id })

    paths.sort()
    const message = paths.map(path => `${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`).join('\n')
    console.log(message)
    console.log('')
}

function completeLoad(_context: ChatContext, args: string): Promise<CompleterResult> {
    return completeFilePaths(args)
}
