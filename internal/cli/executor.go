// internal/cli/executor.go
package cli

import (
	"fmt"
	"os"
	"strings"

	"github.com/systemsoverload/nexus/internal/cli/commands"
	"github.com/systemsoverload/nexus/internal/types"
)

// Executor handles command execution and conversation management
type Executor struct {
	registry     commands.Registry
	conversation *ConversationHandler
}

// NewExecutor creates a new executor with the given provider
func NewExecutor(provider types.Provider) *Executor {
	reg := commands.NewRegistry()

	conversationHandler := NewConversationHandler(provider)

	// Register core commands. Uncomment as implemented
	reg.Register(commands.NewHelpCommand(reg))
	reg.Register(commands.NewQuitCommand())
	// reg.Register(commands.NewClearCommand())
	reg.Register(commands.NewBranchCommand())
	reg.Register(commands.NewStreamCommand(conversationHandler))
	// reg.Register(commands.NewSwitchCommand())
	// reg.Register(commands.NewStatusCommand())
	// reg.Register(commands.NewSaveCommand())
	// reg.Register(commands.NewLoadCommand())
	// reg.Register(commands.NewUnloadCommand())
	// reg.Register(commands.NewSavepointCommand())
	// reg.Register(commands.NewRollbackCommand())
	// reg.Register(commands.NewUndoCommand())
	// reg.Register(commands.NewRedoCommand())
	// reg.Register(commands.NewWriteCommand())
	// reg.Register(commands.NewUnstashCommand())

	return &Executor{
		registry:     reg,
		conversation: NewConversationHandler(provider),
	}
}

// Execute processes input and runs the appropriate command or handles conversation
func (e *Executor) Execute(input string) error {
	fmt.Fprintf(os.Stderr, "DEBUG Executor: Received input: %q\n", input)

	input = strings.TrimSpace(input)
	if input == "" {
		return nil
	}

	parts := strings.Fields(input)
	cmdName := parts[0]
	args := parts[1:]

	// Handle non-command input as conversation
	if !strings.HasPrefix(cmdName, ":") {
		fmt.Fprintf(os.Stderr, "DEBUG Executor: Handling as conversation\n")
		return e.conversation.Handle(input)
	}

	// Look up and execute command
	cmd, exists := e.registry.Get(cmdName)
	if !exists {
		return fmt.Errorf("unknown command: %s (type :help for available commands)", cmdName)
	}

	if err := cmd.Execute(args); err != nil {
		if err == commands.ErrInvalidArguments {
			return fmt.Errorf("invalid arguments for %s: %v", cmdName, err)
		}
		return fmt.Errorf("error executing %s: %v", cmdName, err)
	}

	return nil
}

// GetSuggestions returns command suggestions for auto-completion
func (e *Executor) GetSuggestions() []commands.Command {
	return e.registry.List()
}

// GetRegistry returns the command registry
func (e *Executor) GetRegistry() commands.Registry {
	return e.registry
}

// GetConversationHandler returns the conversation handler
func (e *Executor) GetConversationHandler() *ConversationHandler {
	return e.conversation
}
