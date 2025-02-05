import { Agent, runAgent } from '../agent/agent'
import { ChatContext } from '../chat/context'
import { Message } from '../messages/messages'
import { createXmlPattern } from '../util/xml/xml'

export async function shouldReprompt(context: ChatContext, signal?: AbortSignal): Promise<boolean> {
    if (!context.preferences.reprompterModel) {
        return false
    }

    return runAgent(context, repromptMediator, undefined, signal)
}

const repromptMediator: Agent<never, boolean> = {
    model: context => context.preferences.reprompterModel,
    buildSystemPrompt: async () => systemPromptTemplate,
    buildUserMessage: async context =>
        userMessageTemplate.replace(
            '{{conversation}}',
            serializeMessages(context.provider.conversationManager.visibleMessages()),
        ),
    processMessage: async (_, content) => {
        const match = createXmlPattern('decision').exec(content)
        if (!match) {
            return false
        }

        return match[2].trim().toLocaleLowerCase() === 'reprompt'
    },
}

const systemPromptTemplate = `
You are a conversation mediator.
You are responsible for reading a transcript of a conversation between an AI assistant and a user and determining whose turn it is to speak next.
The AI assistant is engaged in a task that may require the use of tools.
The AI assistant has just invoked a tool and the result is now available in the conversation.
If the AI assistant has completed its response and fulfilled the user's request, you should determine that the AI assistant's turn is over.
If the current user request has not been completely fulfilled, you should determine that the AI assistant should continue speaking.

# User requests

The current user request may not be the most recent message user in the conversation.
There may be more recent user messages acknowledging or clarifying the AI assistant's response.
There may be more recent user messages with specific sub-requests attempting ot refine the AI assistant's response.

## Example 1

<conversation>
    <message role="user">Show me the filename and functions where the getKey function is used.</message>
    <message role="assistant">I'll help you find where the \`getKey\` function is used. Let me search through the project files.</message>
    <message role="tool_use" id="toolu_01BftBGXc8B21QqpGehBvXTH">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"find src -type f -name \\\"*.ts\\\" -o -name \\\"*.tsx\\\" | xargs grep -l \\\"getKey\\\"\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_01BftBGXc8B21QqpGehBvXTH" status="success">
        <result>{"output":[{"content":"src/providers/google/provider.ts\nsrc/providers/groq/provider.ts\nsrc/providers/keys.ts\nsrc/providers/anthropic/provider.ts\nsrc/providers/openai/provider.ts\n","type":"stdout"}]}</result>
    </message>
</conversation>

The current user request is "Show me the filename and functions where the getKey function is used".
The AI assistant performed an initial step to locate all the files where the \`getKey\` function is referenced.
The AI assistant has not yet discovered the functions in those files where the \`getKey\` function is used.
You should instruct the AI assistant to continue its response.

## Example 2

<conversation>
    <message role="user">Find the largest file under src and display its contents.</message>
    <message role="assistant">I'll help you find and examine the largest file under the src directory. Let me use the shell command to find this information.</message>
    <message role="tool_use" id="toolu_01Gs8FeqYsi7z7oiCoQtJENA">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"find src -type f -exec ls -l {} \\\\; | sort -n -k 5 | tail -n 1\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_01Gs8FeqYsi7z7oiCoQtJENA" status="success" />
    <message role="assistant">The largest file is \`src/conversation/conversation.ts\` at 18,083 bytes. Let me show you its contents:</message>
    <message role="tool_use" id="toolu_01LFqgJVBfauy8vQLVdJfEW7">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"cat src/conversation/conversation.ts\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_01LFqgJVBfauy8vQLVdJfEW7" status="canceled" />
    <message role="user">Can you confirm this is a text file?</message>
    <message role="assistant">Let me check the file type using the \`file\` command:</message>
    <message role="tool_use" id="toolu_01S7Mx2H5u2dUpyhkjkfhBZG">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"file src/conversation/conversation.ts\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_01S7Mx2H5u2dUpyhkjkfhBZG" status="success">
    <result>{"output":[{"content":"src/conversation/conversation.ts: ASCII text\n","type":"stdout"}]}</result>
</conversation>

The current user request is "Find the largest file under src and display its contents".
The AI assistant has found the largest file but has not yet displayed its contents.
The user has interrupted the AI assistant's response to ask for confirmation that the file is a text file.
The tool result has confirmed that the file is a text file, indicating the file content is safe to display.
You should instruct the AI assistant to continue its response.

## Example 3

<conversation>
    <message role="user">List current environment variables.</message>
    <message role="assistant">I'll help you list the current environment variables using the shell_execute function to run the \`env\` command.</message>
    <message role="tool_use" id="toolu_0189Mc8JPQKoo1dXy7VvnXsE">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"env\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_0189Mc8JPQKoo1dXy7VvnXsE" status="canceled" />
    <message role="user">Nevermind, show the current git branch instead.</message>
    <message role="assistant">I'll help you determine the current git branch using the \`git branch\` command.</message>
        <message role="tool_use" id="toolu_01FnJx1gU2VXdE4mJdZMdVTn">
        <name>shell_execute</name>
        <parameters>"{\"command\": \"git branch --show-current\"}"</parameters>
    </message>
    <message role="tool_result" id="toolu_01FnJx1gU2VXdE4mJdZMdVTn" status="success">
        <result>{"output":[{"content":"ef/system-prompt-improvements\n","type":"stdout"}]}</result>
    </message>
</conversation>

The current user request is "Show the current git branch instead".
The previous user request, "List current environment variables", is no longer relevant according to the user.
The AI assistant has successfully determined the current git branch.
You should instruct the AI assistant to end its response.

# Response

You should respond with two XML tags:

1. First, include your reasoning of the current converation's state in a <thought> tag. This tag should:
    - Identify and justify the current user request. Remember that the most recent request is not always the current one.
      The user request preceeding thed current request should either be finished, canceled, or the current request should not be a subtask of the preceeding request.
    - Summarize the AI assistant's response to the current request.
    - Evaluate whether the AI's response fully addresses the user's current request.
2. Second, include your decision in a <decision> tag.
    - Output DONE when the AI assistant should end its response.
    - Output REPROMPT if the AI assistant should continue its response.

Your response should contain nothing else but these two tags.
`

const userMessageTemplate = `
Here is the conversation transcript you need to analyze:

<conversation>
{{conversation}}
</conversation>
`

function serializeMessages(messages: Message[]): string {
    return messages
        .map((message, index) => {
            switch (message.type) {
                case 'text':
                    return `<message role="${message.role}">${message.content}</message>`

                case 'tool_use':
                    return message.tools
                        .map(({ id, name, parameters }) => {
                            return [
                                `<message role="tool_use" id="${id}">`,
                                `<name>${name}</name>`,
                                `<parameters>${JSON.stringify(parameters)}</parameters>`,
                                '</message>',
                            ].join('\n')
                        })
                        .join('\n')

                case 'tool_result':
                    if (index === messages.length - 1) {
                        return [
                            `<message role="tool_result" id="${message.toolUse.id}" status="${message.canceled ? 'canceled' : message.error ? 'error' : 'success'}">`,
                            ...(message.result ? [`<result>${JSON.stringify(message.result)}</result>`] : []),
                            ...(message.error ? [`<error>${message.error}</error>`] : []),
                            '</message>',
                        ].join('\n')
                    } else {
                        return `<message role="tool_result" id="${message.toolUse.id}" status="${message.canceled ? 'canceled' : message.error ? 'error' : 'success'}" />`
                    }
            }
        })
        .join('\n')
}
