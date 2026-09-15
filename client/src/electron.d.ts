export {}

declare global {
  interface Window {
    electron?: {
      isElectron: boolean
    }
  }
}
