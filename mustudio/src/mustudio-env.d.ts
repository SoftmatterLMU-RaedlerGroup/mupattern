export {}

interface WorkspaceSnapshot {
  workspaces: Array<{
    id: string
    name: string
    positions: number[]
    posTags?: Array<{
      id: string
      label: string
      startIndex: number
      endIndex: number
    }>
    positionFilterLabel?: string | null
    positionFilterLabels?: string[]
    channels: number[]
    times: number[]
    zSlices: number[]
    selectedChannel: number
    selectedTime: number
    selectedZ: number
    currentIndex: number
  }>
  activeId: string | null
}

declare global {
  interface Window {
    mustudio: {
      platform: string
      workspaceState: {
        load: () => Promise<WorkspaceSnapshot | null>
        save: (state: WorkspaceSnapshot) => Promise<boolean>
      }
    }
  }
}
