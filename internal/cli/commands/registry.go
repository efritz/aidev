package commands

type registry struct {
	commands map[string]Command
}

func NewRegistry() Registry {
	return &registry{
		commands: make(map[string]Command),
	}
}

func (r *registry) Register(cmd Command) error {
	r.commands[cmd.Name()] = cmd
	return nil
}

func (r *registry) Get(name string) (Command, bool) {
	cmd, ok := r.commands[name]
	return cmd, ok
}

func (r *registry) List() []Command {
	cmds := make([]Command, 0, len(r.commands))
	for _, cmd := range r.commands {
		cmds = append(cmds, cmd)
	}
	return cmds
}
