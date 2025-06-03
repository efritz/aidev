import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { getActiveTodos, TodoItem } from '../../context/todos'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type CompleteTodoResult = {
    todo?: TodoItem
}

export const completeTodo: Tool<CompleteTodoResult> = {
    name: 'complete_todo',
    description: [
        'Mark a todo item as completed.',
        'The todo item will be updated with a completed status and timestamp.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            todo_id: {
                type: JSONSchemaDataType.String,
                description: 'The unique ID of the todo item to mark as completed.',
            },
        },
        required: ['todo_id'],
    },
    enabled: true,
    replay: (_args: Arguments, { result, error }: ToolResult<CompleteTodoResult>) => {
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
        args: Arguments,
    ): Promise<ExecutionResult<CompleteTodoResult>> => {
        const { todo_id } = args as { todo_id: string }

        const todo = getActiveTodos(context.provider.conversationManager.visibleMessages()).find(t => t.id === todo_id)
        if (!todo) {
            throw new Error(`Todo item "${todo_id}" not found`)
        }
        if (todo.status !== 'pending') {
            throw new Error(`Todo item "${todo_id}" is not pending`)
        }

        todo.status = 'completed'
        context.provider.conversationManager.recordCompleteTodo(todo_id)
        console.log(`${chalk.green('✓')} Completed todo: ${chalk.dim(todo.description)}`)

        return { result: { todo } }
    },
    serialize: ({ error }: ToolResult<CompleteTodoResult>) => ({
        result: { error },
    }),
}
