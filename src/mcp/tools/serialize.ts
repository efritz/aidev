import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import chalk from 'chalk'
import { parseError } from './error'
import { parseProgress } from './progress'
import { decodeBase64 } from './resource'

export function serializeResult(contents: CallToolResult['content']): string {
    const progress = parseProgress(contents)
    if (progress) {
        return chalk.yellow(`${progress.progress} of ${progress.total ?? 'unknown total'} complete`)
    }

    const error = parseError(contents)
    if (error) {
        return chalk.red(error.message)
    }

    return contents
        .map(result => {
            if (result.type === 'text') {
                return chalk.cyanBright.bold(result.text)
            }

            if (result.type === 'resource') {
                const resourceText = result.resource.blob
                    ? decodeBase64(result.resource.blob as string)
                    : (result.resource.text as string)
                return `"${chalk.red(result.resource.uri)}":\n\n${chalk.cyanBright.bold(indent(resourceText))}`
            }

            throw new Error(`Unsupported result type ${result.type}`)
        })
        .filter(text => text)
        .join('\n\n')
}

function indent(text: string): string {
    return text
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n')
}
