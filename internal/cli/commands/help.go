package commands

type helpCommand struct {
	reg Registry
}

func NewHelpCommand(reg Registry) Command {
	return &helpCommand{reg: reg}
}

func (c *helpCommand) Name() string {
	return ":help"
}

func (c *helpCommand) Description() string {
	return "Display available commands"
}

func (c *helpCommand) Execute(args []string) error {
	// Implementation here
	return nil
}
