import { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { ExecutionContext } from './context'

export type Tool = {
    name: string
    description: string
    schema: z.ZodObject<any>
    execute: (context: ExecutionContext, args: any) => Promise<CallToolResult>
}
