import { CallToolResult } from '@modelcontextprotocol/sdk/types'
import { errorToResult } from '../../tools/error'
import { ExecutionContext } from './context'
import { langServer } from './editor/langserver'
import { Tool } from './tool'

export const tools: Tool[] = [langServer]

export function findTool(name: string): Tool {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export async function executeTool(context: ExecutionContext, name: string, args: any): Promise<CallToolResult> {
    try {
        return await findTool(name).execute(context, args)
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return { content: [] }
        }

        return errorToResult(error)
    }
}
