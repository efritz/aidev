import { editFile } from './fs/edit_file'
import { readDirectories } from './fs/read_directories'
import { readFiles } from './fs/read_files'
import { writeFile } from './fs/write_file'
import { shellExecute } from './shell/shell_execute'
import { Tool, ToolResult } from './tool'

export const tools: Tool<any>[] = [shellExecute, readDirectories, readFiles, writeFile, editFile]

export function findTool(name: string): Tool<any> {
    const tool = tools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function serializeToolResult(name: string, message: ToolResult<any>): string {
    let result = findTool(name).serialize(message)
    if (message.error) {
        return (result += `\n\nError: ${message.error.message}`)
    }

    return result
}
