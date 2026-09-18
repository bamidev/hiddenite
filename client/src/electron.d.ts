export {}

declare global {
  interface Window {
    electron?: {
      isElectron: boolean
      rescanLibrary: () => Promise<number>
      listSongs: () => Promise<{ id: string, path: string, kind: string, duration: number | null, tags: Record<string, string> }[]>
      readFile: (path: string) => Promise<Uint8Array>
      addUrlSong: (kind: string, url: string) => Promise<void>
      addFileSong: (path: string) => Promise<void>
      clickAt: (x: number, y: number) => Promise<void>
    }
  }
}
