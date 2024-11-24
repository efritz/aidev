package providers

import (
	"fmt"

	"github.com/systemsoverload/nexus/internal/config"
	"github.com/systemsoverload/nexus/internal/providers/anthropic"
	"github.com/systemsoverload/nexus/internal/providers/openai"
	"github.com/systemsoverload/nexus/internal/types"
)

type Factory struct {
	providers map[string]types.Provider
}

func NewFactory() (*Factory, error) {
	f := &Factory{
		providers: make(map[string]types.Provider),
	}

	// Initialize config directory
	if err := config.InitializeConfig(); err != nil {
		return nil, fmt.Errorf("failed to initialize config: %w", err)
	}

	// Initialize each provider
	for _, cfg := range config.Providers {
		key, err := config.GetAPIKey(cfg)
		if err != nil {
			return nil, err
		}

		if key == "" && !cfg.Required {
			continue
		}

		var provider types.Provider
		var initErr error

		switch cfg.Name {
		case "anthropic":
			provider, initErr = anthropic.NewProvider(key)
		case "openai":
			provider, initErr = openai.NewProvider(key)
		default:
			return nil, fmt.Errorf("unknown provider: %s", cfg.Name)
		}

		if initErr != nil {
			return nil, fmt.Errorf("failed to initialize %s provider: %w", cfg.Name, initErr)
		}

		f.providers[cfg.Name] = provider
	}

	return f, nil
}

func (f *Factory) GetProvider(name string) (types.Provider, error) {
	provider, exists := f.providers[name]
	if !exists {
		return nil, fmt.Errorf("provider not found: %s", name)
	}
	return provider, nil
}

func (f *Factory) GetDefaultProvider() (types.Provider, error) {
	for _, cfg := range config.Providers {
		if provider, exists := f.providers[cfg.Name]; exists {
			return provider, nil
		}
	}
	return nil, fmt.Errorf("no providers available")
}

func (f *Factory) ListProviders() []string {
	var names []string
	for name := range f.providers {
		names = append(names, name)
	}
	return names
}
