import { readDirectories } from './fs/read_directories'
import { readFiles } from './fs/read_files'
import { writeFile } from './fs/write_file'
import { projectInfo } from './project/project_info'
import { shellExecute } from './shell/shell_execute'
import { Tool, ToolResult } from './tool'

export const tools: Tool[] = [shellExecute, readDirectories, readFiles, writeFile, projectInfo]

export function findTool(name: string): Tool {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function serializeToolResult(name: string, message: ToolResult): string {
    let result = findTool(name).serialize(message.result)
    if (message.error) {
        return (result += `\n\nError: ${message.error.message}`)
    }

    return result
}
