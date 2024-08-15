import { ExecutionContext } from './context'

export type Tool = {
    name: string
    description: string
    parameters: JSONSchemaObject
    execute: Executor
    replay: Replayer
    serialize: Serializer
}

export type Executor = (context: ExecutionContext, args: Arguments) => Promise<ExecutionResult>
export type Arguments = Record<string, unknown>
export type ToolResult = { result?: any; error?: Error }
export type ExecutionResult = ToolResult & { reprompt?: boolean }
export type Replayer = (args: Arguments, result: ToolResult) => void
export type Serializer = (result?: any) => string

export enum JSONSchemaDataType {
    Object = 'object',
    Array = 'array',
    String = 'string',
    Number = 'number',
    Boolean = 'boolean',
}

export type JSONSchemaType = JSONSchemaObject | JSONSchemaArray | JSONSchemaScalar

export type JSONSchemaObject = {
    type: JSONSchemaDataType.Object
    description: string
    properties: { [key: string]: JSONSchemaType }
    required: string[]
}

export type JSONSchemaArray = {
    type: JSONSchemaDataType.Array
    description: string
    items: JSONSchemaType
}

export type JSONSchemaScalar = {
    type: JSONSchemaDataType.String | JSONSchemaDataType.Number | JSONSchemaDataType.Boolean
    description: string
}
