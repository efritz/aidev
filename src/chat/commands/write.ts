import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { safeReadFile } from '../../util/fs/safe'
import { executeWriteFile } from '../../util/fs/write'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const writeCommand: CommandDescription = {
    prefix: ':write',
    description: 'Write a stashed file to disk',
    expectsArgs: true,
    handler: handleWrite,
    complete: completeWrite,
}

async function handleWrite(context: ChatContext, args: string): Promise<void> {
    const path = args.trim()
    if (!path) {
        console.log(chalk.red.bold('No path provided to :write.'))
        console.log()
        return
    }

    const stashedContent = context.provider.conversationManager.stashedFiles().get(path)
    if (!stashedContent) {
        console.log(chalk.red.bold(`No stashed content found for "${path}".`))
        console.log()
        return
    }

    const originalContents = await safeReadFile(path)
    await executeWriteFile({ ...context, path, contents: stashedContent, originalContents, fromStash: true })
}

async function completeWrite(context: ChatContext, args: string): Promise<CompleterResult> {
    const stashedPaths = Array.from(context.provider.conversationManager.stashedFiles().keys())
    if (args === '') {
        return [stashedPaths, args]
    }

    return [stashedPaths.filter(path => path.startsWith(args)), args]
}
