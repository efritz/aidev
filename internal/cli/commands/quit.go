package commands

import (
	"os"
)

type quitCommand struct{}

func NewQuitCommand() Command {
	return &quitCommand{}
}

func (c *quitCommand) Name() string {
	return ":quit"
}

func (c *quitCommand) Description() string {
	return "Exit the Nexus CLI"
}

func (c *quitCommand) Execute(args []string) error {
	if len(args) > 0 {
		return ErrInvalidArguments
	}
	os.Exit(0)
	return nil // never reached, but keeps the compiler happy
}
