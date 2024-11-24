package commands

import (
	"fmt"

	"github.com/systemsoverload/nexus/internal/types"
)

type streamCommand struct {
	conversationHandler types.ConversationHandler
}

func NewStreamCommand(ch types.ConversationHandler) Command {
	return &streamCommand{
		conversationHandler: ch,
	}
}

func (c *streamCommand) Name() string {
	return ":stream"
}

func (c *streamCommand) Description() string {
	return "Toggle streaming mode for responses (on|off|status)"
}

func (c *streamCommand) Execute(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: :stream <on|off|status>")
	}

	switch args[0] {
	case "on":
		c.conversationHandler.SetStreamingMode(true)
		fmt.Println("Streaming mode enabled")
	case "off":
		c.conversationHandler.SetStreamingMode(false)
		fmt.Println("Streaming mode disabled")
	case "status":
		enabled := c.conversationHandler.IsStreamingEnabled()
		fmt.Printf("Streaming mode is %s\n", map[bool]string{true: "enabled", false: "disabled"}[enabled])
	default:
		return fmt.Errorf("invalid argument: %s (expected: on|off|status)", args[0])
	}

	return nil
}
