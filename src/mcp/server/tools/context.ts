export type ExecutionContext = {
    log: (...args: any) => void
    notify: (args: any) => Promise<void>
}
