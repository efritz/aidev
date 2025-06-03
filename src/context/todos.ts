import { Message } from '../messages/messages'

export type TodoItem = {
    id: string
    description: string
    status: 'pending' | 'completed' | 'canceled'
}

export function getActiveTodos(messages: Message[]): TodoItem[] {
    const todos: Map<string, TodoItem> = new Map()
    for (const message of messages) {
        if (message.role !== 'meta') {
            continue
        }

        switch (message.type) {
            case 'addTodo':
                todos.set(message.taskId, {
                    id: message.taskId,
                    description: message.description,
                    status: 'pending',
                })
                break

            case 'completeTodo':
                todos.get(message.taskId)!.status = 'completed'
                break

            case 'cancelTodo':
                todos.get(message.taskId)!.status = 'canceled'
                break
        }
    }

    return Array.from(todos.values()).sort((a, b) => a.id.localeCompare(b.id))
}
