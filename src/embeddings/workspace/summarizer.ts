import { Agent, runAgent } from '../../agent/agent'
import { ChatContext } from '../../chat/context'
import { CancelError } from '../../util/interrupts/interrupts'
import { createXmlPattern } from '../../util/xml/xml'
import { RawEmbeddableContent } from '../store/store'
import { CodeBlock } from './code'

export interface Summary {
    signature: string
    comment: string
    detailedSummary: string
    conciseSummary: string
}

export async function summarizeCodeBlocks(
    context: ChatContext,
    file: RawEmbeddableContent,
    blocks: CodeBlock[],
    signal: AbortSignal,
    onFinish: () => void,
): Promise<Map<CodeBlock, Summary>> {
    // Keep a map of code blocks to summary promises
    const memo = new Map<CodeBlock, Promise<{ result?: Summary; error: Error }>>()

    const populateSummaries = (block: CodeBlock) => {
        // Ensure we populate children promises into the memo map before we attempt
        // to summarize the parent, which will expect the children promises to be
        // referenceable (but not necessarily resolved).
        for (const child of block.children) {
            populateSummaries(child)
        }

        // Summarize each block, passing it the memoized map containing a resolvable
        // promise for each of their children. We want the summarizer agent to have
        // access to the concise summaries of their children when summarizing the
        // parent, as we'll include this information in the metadata being embedded
        // and don't want to have unnecessarily redundant information
        summarizeCodeBlock(context, file, block, memo, signal, onFinish)
    }

    // Walk each block so that children are resolved before parents
    for (const block of blocks) {
        populateSummaries(block)
    }

    // Resolve each promise in the valuee of the memoized map
    const summariesByBlock = new Map<CodeBlock, Summary>()
    await Promise.all([...memo.values()])
    for (const [block, promise] of memo.entries()) {
        const { result, error } = await promise

        if (error) {
            if (signal?.aborted) {
                // Return generic error on cancellation instead of leaking any partial
                // work that was completed before cancellation. If we don't do this we
                // may get odd messages about partial summary payloads being returned.
                throw new CancelError('Agent aborted.')
            }

            throw error
        }

        if (!result) {
            throw new Error('Promise settled with undefined result')
        }

        summariesByBlock.set(block, result)
    }

    return summariesByBlock
}

async function summarizeCodeBlock(
    context: ChatContext,
    file: RawEmbeddableContent,
    block: CodeBlock,
    summaryPromises: Map<CodeBlock, Promise<{ result?: Summary; error?: Error }>>,
    signal: AbortSignal,
    onFinish: () => void,
): Promise<void> {
    // We may call this method more than once per block; avoid duplicate summarization.
    if (summaryPromises.has(block)) {
        return
    }

    const childSummaries = new Map<string, Promise<{ result?: Summary; error?: Error }>>()
    for (const child of block.children) {
        const promise = summaryPromises.get(child)
        if (!promise) {
            throw new Error('Child summary not found')
        }

        childSummaries.set(child.name, promise)
    }

    // Pass map of children blocks to a promise resolving that child's summary to the
    // summarizer agent. We'll then store our own promise in the shared memoized map
    // so that any parent blocks can access this summary.
    const promise = runAgent(context, summarizerAgent, { file, block, childSummaries }, signal)
    summaryPromises.set(
        block,
        promise
            // Call the onFinish callback to signal to the user we've made partial
            // progress on this batch of block summarizer agents.
            .then(v => {
                onFinish()
                return { result: v }
            })
            // Ignore errors happening from this promise _during tree construction_.
            // We will await these promises when iterating the memoized map later,
            // which will throw the stashed error on a rejection.
            .catch((error: any) => ({ error })),
    )
}

const summarizerAgent: Agent<
    {
        file: RawEmbeddableContent
        block: CodeBlock
        childSummaries: Map<string, Promise<{ result?: Summary; error?: undefined }>>
    },
    Summary
> = {
    model: context => context.preferences.summarizerModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async (_, { file, block, childSummaries }) => {
        const resolvedChildSummaries: string[] = []
        for (const [name, summary] of childSummaries.entries()) {
            resolvedChildSummaries.push(`- ${name}: ${(await summary)?.result?.conciseSummary ?? ''}`)
        }

        return userMessageTemplate
            .replace('{{file}}', file.content)
            .replace('{{chunk}}', block.content)
            .replace('{{children}}', resolvedChildSummaries.sort().join('\n') ?? 'No children defined')
    },
    processMessage: async (_, content) => {
        if (content === '') {
            throw new Error('EMPTY CONTENT')
        }

        const signatureMatch = createXmlPattern('signature').exec(content)
        if (!signatureMatch) {
            throw new Error(`Summarizer did not provide a signature:\n\n${content}`)
        }

        const commentMatch = createXmlPattern('comment').exec(content)
        if (!commentMatch) {
            throw new Error(`Summarizer did not provide a comment:\n\n${content}`)
        }

        const detailedMatch = createXmlPattern('detailed').exec(content)
        if (!detailedMatch) {
            throw new Error(`Summarizer did not provide a detailed summary:\n\n${content}`)
        }

        const conciseMatch = createXmlPattern('concise').exec(content)
        if (!conciseMatch) {
            throw new Error(`Summarizer did not provide a concise summary:\n\n${content}`)
        }

        return {
            signature: signatureMatch[2].trim(),
            comment: commentMatch[2].trim(),
            detailedSummary: detailedMatch[2].trim(),
            conciseSummary: conciseMatch[2].trim(),
        }
    },
}

const systemPromptTemplate = `
You are a code chunk summarizer.
You are responsible for reading a source code file and producing a summary of a specific chunk within that file.

# Focus

Summaries should emphasize the behavior of the code from a product and feature perspective.
Thoroughly document the internal implementation, especially highlighting connections between the chunk and other chunks in the file.
For each chunk, analyze references to other chunks, including notes about the conditions under which they are used.

Keep the summaries as brief as possible without omitting any relevant information.
Only use information extracted directly from the chunk and the containing file.
Do not reiterate information that is obvious from the signature (such as a function name, parameter types, or return type).
Do not reiterate information from an attached doc comment, if one exists.
Do not reiterate information that's explicitly stated in the summary of a child chunk.

# Response

You should respond with four XML tags:

1. A <signature> tag including the type signature of the chunk.
If the chunk describes a variable, generate the type of that variable.
If the chunk describes a class, type, or interface, generate a signature of its fields and methods. Include parent classes and implemented interfaces.
If the chunk describes a function or method, generate a signature including the function name, its parameters, its return type, adn any type parameters or generics.
This tag should include ONLY the type signature of the chunk, and should mirror the syntax of the programming language in which the chunk is written.

2. A <comment> tag including the doc comment attached to the chunk.
The doc comment syntactically closest and most relevant to the chunk should be pulled verbatim from the file, without modification.
If there is no relevant doc comment in the file, the content of the tag should be empty.

3. A <concise> tag including a brief summary of the chunk.
The concise summary should emphasize the exteral behavior of the chunk.
The concise summary should focus on the overall purpose of the chunk, especially how it relates to its parent scope.
The concise summary will be inlined into the parent chunk's summary when chunks are nested (e.g. a function literal defined within another function).

4. A <detailed> tag including a detailed summary of the chunk.
The detailed summary should also include all of the information from the concise tag.
The detailed summary should additionally emphasize the internal implementation.
The detailed summary should emphasize the relation to other chunks.

Your response should contain nothing else but these four tags.
`

const userMessageTemplate = `
Here is the file containing the chunk:

\`\`\`
{{file}}
\`\`\`

Here is the code chunk to summarize:

\`\`\`
{{chunk}}
\`\`\`

Here are the summaries of the children:

{{children}}
`
