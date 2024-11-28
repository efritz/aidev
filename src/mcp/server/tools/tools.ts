import { CallToolResult } from '@modelcontextprotocol/sdk/types'
import { ExecutionContext } from './context'
import { longTask } from './editor/long-task'
import { Tool } from './tool'

export const tools: Tool[] = [longTask]

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
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        }
    }
}
