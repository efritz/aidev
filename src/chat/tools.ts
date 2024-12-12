import chalk from 'chalk'
import { AssistantMessage, ToolUse } from '../messages/messages'
import { ExecutionContext } from '../tools/context'
import { ExecutionResult } from '../tools/tool'
import { findTool } from '../tools/tools'
import { generateRandomName } from '../util/random/random'

export async function runToolsInMessages(
    context: ExecutionContext,
    messages: AssistantMessage[],
): Promise<{ ranTools: boolean; reprompt?: boolean }> {
    const tools = messages.flatMap(m => (m.type !== 'tool_use' ? [] : m.tools)).map(canonicalizeTool)
    const { reprompt } = await runTools(context, tools)
    return { ranTools: tools.length > 0, reprompt }
}

function canonicalizeTool(toolUse: ToolUse): ToolUse {
    if (!toolUse.id) {
        toolUse.id = generateRandomName()
    }

    return toolUse
}

async function runTools(context: ExecutionContext, toolUses: ToolUse[]): Promise<{ reprompt?: boolean }> {
    let repromptAny: boolean | undefined

    const queue = [...toolUses]
    while (queue.length > 0) {
        const { reprompt } = await runTool(context, queue.shift()!)

        if (reprompt === false) {
            // If a single tool explicitly cancels the reprompt, we cancel all of
            // the remaining tools and throw control directly back to the user so
            // we can get back on track.
            queue.forEach(toolUse => cancelTool(context, toolUse))
            return { reprompt: false }
        }

        if (reprompt === true) {
            // If any tool explicitly requests a reprompt, we'll throw control back
            // to the assistant after these tools finishes executing.
            repromptAny = reprompt
        }
    }

    return { reprompt: repromptAny }
}

async function runTool(context: ExecutionContext, toolUse: ToolUse): Promise<{ reprompt?: boolean }> {
    const { reprompt, ...rest } = await executeTool(context, toolUse)
    pushToolResult(context, toolUse, { ...rest })
    return { reprompt }
}

function cancelTool(context: ExecutionContext, toolUse: ToolUse): void {
    pushToolResult(context, toolUse, { canceled: true })
}

function pushToolResult(
    context: ExecutionContext,
    toolUse: ToolUse,
    result: { result?: any; error?: Error; canceled?: boolean },
): void {
    context.provider.conversationManager.pushUser({ type: 'tool_result', toolUse, ...result })
}

async function executeTool(context: ExecutionContext, toolUse: ToolUse): Promise<ExecutionResult<any>> {
    const tool = findTool(toolUse.name)
    const args = toolUse.parameters ? JSON.parse(toolUse.parameters) : {}

    try {
        return await tool.execute(context, toolUse.id, args)
    } catch (error: any) {
        console.log()
        console.log(chalk.red(`Error: ${error.message}`))

        return { error }
    }
}
