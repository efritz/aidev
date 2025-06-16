import { z } from 'zod'
import zodToJsonSchema, { JsonSchema7ObjectType } from 'zod-to-json-schema'
import { ChatContext } from '../chat/context'
import { RuleMatcherFactory } from '../rules/types'

export type AgentType = 'main' | 'subagent'

export type AgentContext = {
    type: AgentType
    required: boolean
}

export type Tool<S extends z.ZodObject<any>, T> = {
    name: string
    description: string
    schema: S
    enabled: boolean
    agentContext: AgentContext[]
    execute: Executor<z.infer<S>, T>
    replay: Replayer<z.infer<S>, T>
    serialize: Serializer<T>
    ruleMatcherFactory?: RuleMatcherFactory
}

export type Executor<S, T> = (context: ChatContext, toolUseId: string, args: S) => Promise<ExecutionResult<T>>
export type ToolResult<T> = { result?: T; error?: Error; canceled?: boolean }
export type ExecutionResult<T> = ToolResult<T> & { reprompt?: boolean }
export type Replayer<S, T> = (args: S, result: ToolResult<T>) => void
export type SerializedToolResult = { result: any; suggestions?: string }
export type Serializer<T> = (result: ToolResult<T>) => SerializedToolResult

export const toJsonSchema = <S extends z.ZodObject<any>>(schema: S): JsonSchema7ObjectType =>
    zodToJsonSchema(schema) as JsonSchema7ObjectType
