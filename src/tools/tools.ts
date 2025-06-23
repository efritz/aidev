import { agent } from './agent/agent'
import { submitResult } from './agent/submit_result'
import { editFile } from './fs/edit_file'
import { readDirectories } from './fs/read_directories'
import { readFiles } from './fs/read_files'
import { writeFile } from './fs/write_file'
import { shellExecute } from './shell/shell_execute'
import { think } from './think/think'
import { addTodo } from './todo/add_todo'
import { cancelTodo } from './todo/cancel_todo'
import { completeTodo } from './todo/complete_todo'
import { AgentType, SerializedToolResult, Tool, ToolResult } from './tool'
import { readWeb } from './web/read'
import { searchWeb } from './web/search'
import { searchWorkspaceAgent } from './workspace/search_agent'
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
    searchWorkspaceAgent,
    searchWeb,
    readWeb,
    think,
    addTodo,
    completeTodo,
    cancelTodo,
    agent,
    submitResult,
]

export const enabledTools = allTools.filter(tool => tool.enabled)

export const filterTools = (allowedToolNames: string[] | undefined, agentType: AgentType) => {
    const tools = filterToolsUnvalidated(allowedToolNames, agentType)
    validateToolSet(tools)
    return tools
}

const filterToolsUnvalidated = (allowedToolNames: string[] | undefined, agentType: AgentType) => {
    if (allowedToolNames === undefined) {
        return enabledTools.filter(tool => tool.agentContext.some(ctx => ctx.type === agentType))
    }

    const tools = allowedToolNames.map(name => {
        const tool = enabledTools.find(tool => tool.name === name)
        if (!tool) {
            throw new Error(`Tool not found: ${name}`)
        }

        if (!tool.agentContext.some(ctx => ctx.type === agentType)) {
            throw new Error(`Tool not available in ${agentType} context: ${name}`)
        }

        return tool
    })

    const required = enabledTools.filter(tool =>
        tool.agentContext.some(({ type, required }) => type === agentType && required),
    )

    const allowedTools = [...new Set([...tools, ...required])]
    validateToolSet(allowedTools)
    return allowedTools
}

export const removeDisabledTools = (disabledToolNames: string[], agentType: AgentType) => {
    const tools = removeDisabledToolsUnvalidated(disabledToolNames, agentType)
    validateToolSet(tools)
    return tools
}

const removeDisabledToolsUnvalidated = (disabledToolNames: string[], agentType: AgentType) => {
    for (const name of disabledToolNames) {
        const tool = enabledTools.find(tool => tool.name === name)
        if (!tool) {
            throw new Error(`Tool not found: ${name}`)
        }

        const agentContext = tool.agentContext.find(ctx => ctx.type === agentType)
        if (!agentContext) {
            throw new Error(`Tool not available in ${agentType} context: ${name}`)
        }
        if (agentContext.required) {
            throw new Error(`Tool required in ${agentType} context: ${name}`)
        }
    }

    return enabledTools.filter(
        tool => tool.agentContext.some(ctx => ctx.type === agentType) && !disabledToolNames.includes(tool.name),
    )
}

const validateToolSet = (tools: Tool<any, any>[]) => {
    const toolNames = new Set(tools.map(tool => tool.name))

    for (const tool of tools) {
        const subTools = new Set(tool.requiredSubTools ?? [])

        if (subTools.size > 0 && subTools.isDisjointFrom(toolNames)) {
            throw new Error(`No subtools of ${tool.name} are available: ${[...subTools].sort().join(', ')}`)
        }
    }
}

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
