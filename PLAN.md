# File Edit Stash Feature Implementation Plan

## Core Functionality
- [x] Implement a stash data structure to store file contents (src/context/state.ts)
- [x] Modify write_file and edit_file tools to support stashing (src/tools/fs/write_file.ts, src/tools/fs/edit_file.ts)
- [x] Update tool execution responses to indicate when a file is stashed (src/tools/fs/write_file.ts, src/tools/fs/edit_file.ts)

## Context and Command Updates
- [x] Make stash accessible in exec and chat contexts (src/chat/context.ts, src/tools/context.ts)
- [x] Update :status command to display stashed files (src/chat/commands/conversation/status.ts)
- [x] Implement :unstash command to drop stashed files (new file: src/chat/commands/context/unstash.ts)
- [x] Implement :write command to write stashed files to disk (new file: src/chat/commands/context/write.ts)

## Testing and Documentation
- [x] Document new commands and functionality in README or user guide (README.md)

## Branching
- [ ] Update the way stashed files are stored so that it works well with branching

## Provider and System Prompt Updates
- [ ] Modify provider messages to include stashed file versions (src/providers/*/conversation.ts)
- [ ] Update system prompt to describe the new stashed files field (src/cli.ts)
