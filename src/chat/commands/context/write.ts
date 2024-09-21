import { CompleterResult } from 'readline'
import chalk from 'chalk'
import { executeWriteFile } from '../../../tools/fs/write_file'
import { ChatContext } from '../../context'
import { CommandDescription } from '../command'

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

    const stashedContent = context.contextStateManager.stashedFiles.get(path)
    if (!stashedContent) {
        console.log(chalk.red.bold(`No stashed content found for "${path}".`))
        console.log()
        return
    }

    const result = await executeWriteFile(context, path, stashedContent)
    const _ = result // TODO
}

async function completeWrite(context: ChatContext, args: string): Promise<CompleterResult> {
    const stashedPaths = Array.from(context.contextStateManager.stashedFiles.keys())
    if (args === '') {
        return [stashedPaths, args]
    }

    return [stashedPaths.filter(path => path.startsWith(args)), args]
}
