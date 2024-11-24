package commands

import "fmt"

type branchCommand struct {
	// Dependencies would go here
}

func NewBranchCommand() Command {
	return &branchCommand{}
}

func (c *branchCommand) Name() string {
	return ":branch"
}

func (c *branchCommand) Description() string {
	return "Create a new branch in the conversation"
}

func (c *branchCommand) Execute(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("%w: usage: :branch <branch>", ErrInvalidArguments)
	}
	return ErrNotImplemented
}
