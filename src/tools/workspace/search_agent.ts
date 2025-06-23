import chalk from 'chalk'
import { z } from 'zod'
import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { createXmlPattern } from '../../util/xml/xml'
import { ExecutionResult, Tool, ToolResult } from '../tool'

const SearchWorkspaceAgentSchema = z.object({
    query: z.string().describe('A free-form query describing what to search for in the workspace.'),
})

type SearchWorkspaceAgentArguments = z.infer<typeof SearchWorkspaceAgentSchema>

type SearchWorkspaceAgentResult = {
    summary: string
    relevantFiles: string[]
}

export const searchWorkspaceAgent: Tool<typeof SearchWorkspaceAgentSchema, SearchWorkspaceAgentResult> = {
    name: 'search_workspace_agent',
    description: [
        'Use an intelligent agent to search the workspace and provide a comprehensive summary of relevant files and contexts.',
        'The agent will use multiple search strategies and file reading to understand the codebase and provide contextual information.',
        'This tool is designed to help with high-level planning and understanding of existing code structure.',
    ].join(' '),
    schema: SearchWorkspaceAgentSchema,
    enabled: true,
    agentContext: [
        { type: 'main', required: false },
        { type: 'subagent', required: false },
    ],
    requiredSubTools: ['search_workspace_embeddings', 'search_workspace_ripgrep'],
    replay: ({ query }: SearchWorkspaceAgentArguments, { result, error }: ToolResult<SearchWorkspaceAgentResult>) => {
        if (!result) {
            console.log()
            console.log(chalk.bold.red(error))
            console.log()
        } else {
            console.log(`${chalk.dim('ℹ')} Workspace search agent completed for query: "${query}"`)
            console.log()
            displaySummary(result)
        }
    },
    execute: async (
        context: ChatContext,
        _toolUseId: string,
        { query }: SearchWorkspaceAgentArguments,
    ): Promise<ExecutionResult<SearchWorkspaceAgentResult>> => {
        console.log(`${chalk.dim('ℹ')} Starting workspace search agent for query: "${query}"...`)
        console.log()

        const agent: Agent<undefined, SearchWorkspaceAgentResult> = {
            model: (context: ChatContext) => context.preferences.subagentModel,
            allowedTools: () => [
                'search_workspace_embeddings',
                'search_workspace_ripgrep',
                'read_files',
                'read_directories',
            ],
            quiet: () => false,
            buildPrompt: async () => ({
                agentInstructions: agentInstructionsTemplate,
                instanceInstructions: instanceInstructionsTemplate.replace('{{query}}', query),
            }),
            processResult: async (_context: ChatContext, result: string, _args: any) => {
                const summaryMatch = createXmlPattern('summary').exec(result)
                if (!summaryMatch) {
                    throw new Error(`Workspace search agent did not provide a summary:\n\n${result}`)
                }

                const filesMatch = createXmlPattern('files').exec(result)
                if (!filesMatch) {
                    throw new Error(`Workspace search agent did not provide relevant files:\n\n${result}`)
                }

                const relevantFiles = filesMatch[2]
                    .trim()
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)

                return {
                    summary: summaryMatch[2].trim(),
                    relevantFiles,
                }
            },
        }

        const result = await context.interruptHandler.withInterruptHandler(signal =>
            runAgent(context, agent, undefined, { signal }),
        )

        console.log(`${chalk.dim('ℹ')} Workspace search agent completed.`)
        console.log()
        displaySummary(result)

        return { result }
    },
    serialize: ({ result, error }: ToolResult<SearchWorkspaceAgentResult>) => ({
        result: {
            summary: result?.summary,
            relevantFiles: result?.relevantFiles ?? [],
        },
        error,
    }),
}

function displaySummary(result: SearchWorkspaceAgentResult) {
    console.log(chalk.cyan.bold('Summary:'))
    console.log(result.summary)
    console.log()

    if (result.relevantFiles.length > 0) {
        console.log(chalk.cyan.bold('Relevant Files:'))

        for (const file of result.relevantFiles) {
            console.log(`  - ${chalk.red(file)}`)
        }
    }
}

const agentInstructionsTemplate = `
You are a workspace search agent designed to help understand and navigate codebases.
Your role is to intelligently search through a workspace and provide comprehensive summaries of relevant code and context.

## Your Capabilities

You have access to the following tools:
- search_workspace_embeddings: Use semantic search to find relevant code based on meaning and context
- search_workspace_ripgrep: Use text-based search to find specific patterns, function names, or keywords
- read_files: Read specific files to understand their contents and structure
- read_directories: Explore directory structures to understand project organization

## Your Task

When given a query, you should:

1. **Understand the Intent**: Analyze what the user is looking for - are they trying to understand existing functionality, find where something is implemented, or explore a particular domain?

2. **Search Strategically**: Use multiple search approaches:
   - Start with embeddings search for semantic understanding
   - Use ripgrep for specific terms, function names, or patterns
   - Follow up by reading relevant files to understand context

3. **Explore Systematically**: 
   - Read key files that seem most relevant
   - Explore directory structures to understand organization
   - Follow imports, references, and related code

4. **Synthesize Information**: Combine findings into a coherent understanding of:
   - What exists in the codebase related to the query
   - How different parts connect and relate
   - Key files and their purposes
   - Overall architecture and patterns

## Output Requirements

You must submit your final result using the submit_result tool with two XML sections:

1. **<summary>**: A comprehensive summary that includes:
   - Overview of what was found related to the query
   - Key concepts, patterns, or functionality discovered
   - How different components relate to each other
   - Important architectural or design decisions
   - Any gaps or areas that might need attention

2. **<files>**: A list of the most relevant file paths (one per line) that are central to understanding the queried topic. Include files that:
   - Contain core implementations
   - Define important interfaces or types
   - Provide configuration or setup
   - Contain tests that demonstrate usage
   - Are entry points or main modules

Focus on providing actionable insights that would help someone understand the codebase or plan changes effectively.
`

const instanceInstructionsTemplate = `
Please search the workspace and provide a comprehensive summary for the following query:

{{query}}

Use your available tools to thoroughly explore the codebase and understand what exists related to this query. 
Provide both a detailed summary of your findings and a list of the most relevant files.

Remember to use the submit_result tool with your final answer containing <summary> and <files> sections.
`
