export type Model = {
    name: string
    model: string
    dimensions: number
    maxInput: number
}

export interface Client {
    providerName: string
    modelName: string
    dimensions: number
    maxInput: number
    embed: (input: string[]) => Promise<number[][]>
}

export interface ClientSpec {
    providerName: string
    models: Model[]
    needsAPIKey: boolean
    factory: ClientFactory
}

export type ClientOptions = {
    model: Model
}

export type ClientFactory = (opts: ClientOptions) => Promise<Client>
