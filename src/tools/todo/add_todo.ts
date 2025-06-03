import chalk from 'chalk'
import { ChatContext } from '../../chat/context'
import { TodoItem } from '../../context/todos'
import { Arguments, ExecutionResult, JSONSchemaDataType, Tool, ToolResult } from '../tool'

type AddTodoResult = {
    todo: TodoItem
}

export const addTodo: Tool<AddTodoResult> = {
    name: 'add_todo',
    description: [
        'Add a new task to the todo list for the current conversation.',
        'This helps track tasks that need to be completed during the conversation.',
    ].join(' '),
    parameters: {
        type: JSONSchemaDataType.Object,
        properties: {
            description: {
                type: JSONSchemaDataType.String,
                description: 'A description of the task that needs to be done.',
            },
        },
        required: ['description'],
    },
    enabled: true,
    replay: (_args: Arguments, { result }: ToolResult<AddTodoResult>) => {
        if (result) {
            console.log(`${chalk.green('✓')} Added todo: ${chalk.dim(result.todo.description)}`)
        }
    },
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        args: Arguments,
    ): Promise<ExecutionResult<AddTodoResult>> => {
        const { description } = args as { description: string }

        const todoId = generateTodoId()
        const todo: TodoItem = { id: todoId, description, status: 'pending' }
        context.provider.conversationManager.recordAddTodo(todoId, description)
        console.log(`${chalk.green('✓')} Added todo: ${chalk.dim(description)}`)

        return { result: { todo } }
    },
    serialize: ({ result }: ToolResult<AddTodoResult>) => ({
        result: { todoId: result?.todo.id },
    }),
}

function generateTodoId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
