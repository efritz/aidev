package cli

import (
	"fmt"
	"strings"

	"github.com/c-bata/go-prompt"
	"github.com/systemsoverload/nexus/internal/types"
)

type CLI struct {
	executor *Executor
}

func NewCLI(provider types.Provider) *CLI {
	return &CLI{
		executor: NewExecutor(provider),
	}
}

func (c *CLI) Run() error {
	p := prompt.New(
		c.execute,
		c.complete,
		prompt.OptionTitle("Nexus CLI"),
		prompt.OptionPrefix("nexus> "),
		prompt.OptionInputTextColor(prompt.Green),
	)
	p.Run()
	return nil
}

func (c *CLI) execute(input string) {
	if err := c.executor.Execute(input); err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}

func (c *CLI) complete(d prompt.Document) []prompt.Suggest {
	w := d.GetWordBeforeCursor()

	if len(w) == 0 || !strings.HasPrefix(w, ":") {
		return nil
	}

	suggestions := make([]prompt.Suggest, 0)
	for _, cmd := range c.executor.GetSuggestions() {
		suggestions = append(suggestions, prompt.Suggest{
			Text:        cmd.Name(),
			Description: cmd.Description(),
		})
	}

	return prompt.FilterHasPrefix(suggestions, w, true)
}
