import chalk from 'chalk'
import { Response, ToolUse } from '../messages/messages'
import { matchNewPostInvocationRules, matchNewPreInvocationRules } from '../rules/matcher'
import { Rule } from '../rules/types'
import { ExecutionResult } from '../tools/tool'
import { findTool } from '../tools/tools'
import { ProgressResult, withProgress } from '../util/progress/progress'
import { generateRandomName } from '../util/random/random'
import { ChatContext } from './context'
import { shouldReprompt } from './mediator'
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

export async function runTools(context: ChatContext, toolUses: ToolUse[], signal?: AbortSignal): Promise<boolean> {
    let repromptAny: boolean | undefined

    const queue = [...toolUses]
    while (queue.length > 0) {
        const { reprompt } = await runTool(context, queue.shift()!)

        if (reprompt === false) {
            // If a single tool explicitly cancels the reprompt, we cancel all of
            // the remaining tools and throw control directly back to the user so
            // we can get back on track.
            //
            // Note that we don't add new rules for with an explicit non-reprompt,
            // as the only cases where a tool explicitly cancels a reprompt is when
            // the user cancels the operation - nothing should have occurred for a
            // rule to apply here.

            queue.forEach(toolUse => cancelTool(context, toolUse))
            return false
        }

        if (reprompt === true) {
            // If any tool explicitly requests a reprompt, we'll throw control back
            // to the assistant after these tools finishes executing.
            repromptAny = reprompt
        }
    }

    // After invoking tools requested by the model, we check to see if there are any post-tool
    // rules not yet int he conversation that need to be applied. If so, we'll add them to the
    // context. This is much easier than pre-tool rule application, as there's no need to redo
    // any part of the conversation - we're only guiding the assistant's next stpes.
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

    // All tools are ambivalent; check with reprompt mediator if there is more required to fulfill
    // the current user request.
    const result = await shouldRepromptWithProgress(context, signal)
    if (!result.ok) {
        return false
    }

    return result.response
}

async function runTool(context: ChatContext, toolUse: ToolUse): Promise<{ reprompt?: boolean }> {
    const { reprompt, ...rest } = await executeTool(context, toolUse)
    pushToolResult(context, toolUse, { ...rest })
    return { reprompt }
}

function cancelTool(context: ChatContext, toolUse: ToolUse): void {
    pushToolResult(context, toolUse, { canceled: true })
}

function pushToolResult(
    context: ChatContext,
    toolUse: ToolUse,
    result: { result?: any; error?: Error; canceled?: boolean },
): void {
    context.provider.conversationManager.pushUser({ type: 'tool_result', toolUse, ...result })
}

async function executeTool(context: ChatContext, toolUse: ToolUse): Promise<ExecutionResult<any>> {
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

function shouldRepromptWithProgress(context: ChatContext, signal?: AbortSignal): Promise<ProgressResult<boolean>> {
    return withProgress(() => shouldReprompt(context, signal), {
        progress: () => 'Checking if re-prompt is necessary...',
        success: reprompt => (reprompt ? 'Assistant will continue...' : 'Assistant is done.'),
        failure: (_, error) => `Failed to check if re-prmopt is necessary.\n\n${chalk.red(error)}`,
    })
}
