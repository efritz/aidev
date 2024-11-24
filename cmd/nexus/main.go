package main

import (
	"log"
	"os"

	"github.com/systemsoverload/nexus/internal/cli"
	"github.com/systemsoverload/nexus/internal/providers"
)

func main() {
	// Initialize provider factory
	factory, err := providers.NewFactory()
	if err != nil {
		log.Fatalf("Failed to initialize providers: %v", err)
	}

	// Get default provider
	provider, err := factory.GetDefaultProvider()
	if err != nil {
		log.Fatalf("No providers available: %v", err)
	}

	// Initialize CLI
	cli := cli.NewCLI(provider)
	if err := cli.Run(); err != nil {
		log.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}
