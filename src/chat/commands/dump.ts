import { writeFile } from 'fs/promises'
import chalk from 'chalk'
import * as ncp from 'copy-paste'
import { getActiveFiles } from '../../context/content'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const dumpCommand: CommandDescription = {
    prefix: ':dump',
    description: 'Dump all context file contents to disk',
    handler: handleDump,
}

async function handleDump(context: ChatContext, args: string) {
    const parts = args.split(' ').filter(p => p.trim() !== '')
    if (parts.length > 1) {
        console.log(chalk.red.bold('Unexpected arguments supplied to :dump.'))
        console.log()
        return
    }

    let useClipboard = false
    if (parts.length === 1) {
        if (parts[0] !== 'clipboard') {
            console.log(chalk.red.bold('Unexpected arguments supplied to :dump.'))
            console.log()
            return
        }

        useClipboard = true
    }

    const output = await serialize(context)

    if (useClipboard) {
        await new Promise<void>((resolve, reject) => {
            ncp.copy(output, err => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })

        console.log('Context contents copied to clipboard\n')
        return
    }

    const filename = `context-dump-${Math.floor(Date.now() / 1000)}.xml`
    await writeFile(filename, output)
    console.log(`Context contents dumped to ${filename}\n`)
}

async function serialize(context: ChatContext): Promise<string> {
    let output = '<files>\n'

    for (const file of getActiveFiles(context.provider.conversationManager, context.contextStateManager)) {
        output += `<file path="${file.path}">\n${await file.content}</file>\n\n`
    }

    output += '</files>\n'
    return output
}
