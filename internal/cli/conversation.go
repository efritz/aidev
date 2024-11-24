package cli

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/systemsoverload/nexus/internal/types"
)

var _ types.ConversationHandler = (*ConversationHandler)(nil)

type ConversationHandler struct {
	ctx           *ConversationContext
	provider      types.Provider
	streamingMode bool
}

type ConversationContext struct {
	CurrentBranch string
	Messages      []types.Message
	Files         map[string]string
}

func NewConversationHandler(provider types.Provider) *ConversationHandler {
	return &ConversationHandler{
		ctx: &ConversationContext{
			CurrentBranch: "main",
			Messages:     make([]types.Message, 0),
		},
		provider:      provider,
		streamingMode: true, // Default to streaming
	}
}

func (h *ConversationHandler) SetStreamingMode(enabled bool) {
	h.streamingMode = enabled
}

func (h *ConversationHandler) IsStreamingEnabled() bool {
	return h.streamingMode
}

func (h *ConversationHandler) Handle(input string) error {
	h.ctx.Messages = append(h.ctx.Messages, types.Message{
		Role:      "user",
		Content:   input,
		Timestamp: time.Now(),
	})

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var responseBuffer bytes.Buffer

	if h.streamingMode {
		// Stream to both console and buffer
		writer := io.MultiWriter(os.Stdout, &responseBuffer)

		if err := h.provider.StreamCompletion(ctx, h.ctx.Messages, writer); err != nil {
			return fmt.Errorf("failed to generate response: %w", err)
		}
	} else {
		// Use non-streaming mode
		response, err := h.provider.GenerateCompletion(ctx, h.ctx.Messages)
		if err != nil {
			return fmt.Errorf("failed to generate response: %w", err)
		}

		// Write to buffer and console
		fmt.Println(response)
		responseBuffer.WriteString(response)
	}

	// Add response to history
	h.ctx.Messages = append(h.ctx.Messages, types.Message{
		Role:      "assistant",
		Content:   responseBuffer.String(),
		Timestamp: time.Now(),
	})

	return nil
}
