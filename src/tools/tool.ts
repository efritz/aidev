import { ChatContext } from '../chat/context'
import { RuleMatcherFactory } from '../rules/types'

export type Tool<T> = {
    name: string
    description: string
    parameters: ParametersSchema
    enabled: boolean
    execute: Executor<T>
    replay: Replayer<T>
    serialize: Serializer<T>
    ruleMatcherFactory?: RuleMatcherFactory
}

export type Executor<T> = (context: ChatContext, toolUseId: string, args: Arguments) => Promise<ExecutionResult<T>>
export type Arguments = Record<string, unknown>
export type ToolResult<T> = { result?: T; error?: Error; canceled?: boolean }
export type ExecutionResult<T> = ToolResult<T> & { reprompt?: boolean }
export type Replayer<T> = (args: Arguments, result: ToolResult<T>) => void
export type Serializer<T> = (result: ToolResult<T>) => string

export enum JSONSchemaDataType {
    Object = 'object',
    Array = 'array',
    String = 'string',
    Number = 'number',
    Boolean = 'boolean',
}

export type ParametersSchema = Omit<JSONSchemaObject, 'description'>

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
