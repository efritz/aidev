import { CompleterResult } from 'readline'
import { ChatContext } from './context'

export type CommandDescription = {
    prefix: string
    description: string
    expectsArgs?: boolean
    handler: (context: ChatContext, args: string) => Promise<void>
    valid?: (context: ChatContext) => boolean
    complete?: (context: ChatContext, args: string) => Promise<CompleterResult>
    continuePrompt?: (context: ChatContext, args: string) => boolean
}
