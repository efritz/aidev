package core

import "time"

type Message struct {
	Role      string
	Content   string
	Timestamp time.Time
}

type ConversationContext struct {
	CurrentBranch string
	Messages      []Message
	Files         map[string]string
}
