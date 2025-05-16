# aidev: A personalized pair programming assistant

This project provides a personalized AI assistant that can be used through a CLI or as a VSCode extension. It supports multiple LLM API providers and offers various tools and commands for enhanced interaction.

## Prerequisites

Before running the AI assistant, ensure that:

1. A `preferences.yaml` file exist at the target location. This controls which providers and models are available to aidev.

   ```bash
   # Create the preferences directory
   mkdir -p ~/.config/aidev

   # Move the sample preferences to the target location
   cp ./configs/preferences.default.yaml ~/.config/aidev/preferences.yaml
   ```

   The default location for this file is in `~/.config/aidev/`, but you can override this location by setting the `AIDEV_PREFERENCES_DIR` environment variable:

   ```bash
   export AIDEV_PREFERENCES_DIR="/custom/path/to/preferences/dir"
   ```

   Any model (chat or embedding provider) can be configured with a `maxConcurrent` and/or `maxPerSecond` parameter to limit the number of requests per process.

2. API keys are configured for your chosen LLM provider(s). Store your API keys in `~/.config/aidev/keys/` following this convention:

   ```bash
   # Create the config directory
   mkdir -p ~/.config/aidev/keys

   # Store your API keys (one per file)
   echo 'your-api-key' > ~/.config/aidev/keys/openai.key
   chmod 600 ~/.config/aidev/keys/*.key  # Secure the files
   ```

   By default, keys are stored in `~/.config/aidev/keys`, but you can override this location by setting the `AIDEV_KEY_DIR` environment variable:

   ```bash
   export AIDEV_KEY_DIR="/custom/path/to/keys/dir"
   ```

   Key files for each provider are required to use the provider's configured models:

   - `anthropic.key`
   - `openai.key`
   - `google.key`
   - `deepseek.key`
   - `groq.key`

3. The `code` command is available on your PATH. This is typically installed with Visual Studio Code.

4. For the VSCode extension to work properly, the CLI run instructions must be aliased to 'ai'. Add this alias to your shell configuration file:

   ```bash
   alias ai='bun --cwd /path/to/aidev dev "--cwd" "${PWD}" "$@"'
   ```

   Replace `/path/to/aidev` with the path to this project.

## Installation

### CLI

To build and run the latest from source:

```bash
bun install
bun dev
```

### VSCode Extension

To build and install the VSCode extension:

```bash
bun install
bun package
```

In VSCode, select `Extensions: Install from VSIX` from the command palette and select the `ai-0.0.0.vsix` payload from the above command.

## Usage

### LLM API Providers

Available LLM API providers:

- Anthropic
- DeepSeek
- Google
- Groq
- Ollama
- OpenAI
- OpenRouter

### Available Tools

Tools available to the LLMs:

- `shell_execute`: Execute a shell command command.
- `read_directories`: Reads the contents of directories into the conversation.
- `read_files`: Reads the contents of files into the conversation.
- `write_file`: Writes contents to a file.
- `edit_file`: Modifies the contents of an existing file.
- `search_workspace_embeddings`: Searches a local embeddings index for files closely related to an arbitrary query.
- `search_workspace_ripgrep`: Searches the workspace using ripgrep for files containing the input query.
- `search_web`: Uses the Brave Search API to search the web. Add a `brave.key` alongside provider keys to enable.
- `read_web`: Reads and summarizes the contents of a set of URLs.

### Meta Commands

The following meta commands have special behaviors to manipulate the context or conversation. All other user input is added as a user message to the conversation.

- `:branch <branch>`: Create a new branch in the conversation.
- `:clear`: Clear all messages in the conversation.
- `:continue`: Re-prompt the model without a user message.
- `:cost`: Show token counts of calls to remote LLM APIs in this conversation.
- `:exit`: Exit the conversation.
- `:help`: Display available commands.
- `:load <patterns, ...>`: Load file contents into the conversation.
- `:loaddir <patterns, ...>`: Load directory entries into the conversation.
- `:model <model>`: Change the model backing the assistant.
- `:models`: List available models.
- `:prompt`: Draft a prompt in VSCode.
- `:redo`: Redo the last undone action.
- `:remove <branch>`: Remove a branch and all its messages.
- `:rename <from_branch> <to_branch>`: Rename an existing branch.
- `:rollback <savepoint>`: Rollback to a previously defined savepoint.
- `:save`: Save the conversation to a file.
- `:savepoint <name>`: Mark a point in the conversation to which you can rollback.
- `:shell`: Run a shell command and include its output in the conversation.
- `:status`: Show the branch topology of the conversation.
- `:switch <branch>`: Switch to an existing branch.
- `:undo`: Undo the last user action.
- `:unload [<patterns, ...>]`: Remove matching files or directories from the conversation.
- `:unstash [<patterns, ...>]`: Remove stashed file(s) from the chat context.
- `:write <path>`: Write a stashed file to disk.

### Project Configuration

The root of your project (where you launch the CLI) can contain special files to configure the behavior of the assistant:

- `.aidev/system`: Will be injected verbatim into the system prompt.
- `.aidev/ignore`: Can contain gitignore-like patterns that will filter out files or directories from being read into the context.
- `.aidev/rules/<rule>.md`: Instructions to supply to the assistant to guide a particular action. Rule content contains free-form instructions, but must have valid YAML front matter indicating when the rule applies:

```yaml
---
description: lint
tool: write_file
timing: post
paths: '*.ts'
---

After writing TypeScript files, check for lint errors via `bun eslint`.
```

The `tool` field can be a subset of the tools supplied to the model. The tool type indicates which additional fields should be supplied.
- When the tool is `write_file`, also supply a `paths` field with a glob of file paths relevant for the rule.
- When the tool is `shell_execute`, also supply a `command` field with a regular expression matching relevant shell commands for the rule.

The `timing` field may be either `pre` or `post`. A `pre`-tool invocation rule may cause a tool use to be revised before being presented to the user. A `post`-tool invocation rule may cause the assistant to perform additional actions after a tool is invoked.

### VSCode Extension Features

The VSCode extension provides the following features:

1. "Open aidev" command in the VSCode command palette.
2. "Open aidev with a specific model" command in the VSCode command palette.
3. Quick access to "Open aidev" using the keyboard shortcut Command+Shift+I.
4. Automatic injection of open editor files into the conversation context when using the extension.

These commands and features make it easy to interact with the AI assistant directly from your VSCode environment.
