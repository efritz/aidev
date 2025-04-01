import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ParametersSchema } from '../../../tools/tool'
import { ExecutionContext } from './context'

export type Tool = {
    name: string
    description: string
    parameters: ParametersSchema
    execute: (context: ExecutionContext, args: any) => Promise<CallToolResult>
}
