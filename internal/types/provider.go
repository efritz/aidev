package types

import (
	"context"
	"io"
	"time"
)

type Message struct {
	Role      string
	Content   string
	Timestamp time.Time
}

// Provider interface now supports both streaming and non-streaming responses
type Provider interface {
	GenerateCompletion(ctx context.Context, messages []Message) (string, error)
	StreamCompletion(ctx context.Context, messages []Message, writer io.Writer) error
}
