import { CallToolResult } from '@modelcontextprotocol/sdk/types'
import chalk from 'chalk'

export function serializeResult(results: CallToolResult['content']): string {
    return results
        .map(result => {
            switch (result.type) {
                case 'text':
                    return chalk.cyanBright.bold(result.text)
                case 'image':
                    throw new Error('Image messages not supported')
                case 'resource':
                    // TODO - parse/format by mime type
                    const content =
                        result.resource.text ?? Buffer.from(result.resource.blob as string, 'base64').toString('utf8')
                    return `"${chalk.red(result.resource.uri)}":\n\n${chalk.cyanBright.bold(content)}\n\n`
            }
        })
        .filter(text => text)
        .join('\n\n')
}
