import { ExecutionContext } from './context'
import { longTask } from './editor/long-task'
import { editorNotice } from './editor/notice'
import { Tool } from './tool'

export const tools: Tool[] = [editorNotice, longTask]

export function findTool(name: string): Tool {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function executeTool(context: ExecutionContext, name: string, args: any): any {
    try {
        return findTool(name).execute(context, args)
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
