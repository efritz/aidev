import { editorNotice } from './editor/notice'
import { Tool } from './tool'

export const tools: Tool[] = [editorNotice]

export function findTool(name: string): Tool {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}
