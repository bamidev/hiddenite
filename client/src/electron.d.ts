export {}

declare global {
  interface Window {
    electron?: {
      isElectron: boolean
      rescanLibrary: () => Promise<number>
    }
  }
}
