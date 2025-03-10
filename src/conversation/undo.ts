import { Message } from '../messages/messages'

export type UndoRedoManager = Omit<ReturnType<typeof createUndoRedoManager>, 'saveSnapshot'>

export function createUndoRedoManager(messages: () => Message[], setMessages: (messages: Message[]) => void) {
    const undoStack: Message[][] = []
    const redoStack: Message[][] = []

    const undo = (): boolean => {
        if (undoStack.length === 0) {
            return false
        }

        redoStack.push(messages())
        setMessages(undoStack.pop()!)
        return true
    }

    const redo = (): boolean => {
        if (redoStack.length === 0) {
            return false
        }

        undoStack.push(messages())
        setMessages(redoStack.pop()!)
        return true
    }

    const saveSnapshot = (): void => {
        undoStack.push(messages())
        redoStack.length = 0
    }

    return {
        undo,
        redo,
        saveSnapshot,
    }
}
