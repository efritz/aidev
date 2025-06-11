import chalk from 'chalk'
import { getActiveTodos } from '../context/todos'
import { Response, ToolResult, ToolUse } from '../messages/messages'
import { matchNewPostInvocationRules, matchNewPreInvocationRules } from '../rules/matcher'
import { Rule } from '../rules/types'
import { ExecutionResult } from '../tools/tool'
import { findTool } from '../tools/tools'
import { generateRandomName } from '../util/random/random'
import { ChatContext } from './context'
import { promptWithPrefixes } from './output'

export async function runToolsInResponse(
    context: ChatContext,
    response: Response,
    signal?: AbortSignal,
): Promise<boolean> {
    const toolUses = response.messages.flatMap(m => (m.type !== 'tool_use' ? [] : m.tools)).map(canonicalizeTool)
    if (toolUses.length === 0) {
        return false
    }

    // Prior to invoking tools requested by the model, we check if there are any pre-tool
    // rules not yet in the conversation that need to be applied. If so, we'll pop the last
    // tool use message from the conversation, add the rules, and then re-prompt the model.
    const newPreInvocationRules = matchNewPreInvocationRules(context, toolUses)
    if (newPreInvocationRules.length > 0) {
        return reviseToolUses(context, toolUses, newPreInvocationRules, signal)
    }

    // If there are no new tool uses to add to the conversation, invoke the requested tools.
    return runTools(context, toolUses, signal)
}

const rulePrefixes = {
    progressPrefix: 'Applying rules to tool use...',
    successPrefix: 'Applied rules to tool use.',
    failurePrefix: 'Failed to apply rules to tool use.',
}

async function reviseToolUses(
    context: ChatContext,
    toolUses: ToolUse[],
    rules: Rule[],
    signal?: AbortSignal,
): Promise<boolean> {
    console.log(rules.map(rule => `${chalk.dim('ℹ')} Activating rule "${chalk.red(rule.description)}"`).join('\n'))
    console.log()

    // Pop messages including and after the earliest target tool use message.
    const messages = context.provider.conversationManager.messages()
    const indexes = toolUses.map(tool => messages.findIndex(m => m.id === tool.id))
    const earliestIndex = Math.min(...indexes)
    const messagesUpToTool = messages.slice(0, earliestIndex)

    // Replace the tool uses with matching rules.
    context.provider.conversationManager.setMessages(messagesUpToTool)
    context.provider.conversationManager.addRules(rules)

    // Re-prompt the model with the updated conversation.
    const result = await promptWithPrefixes(context, rulePrefixes, signal)
    if (!result.ok) {
        throw result.error
    }

    // Recurse - if new rules applied, we'll repeat the process.
    return runToolsInResponse(context, result.response, signal)
}

function canonicalizeTool(toolUse: ToolUse): ToolUse {
    if (!toolUse.id) {
        toolUse.id = generateRandomName()
    }

    return toolUse
}

async function runTools(context: ChatContext, toolUses: ToolUse[], _signal?: AbortSignal): Promise<boolean> {
    let repromptAny: boolean | undefined
    const toolResults: { toolUse: ToolUse; result?: any; error?: Error; canceled?: boolean }[] = []

    const queue = [...toolUses]
    while (queue.length > 0) {
        const toolUse = queue.shift()!
        const { reprompt, ...result } = await executeTool(context, toolUse)
        toolResults.push({ toolUse, ...result })

        if (reprompt === false) {
            // If a single tool explicitly cancels the reprompt, we cancel all of the remaining tools and throw
            // control directly back to the user so we can get back on track.
            //
            // Note that we don't add new rules for with an explicit non-reprompt, as the only cases where a tool
            // explicitly cancels a reprompt is when the user cancels the operation - nothing should have occurred
            // for a rule to apply here.

            queue.forEach(canceledToolUse => toolResults.push({ toolUse: canceledToolUse, canceled: true }))
            pushToolResults(context, toolResults)
            return false
        }

        if (reprompt === true) {
            // If any tool explicitly requests a reprompt, we'll throw control back
            // to the assistant after these tools finishes executing.
            repromptAny = reprompt
        }
    }

    // Combine all tool results in a single user message (as expected by the LLM provdiers).
    pushToolResults(context, toolResults)

    // After invoking tools requested by the model, we check to see if there are any post-tool rules not yet in
    // the conversation that need to be applied. If so, we'll add them to the context. This is much easier than
    // pre-tool rule application, as there's no need to redo any part of the conversation - we're only guiding
    // the assistant's next stpes.
    const postInvocationRules = matchNewPostInvocationRules(context, toolUses)
    if (postInvocationRules.length > 0) {
        console.log(
            postInvocationRules
                .map(rule => `${chalk.dim('ℹ')} Activating rule "${chalk.red(rule.description)}"`)
                .join('\n'),
        )

        context.provider.conversationManager.addRules(postInvocationRules)

        // Always re-prompt the model after adding a new post-tool rule.
        return true
    }

    if (repromptAny === true) {
        // Some tool explicitly requested a re-prompt
        return true
    }

    if (repromptAny === false) {
        // Some tool explicitly requested to not re-prompt
        return false
    }

    // All tools are ambivalent; check if we have any pending todos
    return (
        getActiveTodos(context.provider.conversationManager.visibleMessages()).filter(t => t.status === 'pending')
            .length > 0
    )
}

function pushToolResults(context: ChatContext, results: ToolResult[]): void {
    context.provider.conversationManager.pushUser({ type: 'tool_result', results })
}

async function executeTool(context: ChatContext, toolUse: ToolUse): Promise<ExecutionResult<any>> {
    const tool = findTool(toolUse.name)

    try {
        return await tool.execute(
            context,
            toolUse.id,
            tool.schema.parse(toolUse.parameters ? JSON.parse(toolUse.parameters) : {}),
        )
    } catch (error: any) {
        console.log()
        console.log(chalk.red(`Error: ${error.message}`))

        return { error }
    }
}
