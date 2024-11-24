package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	ConfigDir = ".config/nexus/keys"
)

// ProviderConfig holds configuration for a specific provider
type ProviderConfig struct {
	Name     string
	EnvVar   string
	KeyFile  string
	Required bool
}

// Available providers and their configurations
var Providers = []ProviderConfig{
	{
		Name:     "anthropic",
		EnvVar:   "ANTHROPIC_API_KEY",
		KeyFile:  "anthropic.key",
		Required: true,
	},
	{
		Name:     "openai",
		EnvVar:   "OPENAI_API_KEY",
		KeyFile:  "openai.key",
		Required: false,
	},
}

// GetAPIKey attempts to get an API key for a provider in the following order:
// 1. Local config file (~/.config/nexus/keys/<provider>.key)
// 2. Environment variable
func GetAPIKey(provider ProviderConfig) (string, error) {
	// Try config file first
	key, err := readKeyFile(provider.KeyFile)
	if err == nil && key != "" {
		return key, nil
	}

	// Fall back to environment variable
	key = os.Getenv(provider.EnvVar)
	if key != "" {
		return key, nil
	}

	if provider.Required {
		return "", fmt.Errorf("no API key found for %s provider. Please either:\n"+
			"1. Create %s/%s with your API key, or\n"+
			"2. Set the %s environment variable",
			provider.Name, getConfigDir(), provider.KeyFile, provider.EnvVar)
	}

	return "", nil
}

// InitializeConfig ensures the config directory exists
func InitializeConfig() error {
	configDir := getConfigDir()
	return os.MkdirAll(configDir, 0700)
}

func getConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = "."
	}
	return filepath.Join(home, ConfigDir)
}

func readKeyFile(filename string) (string, error) {
	configDir := getConfigDir()
	keyPath := filepath.Join(configDir, filename)

	data, err := os.ReadFile(keyPath)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(data)), nil
}
