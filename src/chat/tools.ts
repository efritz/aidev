import chalk from 'chalk'
import { AssistantMessage, ToolResult, ToolUse } from '../messages/messages'
import { ExecutionContext } from '../tools/context'
import { ExecutionResult } from '../tools/tool'
import { findTool } from '../tools/tools'

export async function runToolsInMessages(
    context: ExecutionContext,
    messages: AssistantMessage[],
): Promise<{ ranTools: boolean; reprompt: boolean }> {
    const tools = messages.flatMap(m => (m.type !== 'tool_use' ? [] : m.tools))
    const { reprompt } = await runTools(context, tools)

    return { ranTools: tools.length > 0, reprompt }
}

async function runTools(context: ExecutionContext, toolUses: ToolUse[]): Promise<{ reprompt: boolean }> {
    let repromptAny = false
    for (const toolUse of toolUses) {
        const { reprompt } = await runTool(context, toolUse)
        repromptAny = repromptAny || reprompt
    }

    return { reprompt: repromptAny }
}

async function runTool(context: ExecutionContext, toolUse: ToolUse): Promise<{ reprompt: boolean }> {
    const { reprompt, ...rest } = await executeTool(context, toolUse)
    const toolResult: ToolResult = { type: 'tool_result', toolUse, ...rest }

    if (toolResult.error) {
        console.log()
        console.log(chalk.red(`Error: ${toolResult.error.message}`))
    }

    context.provider.conversationManager.pushUser(toolResult)
    return { reprompt: reprompt ?? false }
}

async function executeTool(context: ExecutionContext, toolUse: ToolUse): Promise<ExecutionResult> {
    const tool = findTool(toolUse.name)
    const args = toolUse.parameters ? JSON.parse(toolUse.parameters) : {}

    try {
        return await tool.execute(context, toolUse.id, args)
    } catch (error: any) {
        return { error }
    }
}
