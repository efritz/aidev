import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { completeDirectoryPaths, parseArgsWithEscapedSpaces } from '../../util/fs/completion'
import { expandDirectoryPatterns } from '../../util/fs/glob'
import { filterIgnoredPaths } from '../../util/fs/ignore'
import { normalizeDirectoryPath } from '../../util/fs/normalize'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const loaddirCommand: CommandDescription = {
    prefix: ':loaddir',
    description:
        'Load directory entries into the chat context (supports wildcards, use --force to ignore .aidev/ignore files)',
    expectsArgs: true,
    handler: handleLoaddir,
    complete: completeLoaddir,
}

async function handleLoaddir(context: ChatContext, args: string): Promise<void> {
    return handleLoaddirPatterns(context, parseArgsWithEscapedSpaces(args))
}

async function handleLoaddirPatterns(context: ChatContext, patterns: string[]): Promise<void> {
    const forceIndex = patterns.indexOf('--force')
    const force = forceIndex !== -1
    if (force) {
        patterns.splice(forceIndex, 1)
    }

    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :loaddir.'))
        console.log()
        return
    }

    if (patterns.length === 0) {
        console.log(chalk.red.bold('No patterns supplied to :loaddir.'))
        console.log()
        return
    }

    const paths = (await filterIgnoredPaths(await expandDirectoryPatterns(patterns), false, force)).map(
        normalizeDirectoryPath,
    )

    if (paths.length === 0) {
        console.log(chalk.red.bold('No directories matched the provided patterns.'))
        console.log('')
        return
    }

    const id = context.provider.conversationManager.recordLoadDir(paths)
    context.contextStateManager.addDirectories(paths, { type: 'explicit', metaMessageId: id })

    paths.sort()
    const message = paths.map(path => `${chalk.dim('ℹ')} Added "${chalk.red(path)}" into context.`).join('\n')
    console.log(message)
    console.log('')
}

function completeLoaddir(_context: ChatContext, args: string): Promise<CompleterResult> {
    return completeDirectoryPaths(args)
}
