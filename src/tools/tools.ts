import { editFile } from './fs/edit_file'
import { readDirectories } from './fs/read_directories'
import { readFiles } from './fs/read_files'
import { writeFile } from './fs/write_file'
import { shellExecute } from './shell/shell_execute'
import { think } from './think/think'
import { addTodo } from './todo/add_todo'
import { cancelTodo } from './todo/cancel_todo'
import { completeTodo } from './todo/complete_todo'
import { SerializedToolResult, Tool, ToolResult } from './tool'
import { readWeb } from './web/read'
import { searchWeb } from './web/search'
import { searchWorkspaceEmbeddings } from './workspace/search_embeddings'
import { searchWorkspaceRipgrep } from './workspace/search_ripgrep'

const allTools: Tool<any, any>[] = [
    shellExecute,
    readDirectories,
    readFiles,
    writeFile,
    editFile,
    searchWorkspaceEmbeddings,
    searchWorkspaceRipgrep,
    searchWeb,
    readWeb,
    think,
    addTodo,
    completeTodo,
    cancelTodo,
]

export const enabledTools = allTools.filter(tool => tool.enabled)
export const enabledToolNames = () => enabledTools.map(({ name }) => name)
export const filterTools = (names?: string[]) => enabledTools.filter(({ name }) => (names ?? []).includes(name))

export function findTool(name: string): Tool<any, any> {
    const tool = enabledTools.find(tool => tool.name === name)
    if (!tool) {
        throw new Error(`Tool not found: ${name}`)
    }

    return tool
}

export function serializeToolResult(name: string, message: ToolResult<any>): SerializedToolResult {
    return findTool(name).serialize(message)
}
