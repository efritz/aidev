import { editFile } from './fs/edit_file'
import { readDirectories } from './fs/read_directories'
import { readFiles } from './fs/read_files'
import { writeFile } from './fs/write_file'
import { shellExecute } from './shell/shell_execute'
import { Tool, ToolResult } from './tool'
import { searchWeb } from './web/search'
import { searchWorkspace } from './workspace/search'

const allTools: Tool<any>[] = [
    shellExecute,
    readDirectories,
    readFiles,
    writeFile,
    editFile,
    searchWorkspace,
    searchWeb,
]

export const enabledTools = allTools.filter(tool => tool.enabled)

export function findTool(name: string): Tool<any> {
    const tool = enabledTools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function serializeToolResult(name: string, message: ToolResult<any>): string {
    return findTool(name).serialize(message)
}
