export type EmbeddedContent = {
    filename: string
    filehash: string
    content: string
    name?: string
    metadata?: string
}

export type Metadata = {
    header: string
    detail: string
}

export type RawEmbeddableContent = Omit<EmbeddedContent, 'name' | 'metadata'>

export type EmbeddableContent = RawEmbeddableContent & {
    name?: string
    metadata?: Metadata
}

export interface EmbeddingsStore {
    hashes(): Promise<Set<string>>
    save(batch: EmbeddableContent[]): Promise<void>
    delete(hashes: Set<string>): Promise<void>
    query(query: string): Promise<EmbeddedContent[]>
}

//
//

const charactersPerToken = 4
const tokenBudgetMinimum = 128
const tokenOverlapPercentage = 0.2

export function chunkMetadata(metadata: Metadata, maxInput: number): string[] {
    const tokenBudget = maxInput - metadata.header.length / charactersPerToken - tokenBudgetMinimum
    if (tokenBudget <= 0) {
        throw new Error('Chunk header is too large to embed')
    }

    return [...generateEmbeddablePages(metadata.detail, tokenBudget)].map(page =>
        (metadata.header + '\n\n' + page).trim(),
    )
}

// TODO - find more natural breaking points

// yield consecutive pages of the string that fit within the token budget for each page.
// Each consecutive page will overlap ~20% of the previous page to ensure we don't miss
// any relevant data on page boundaries when embedding the contenet
function* generateEmbeddablePages(body: string, tokenPerPage: number): Generator<string> {
    if (body.length === 0) {
        yield ''
        return
    }

    const charPerPage = Math.floor(tokenPerPage * charactersPerToken)
    const charOverlap = Math.floor(tokenPerPage * charactersPerToken * tokenOverlapPercentage)

    let start = 0
    while (start < body.length) {
        const end = start + charPerPage
        const page = body.substring(start, end)
        yield page

        if (end >= body.length) {
            return
        }
        start = end - charOverlap
    }
}
