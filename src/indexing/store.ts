import { mkdir } from 'fs/promises'
import path, { dirname } from 'path'
import { Database } from 'bun:sqlite'
import * as sqliteVec from 'sqlite-vec'
import type { EmbeddingsProvider } from '../providers/embeddings_provider'
import { exists } from '../util/fs/safe'
import { xdgCacheHome } from '../util/fs/xdgconfig'
import { hash } from '../util/hash/hash'

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

export type EmbeddingsStore = Awaited<ReturnType<typeof createSQLiteEmbeddingsStore>>

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

//
//

export async function createSQLiteEmbeddingsStore(client: EmbeddingsProvider) {
    const db = await initDatabase(dbFilePath(), client.dimensions)
    const selectHashes = prepSelectHashes(db)
    const deleteHashes = prepDeleteHashes(db)
    const insertHashes = prepInsertHashes(db)
    const selectEmbeddings = prepSelectEmbeddings(db)
    const insertEmbeddings = prepInsertEmbeddings(db)

    return {
        save: async (file: RawEmbeddableContent, batch: EmbeddableContent[], signal?: AbortSignal): Promise<void> => {
            // Chunks may too big to embed all at once. Chunk them into appropriate sizes. Each
            // of the chunk pages will be embedded into vectors that refer to the same batch item.
            const serializedChunksWithBatchIndex = batch.flatMap(({ content, metadata }, batchIndex) =>
                chunkMetadata(metadata ?? { header: '', detail: content }, client.maxInput).map(chunk => ({
                    chunk,
                    batchIndex,
                })),
            )

            // Embed all of the chunk pages in parallel
            const embeddings = await client.embed(
                serializedChunksWithBatchIndex.map(({ chunk }) => chunk),
                signal,
            )

            // Group the embeddings by the original batch index
            const embeddingsByBatchIndex = new Map<number, number[][]>()
            serializedChunksWithBatchIndex.forEach(({ batchIndex }, chunkIndex) => {
                embeddingsByBatchIndex.set(
                    batchIndex,
                    (embeddingsByBatchIndex.get(batchIndex) ?? []).concat([embeddings[chunkIndex]]),
                )
            })

            db.transaction(() => {
                insertHashes([{ name: file.filename, hash: file.filehash }])

                // Insert the embeddings produced for each batch item
                insertEmbeddings(
                    batch.map(({ filename, filehash, content, name, metadata }, index) => ({
                        filename,
                        filehash,
                        content,
                        name,
                        metadata: metadata ? metadata.header + '\n\n' + metadata.detail : '',
                        embeddings: embeddingsByBatchIndex.get(index)!,
                    })),
                )
            })()
        },

        delete: (hashes: Set<string>): Promise<void> => Promise.resolve(deleteHashes(hashes)),
        hashes: (): Promise<Set<string>> => Promise.resolve(selectHashes()),
        query: async (query: string): Promise<EmbeddedContent[]> => selectEmbeddings((await client.embed([query]))[0]),
    }
}

function dbFilePath(): string {
    return path.join(cacheDir(), `index.${hash(process.cwd())}.sqlite`)
}

function cacheDir(): string {
    return process.env['AIDEV_CACHE_DIR'] || path.join(xdgCacheHome(), 'aidev')
}

let initOnce: Promise<void> | undefined = undefined

function initCustomSQLite(): Promise<void> {
    if (!initOnce) {
        initOnce = new Promise<void>(async resolve => {
            const libsqlite3Path = await findSqliteDynamicLibraryPath()
            if (!libsqlite3Path) {
                throw new Error('Could not find sqlite3 dynamic library')
            }

            Database.setCustomSQLite(libsqlite3Path)
            resolve()
        })
    }

    return initOnce
}

async function findSqliteDynamicLibraryPath(): Promise<string | undefined> {
    const candidatePaths = [
        process.env['AIDEV_SQLITE3_DYNAMIC_LIBRARY_PATH'] ?? '', // Custom override path
        '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib', // Homebrew on MacOS
    ]

    for (const path of candidatePaths) {
        if (path && (await exists(path))) {
            return path
        }
    }

    return undefined
}

async function initDatabase(dbFilePath: string, dimensions: number): Promise<Database> {
    const alreadyExists = await exists(dbFilePath)

    await initCustomSQLite()
    const dir = dirname(dbFilePath)
    await mkdir(dir, { recursive: true })
    const db = new Database(dbFilePath)
    sqliteVec.load(db)

    if (alreadyExists) {
        const result = db.prepare<{ dimensions: number }, []>('SELECT dimensions FROM embedding_model').get()
        if (!result || result.dimensions !== dimensions) {
            throw new Error('Dimensions of existing embeddings do not match configured dimensions.')
        }

        return db
    }

    db.exec(`
        CREATE TABLE embedding_model (
            dimensions integer not null
        );
        INSERT INTO embedding_model VALUES (${dimensions});

        CREATE VIRTUAL TABLE vectors USING vec0(
            id        integer primary key,
            embedding float[${dimensions}]
        );

        CREATE TABLE files (
            id    integer primary key,
            name  text not null,
            hash  text not null unique
        );
        CREATE INDEX files_hash ON files(hash);

        CREATE TABLE chunks (
            id        integer primary key,
            file_id   integer not null references files(id) ON DELETE CASCADE,
            content   text not null,
            name      text not null,
            metadata  text not null
        );
        CREATE INDEX chunks_file_id ON chunks(file_id);

        CREATE TABLE chunk_vectors (
            id        integer primary key,
            chunk_id  integer not null references chunks(id),
            vector_id integer not null references vectors(id)
        );
        CREATE INDEX chunk_vectors_chunk_id ON chunk_vectors(chunk_id);
        CREATE INDEX chunk_vectors_vector_id ON chunk_vectors(vector_id);
    `)

    return db
}

function prepSelectHashes(db: Database): () => Set<string> {
    const select = db.prepare<{ hash: string }, []>(`
        SELECT f.hash
        FROM files f
    `)

    return () => new Set(select.all().map(({ hash }) => hash))
}

function prepDeleteHashes(db: Database): (hashes: Set<string>) => void {
    return hashes => {
        if (hashes.size === 0) {
            return
        }

        const deleteHashes = db.prepare<{}, string[]>(`
            DELETE FROM files
            WHERE hash IN (${new Array(hashes.size).fill('?').join(',')})
        `)

        deleteHashes.run(...hashes.values())
    }
}

function prepInsertHashes(db: Database): (files: { name: string; hash: string }[]) => void {
    const insertFile = db.prepare<{}, [string, string]>(`
        INSERT INTO files(name, hash)
        VALUES (?, ?)
    `)

    return (files: { name: string; hash: string }[]) => {
        files.forEach(({ name, hash }) => insertFile.run(name, hash))
    }
}

function prepSelectEmbeddings(db: Database): (embedding: number[]) => EmbeddedContent[] {
    const select = db.prepare<
        { filename: string; filehash: string; content: string; name: string; metadata: string },
        [Float32Array]
    >(`
        WITH matches AS (
            SELECT id, distance
            FROM vectors
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT 10
        )
        SELECT f.name AS filename, f.hash AS filehash, c.content, c.name, c.metadata
        FROM chunks c
        JOIN files f ON c.file_id = f.id
        WHERE c.id IN (
            SELECT cv.chunk_id
            FROM matches v
            JOIN chunk_vectors cv ON cv.vector_id = v.id
        )
    `)

    return embedding => select.all(new Float32Array(embedding))
}

type EmbeddedContentWithEmbeddings = EmbeddedContent & {
    embeddings: number[][]
}

function prepInsertEmbeddings(db: Database): (items: EmbeddedContentWithEmbeddings[]) => void {
    const insertChunk = db.prepare<{}, [string, string, string, string]>(`
        INSERT INTO chunks(file_id, content, name, metadata)
        SELECT id, ?, ?, ?
        FROM files
        WHERE hash = ?
    `)

    const insertVector = db.prepare<{}, [Float32Array]>(`
        INSERT INTO vectors (embedding)
        VALUES (?)
    `)

    const insertChunkVector = db.prepare<{}, [number | bigint, number | bigint]>(`
        INSERT INTO chunk_vectors (chunk_id, vector_id)
        VALUES (?, ?)
    `)

    return (items: EmbeddedContentWithEmbeddings[]) =>
        items.forEach(({ embeddings, ...meta }) => {
            const { lastInsertRowid: chunkId } = insertChunk.run(
                meta.content,
                meta.name ?? '',
                meta.metadata ?? '',
                meta.filehash,
            )

            embeddings.forEach(embedding => {
                const { lastInsertRowid: vectorId } = insertVector.run(new Float32Array(embedding))
                insertChunkVector.run(chunkId, vectorId)
            })
        })
}
