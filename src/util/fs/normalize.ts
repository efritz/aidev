import { normalize, sep } from 'path'

export const normalizeDirectoryPath = (path: string) => normalize(path).replace(/\/$/, '') + sep
