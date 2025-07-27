import chalk from 'chalk'
import * as ncp from 'copy-paste'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const copyCommand: CommandDescription = {
    prefix: ':copy',
    description: 'Copy the last agent response to clipboard.',
    handler: handleCopy,
}

async function handleCopy(context: ChatContext, args: string) {
    if (args.trim() !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :copy.'))
        console.log()
        return
    }

    const messages = context.provider.conversationManager.visibleMessages()
    const lastUserMessageIndex = messages.findLastIndex(message => message.role === 'user')
    const agentMessages = lastUserMessageIndex === -1 ? [] : messages.slice(lastUserMessageIndex + 1)

    if (agentMessages.length === 0) {
        console.log('Nothing to copy.')
        console.log()
        return
    }

    await new Promise<void>((resolve, reject) => {
        ncp.copy(JSON.stringify(agentMessages, null, 2), err => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        })
    })

    console.log('Last agent response copied to clipboard\n')
    console.log()
}
