package types

// ConversationHandler defines the interface for conversation handling
type ConversationHandler interface {
	SetStreamingMode(enabled bool)
	IsStreamingEnabled() bool
	Handle(input string) error
}
