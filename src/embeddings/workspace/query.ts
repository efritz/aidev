import { ChatContext, embeddingsStore } from '../../chat/context'
import { exists } from '../../util/fs/safe'
import { EmbeddedContent } from '../store/store'

export async function queryWorkspace(context: ChatContext, query: string): Promise<EmbeddedContent[]> {
    const store = await embeddingsStore(context)
    const paths = await store.query(query)

    const resultsWithExistsCheck = await Promise.all(
        paths.map(async result => ({
            result,
            exists: await exists(result.filename),
        })),
    )

    return resultsWithExistsCheck.filter(({ exists }) => exists).map(({ result }) => result)
}
