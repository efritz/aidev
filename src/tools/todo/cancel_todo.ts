import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { getActiveTodos, TodoItem } from '../../context/todos'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const CancelTodoSchema = z.object({
    todoId: z.string().describe('The unique ID of the todo item to cancel.'),
})

type CancelTodoArguments = z.infer<typeof CancelTodoSchema>

type CancelTodoResult = {
    todo: TodoItem
}

export const cancelTodo: Tool<typeof CancelTodoSchema, CancelTodoResult> = {
    name: 'cancel_todo',
    description: [
        'Cancel a todo item that is no longer needed.',
        'Make multiple todo tool calls in the same response when managing ongoing work.',
    ].join(' '),
    schema: CancelTodoSchema,
    enabled: true,
    replay: (_args: CancelTodoArguments, { result, error }: ToolResult<CancelTodoResult>) => {
        if (error) {
            // TODO - odd?
            console.log(chalk.bold.red(`Error canceling todo: ${error.message}`))
        }

        if (result && result.todo) {
            console.log(`${chalk.red('✗')} Canceled todo: ${chalk.dim(result.todo.description)}`)
        }
    },
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        { todoId }: CancelTodoArguments,
    ): Promise<ExecutionResult<CancelTodoResult>> => {
        const todo = getActiveTodos(context.provider.conversationManager.visibleMessages()).find(t => t.id === todoId)
        if (!todo) {
            throw new Error(`Todo item "${todoId}" not found`)
        }
        if (todo.status !== 'pending') {
            throw new Error(`Todo item "${todoId}" is not pending`)
        }

        todo.status = 'canceled'
        context.provider.conversationManager.recordCancelTodo(todoId)
        console.log(`${chalk.red('✗')} Canceled todo: ${chalk.dim(todo.description)}`)

        return { result: { todo } }
    },
    serialize: ({ error }: ToolResult<CancelTodoResult>) => ({
        result: { error },
    }),
}
