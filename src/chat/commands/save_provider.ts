import { writeFile } from 'fs/promises'
import chalk from 'chalk'
import { CommandDescription } from '../command'
import { ChatContext } from '../context'

export const saveProviderCommand: CommandDescription = {
    prefix: ':save-provider',
    description: 'Save the messages sent to the provider',
    handler: handleSaveProvider,
}

async function handleSaveProvider(context: ChatContext, args: string) {
    if (args !== '') {
        console.log(chalk.red.bold('Unexpected arguments supplied to :save-provider.'))
        console.log()
        return
    }

    const contents = await context.provider.providerMessages()

    const filename = `provider-messages-${Math.floor(Date.now() / 1000)}.json`
    await writeFile(filename, JSON.stringify(contents, null, '\t'))
    console.log(`Provider messages saved to ${filename}\n`)
}
