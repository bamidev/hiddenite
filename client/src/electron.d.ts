export {}

declare global {
  interface Window {
    electron?: {
      isElectron: boolean
      rescanLibrary: () => Promise<number>
      listSongs: () => Promise<{ id: string, path: string, type: string, tags: Record<string, string> }[]>
      readFile: (path: string) => Promise<Uint8Array>
      addUrlSong: (kind: string, url: string) => Promise<void>
      addFileSong: (path: string) => Promise<void>
    }
  }
}
