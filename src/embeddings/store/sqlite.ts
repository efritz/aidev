import { mkdir } from 'fs/promises'
import path, { dirname } from 'path'
import { Database } from 'bun:sqlite'
import * as sqliteVec from 'sqlite-vec'
import { exists } from '../../util/fs/safe'
import { xdgCacheHome } from '../../util/fs/xdgconfig'
import { hash } from '../../util/hash/hash'
import type { Client } from '../client/client'
import { chunkMetadata, EmbeddedContent, EmbeddingsStore } from './store'

export async function createSQLiteEmbeddingsStore(client: Client): Promise<EmbeddingsStore> {
    const db = await initDatabase(dbFilePath(), client.dimensions)
    const selectHashes = prepSelectHashes(db)
    const deleteHashes = prepDeleteHashes(db)
    const selectEmbeddings = prepSelectEmbeddings(db)
    const insertEmbeddings = prepInsertEmbeddings(db)

    return {
        save: async (batch, signal) => {
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

            // Insert the embeddings produced for each batch item
            return insertEmbeddings(
                batch.map(({ filename, filehash, content, name, metadata }, index) => ({
                    filename,
                    filehash,
                    content,
                    name,
                    metadata: metadata ? metadata.header + '\n\n' + metadata.detail : '',
                    embeddings: embeddingsByBatchIndex.get(index)!,
                })),
            )
        },

        delete: async hashes => deleteHashes(hashes),
        hashes: async () => selectHashes(),
        query: async query => selectEmbeddings((await client.embed([query]))[0]),
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

        CREATE TABLE chunks (
            id        integer primary key,
            filename  text not null,
            filehash  text not null,
            content   text not null,
            name      text not null,
            metadata  text not null
        );
        CREATE INDEX chunks_filehash ON chunks(filehash);

        CREATE TABLE chunk_vectors (
            chunk_id  integer not null references chunks(id),
            vector_id integer not null references vectors(id)
        );
        CREATE INDEX chunk_vectors_chunk_id ON chunk_vectors(chunk_id);
        CREATE INDEX chunk_vectors_vector_id ON chunk_vectors(vector_id);
    `)

    return db
}

function prepSelectHashes(db: Database): () => Set<string> {
    const select = db.prepare<{ filehash: string }, []>(`
        SELECT c.filehash FROM chunks c
    `)

    return () => new Set(select.all().map(({ filehash }) => filehash))
}

function prepDeleteHashes(db: Database): (hashes: Set<string>) => Promise<void> {
    return async hashes => {
        if (hashes.size === 0) {
            return
        }

        const deleteHashes = db.prepare<{}, string[]>(`
            DELETE FROM chunks
            WHERE filehash IN (${new Array(hashes.size).fill('?').join(',')})
        `)

        deleteHashes.run(...hashes.values())
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
        SELECT c.filename, c.filehash, c.content, c.name, c.metadata
        FROM chunks c
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
    const insertChunk = db.prepare<{}, [string, string, string, string, string]>(`
        INSERT INTO chunks(filename, filehash, content, name,metadata)
        VALUES (?, ?, ?, ?, ?)
    `)

    const insertVector = db.prepare<{}, [Float32Array]>(`
        INSERT INTO vectors (embedding)
        VAlUES (?)
    `)

    const insertChunkVector = db.prepare<{}, [number | bigint, number | bigint]>(`
        INSERT INTO chunk_vectors (chunk_id, vector_id)
        VALUES (?, ?)
    `)

    return items =>
        db.transaction((items: EmbeddedContentWithEmbeddings[]) =>
            items.forEach(({ embeddings, ...meta }) => {
                const { lastInsertRowid: chunkId } = insertChunk.run(
                    meta.filename,
                    meta.filehash,
                    meta.content,
                    meta.name ?? '',
                    meta.metadata ?? '',
                )

                embeddings.forEach(embedding => {
                    const { lastInsertRowid: vectorId } = insertVector.run(new Float32Array(embedding))
                    insertChunkVector.run(chunkId, vectorId)
                })
            }),
        )(items)
}
