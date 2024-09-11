# aidev: A personalized pair programming assistant

This project provides a personalized AI assistant that can be used through a CLI or as a VSCode extension. It supports multiple LLM API providers and offers various tools and commands for enhanced interaction.

## Prerequisites

Before running the AI assistant, ensure that:

1. The `code` command is available on your PATH. This is typically installed with Visual Studio Code.
2. For the VSCode extension to work properly, the CLI run instructions must be aliased to 'ai'. Add this alias to your shell configuration file:

```bash
alias ai='node /path/to/aidev/dist/cli.js'
```

Replace `/path/to/aidev` with the path to this project.

## Installation

### CLI

To build and run the latest from source:

```bash
yarn
yarn dev
```

Or:

```bash
yarn
yarn build
node ./dist/cli.js "$@"
```

### VSCode Extension

To build and install the VSCode extension:

```bash
yarn
yarn vsix
```

In VSCode, select `Extensions: Install from VSIX` from the command palette and select the `ai-0.0.0.vsix` payload from the above command.

## Usage

### LLM API Providers

Available LLM API providers:

- Anthropic
- OpenAI
- Google
- Groq
- Ollama

### Available Tools

Tools available to the LLMs:

- `shell_execute`: Execute a `zsh` command.
- `read_directories`: Reads the contents of directories into the conversation.
- `read_files`: Reads the contents of files into the conversation.
- `write_file`: Writes contents to a file.
- `edit_file`: Modifies the contents of an existing file.

### Meta Commands

The following meta commands have special behaviors to manipulate the context or conversation. All other user input is added as a user message to the conversation.

- `:help`: Display available commands.
- `:exit`: Exit the conversation.
- `:prompt`: Draft a prompt in VSCode.
- `:continue`: Re-prompt the agent without a user message.
- `:save`: Save the conversation to a file.
- `:load <patterns, ...>`: Load file contents into the conversation.
- `:loaddir <patterns, ...>`: Load directory entries into the conversation.
- `:unload [<patterns, ...>]`: Remove matching files or directories from the conversation.
- `:clear`: Clear all messages in the conversation.
- `:savepoint`: Mark a point in the conversation to which you can rollback.
- `:rollback <savepoint>`: Rollback to a previously defined savepoint.
- `:undo`: Undo the last user action.
- `:redo`: Redo the last undone action.
- `:status`: Show the branch topology of the conversation.
- `:branch <branch>`: Create a new branch in the conversation.
- `:switch <branch>`: Switch to an existing branch.
- `:rename <from_branch> <to_branch>`: Rename an existing branch.
- `:remove <branch>`: Remove a branch and all its messages.

### Project Configuration

The root of your project (where you launch the CLI) can contain special files to configure the behavior of the assistant:

- `aidev.system`: Will be injected verbatim into the system prompt.
- `aidev.ignore`: Can contain gitignore-like patterns that will filter out files or directories from being read into the context.

### VSCode Extension Features

The VSCode extension provides the following features:

1. "Open aidev" command in the VSCode command palette.
2. "Open aidev with a specific model" command in the VSCode command palette.
3. Quick access to "Open aidev" using the keyboard shortcut Command+Shift+I.
4. Automatic injection of open editor files into the conversation context when using the extension.

These commands and features make it easy to interact with the AI assistant directly from your VSCode environment.
