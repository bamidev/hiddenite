export {}

declare global {
  interface Window {
    electron?: {
      isElectron: boolean
      rescanLibrary: () => Promise<number>
      listSongs: () => Promise<{ id: string, path: string, type: string, tags: Record<string, string> }[]>
    }
  }
}
