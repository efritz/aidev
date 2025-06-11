import chalk from 'chalk'
import { z } from 'zod'
import { ChatContext } from '../../chat/context'
import { TodoItem } from '../../context/todos'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const AddTodoSchema = z.object({
    description: z.string().describe('A description of the task that needs to be done.'),
})

type AddTodoArguments = z.infer<typeof AddTodoSchema>

type AddTodoResult = {
    todo: TodoItem
}

export const addTodo: Tool<typeof AddTodoSchema, AddTodoResult> = {
    name: 'add_todo',
    description: 'Add a new todo item.',
    schema: AddTodoSchema,
    enabled: true,
    replay: (_args: AddTodoArguments, { result }: ToolResult<AddTodoResult>) => {
        if (result) {
            console.log(`${chalk.green('✓')} Added todo: ${chalk.dim(result.todo.description)}`)
        }
    },
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        { description }: AddTodoArguments,
    ): Promise<ExecutionResult<AddTodoResult>> => {
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
