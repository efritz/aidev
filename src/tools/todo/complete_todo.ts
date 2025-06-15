import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { getActiveTodos, TodoItem } from '../../context/todos'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const CompleteTodoSchema = z.object({
    todoId: z.string().describe('The unique ID of the todo item to mark as completed.'),
})

type CompleteTodoArguments = z.infer<typeof CompleteTodoSchema>

type CompleteTodoResult = {
    todo?: TodoItem
}

export const completeTodo: Tool<typeof CompleteTodoSchema, CompleteTodoResult> = {
    name: 'complete_todo',
    description: 'Mark an active todo item as completed.',
    schema: CompleteTodoSchema,
    enabled: true,
    agentContext: [
        { type: 'main', required: true },
        { type: 'subagent', required: false },
    ],
    replay: (_args: CompleteTodoArguments, { result, error }: ToolResult<CompleteTodoResult>) => {
        if (error) {
            // TODO - odd?
            console.log(chalk.bold.red(`Error completing todo: ${error.message}`))
        }

        if (result && result.todo) {
            console.log(`${chalk.green('✓')} Completed todo: ${chalk.dim(result.todo.description)}`)
        }
    },
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        { todoId }: CompleteTodoArguments,
    ): Promise<ExecutionResult<CompleteTodoResult>> => {
        const todo = getActiveTodos(context.provider.conversationManager.visibleMessages()).find(t => t.id === todoId)
        if (!todo) {
            throw new Error(`Todo item "${todoId}" not found`)
        }
        if (todo.status !== 'pending') {
            throw new Error(`Todo item "${todoId}" is not pending`)
        }

        todo.status = 'completed'
        context.provider.conversationManager.recordCompleteTodo(todoId)
        console.log(`${chalk.green('✓')} Completed todo: ${chalk.dim(todo.description)}`)

        return { result: { todo } }
    },
    serialize: ({ error }: ToolResult<CompleteTodoResult>) => ({
        result: { error },
    }),
}
