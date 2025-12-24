export function processTemplate(template: string, args: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (match, placeholder) => {
        if (placeholder in args) {
            return args[placeholder]
        }
        // Keep placeholder if no matching argument
        return match
    })
}

export function extractPlaceholders(template: string): string[] {
    const matches = template.match(/\{(\w+)\}/g)
    if (!matches) {
        return []
    }

    return matches.map(match => match.slice(1, -1)) // Remove { and }
}

export function parseArguments(input: string): string[] {
    const args: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < input.length; i++) {
        const char = input[i]

        if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true
            quoteChar = char
        } else if (inQuotes && char === quoteChar) {
            inQuotes = false
            quoteChar = ''
        } else if (!inQuotes && char === ' ') {
            if (current.trim()) {
                args.push(current.trim())
                current = ''
            }
        } else {
            current += char
        }
    }

    if (current.trim()) {
        args.push(current.trim())
    }

    return args
}
