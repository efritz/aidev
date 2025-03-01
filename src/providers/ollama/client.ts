import { Ollama } from 'ollama'

export const ollamaClient = new Ollama({ host: process.env['OLLAMA_HOST'] || 'http://localhost:11434' })
