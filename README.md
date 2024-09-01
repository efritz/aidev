# Personalized AI assistant

## Usage

Available LLM API providers:

- Anthropic
- OpenAI
- Google
- Groq
- Ollama

Tools available to the LLMs:

- `shell_execute`: Execute a `zsh` command.
- `read_directories`: Reads the contents of directories into the conversation.
- `read_files`: Reads the contents of files into the conversation.
- `write_file`: Writes contents to a file on disk.

Meta commands:

- `:help`: Display available commands.
- `:exit`: Exit the conversation.
- `:save`: Save the conversation to a file.
- `:load`: Load file contents into the conversation.
- `:clear`: Clear all messages in the conversation.
- `:savepoint`: Mark a point in the conversation to which you can rollback.
- `:rollback`: Rollback to a previously defined savepoint.
- `:undo`: Undo the last user action.
- `:redo`: Redo the last undone action.
- `:status`: Show the branch topology of the conversation.
- `:branch <branch>`: Create a new branch in the conversation.
- `:switch <branch>`: Switch to an existing branch.
- `:rename <from_branch> <to_branch>`: Rename an existing branch.
- `:remove <branch>`: Remove a branch and all its messages.

Project configuration:

The root of your project (where you launch the CLI) can contain special files to configure the behavior of the assistant.

- aidev.system will be injected verbatim into the system prompt.
- aidev.ignore can contain gitignore-like patterns that will filter out files or directories from being read into the context.

## Running

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
node ./dist/main.js "$@"
```

### VSCode

```bash
yarn
yarn vsix
```

In VSCode, select `Extensions: Install from VSIX` from the command palette and select the `ai-0.0.0.vsix` payload from the above command.
