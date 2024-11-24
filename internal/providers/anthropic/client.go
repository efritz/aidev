// internal/providers/anthropic/client.go
package anthropic

import (
	"context"
	"fmt"
	"io"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/systemsoverload/nexus/internal/types"
)

// Ensure Provider implements the interface
var _ types.Provider = (*Provider)(nil)

type Provider struct {
	client *anthropic.Client
	model  string
}

func NewProvider(apiKey string, opts ...ClientOption) (types.Provider, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("API key is required")
	}

	client := anthropic.NewClient(option.WithAPIKey(apiKey))

	return &Provider{
		client: client,
		model:  "claude-3-sonnet-20240229",
	}, nil
}

func (p *Provider) GenerateCompletion(ctx context.Context, messages []types.Message) (string, error) {
	anthropicMessages := make([]anthropic.MessageParam, len(messages))
	for i, msg := range messages {
		switch msg.Role {
		case "user":
			anthropicMessages[i] = anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content))
		case "assistant":
			anthropicMessages[i] = anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content))
		default:
			return "", fmt.Errorf("unsupported role: %s", msg.Role)
		}
	}

	resp, err := p.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.Model(p.model)),
		MaxTokens: anthropic.Int(1024),
		Messages:  anthropic.F(anthropicMessages),
	})
	if err != nil {
		return "", fmt.Errorf("anthropic API error: %w", err)
	}

	// Get first text block content
	if len(resp.Content) > 0 {
		return resp.Content[0].Text, nil
	}

	return "", fmt.Errorf("no content in response")
}


func (p *Provider) StreamCompletion(ctx context.Context, messages []types.Message, writer io.Writer) error {
	// Convert our messages to Anthropic format
	anthropicMessages := make([]anthropic.MessageParam, len(messages))
	for i, msg := range messages {
		switch msg.Role {
		case "user":
			anthropicMessages[i] = anthropic.NewUserMessage(anthropic.NewTextBlock(msg.Content))
		case "assistant":
			anthropicMessages[i] = anthropic.NewAssistantMessage(anthropic.NewTextBlock(msg.Content))
		default:
			return fmt.Errorf("unsupported role: %s", msg.Role)
		}
	}

	stream := p.client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.F(anthropic.Model(p.model)),
		MaxTokens: anthropic.Int(1024),
		Messages:  anthropic.F(anthropicMessages),
	})

	message := anthropic.Message{}
	for stream.Next() {
		event := stream.Current()
		message.Accumulate(event)

		switch delta := event.Delta.(type) {
		case anthropic.ContentBlockDeltaEventDelta:
			if delta.Text != "" {
				if _, err := writer.Write([]byte(delta.Text)); err != nil {
					return fmt.Errorf("write error: %w", err)
				}
			}
		}
	}

	if err := stream.Err(); err != nil {
		return fmt.Errorf("stream error: %w", err)
	}

	// Add final newline
	_, err := writer.Write([]byte("\n"))
	return err
}

// Optional configuration
type ClientOption func(*Provider)

func WithModel(model string) ClientOption {
	return func(p *Provider) {
		p.model = model
	}
}
