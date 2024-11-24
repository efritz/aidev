package commands

import "errors"

var (
	ErrInvalidArguments = errors.New("invalid arguments")
	ErrNotImplemented   = errors.New("not implemented")
)

type Command interface {
	Name() string
	Description() string
	Execute(args []string) error
}

type Registry interface {
	Register(cmd Command) error
	Get(name string) (Command, bool)
	List() []Command
}
