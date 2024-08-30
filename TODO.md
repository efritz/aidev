# TODO

## Features

### Diff view

-   Allow the user to edit diff chunks before writing a file, just like the user can modify commands.

### Context management

-   Include @file tags in user messages as context files.
-   Consolidate :load, @file, `read_files` and `read_directories` tools, and proactive editor content context.
-   Ensure messages describing file contents are always up to date (and that's clear in the system prompt).
-   Extract context management from the message flow/branching structure so it's global within a single conversation.
-   Allow users to control the context (remove files, for example).

### Personas

-   Allow additional assistant personas (defined by the user) to check each other's output.
