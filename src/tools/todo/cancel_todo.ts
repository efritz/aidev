import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { getActiveTodos, TodoItem } from '../../context/todos'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type CancelTodoResult = {
    todo: TodoItem
}

export const cancelTodo: Tool<CancelTodoResult> = {
    name: 'cancel_todo',
    description: [
        'Cancel a todo item that is no longer needed.',
        'The todo item will be updated with a canceled status and timestamp.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            todo_id: {
                type: JSONSchemaDataType.String,
                description: 'The unique ID of the todo item to cancel.',
            },
        },
        required: ['todo_id'],
    },
    enabled: true,
    replay: (_args: Arguments, { result, error }: ToolResult<CancelTodoResult>) => {
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
        args: Arguments,
    ): Promise<ExecutionResult<CancelTodoResult>> => {
        const { todo_id } = args as { todo_id: string }

        const todo = getActiveTodos(context.provider.conversationManager.visibleMessages()).find(t => t.id === todo_id)
        if (!todo) {
            throw new Error(`Todo item "${todo_id}" not found`)
        }
        if (todo.status !== 'pending') {
            throw new Error(`Todo item "${todo_id}" is not pending`)
        }

        todo.status = 'canceled'
        context.provider.conversationManager.recordCancelTodo(todo_id)
        console.log(`${chalk.red('✗')} Canceled todo: ${chalk.dim(todo.description)}`)

        return { result: { todo } }
    },
    serialize: ({ error }: ToolResult<CancelTodoResult>) => ({
        result: { error },
    }),
}
