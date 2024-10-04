import chalk from 'chalk'
import { AssistantMessage, ToolResult, ToolUse } from '../messages/messages'
import { ExecutionContext } from '../tools/context'
import { ExecutionResult } from '../tools/tool'
import { findTool } from '../tools/tools'

export async function runToolsInMessages(
    context: ExecutionContext,
    messages: AssistantMessage[],
): Promise<{ ranTools: boolean; reprompt?: boolean }> {
    const tools = messages.flatMap(m => (m.type !== 'tool_use' ? [] : m.tools))
    const { reprompt } = await runTools(context, tools)
    return { ranTools: tools.length > 0, reprompt }
}

async function runTools(context: ExecutionContext, toolUses: ToolUse[]): Promise<{ reprompt?: boolean }> {
    let repromptAny = undefined
    for (const toolUse of toolUses) {
        const { reprompt } = await runTool(context, toolUse)

        if (reprompt === true) {
            repromptAny = true
        } else if (reprompt === false) {
            repromptAny = false
            // TODO - cancel all remaining tools as well
            // break
        }
    }

    return { reprompt: repromptAny }
}

async function runTool(context: ExecutionContext, toolUse: ToolUse): Promise<{ reprompt?: boolean }> {
    const { reprompt, ...rest } = await executeTool(context, toolUse)
    const toolResult: ToolResult = { type: 'tool_result', toolUse, ...rest }
    context.provider.conversationManager.pushUser(toolResult)
    return { reprompt }
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
