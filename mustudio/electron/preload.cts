import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("mustudio", {
  platform: process.platform,
  workspaceState: {
    load: () => ipcRenderer.invoke("workspace-state:load"),
    save: (state: unknown) => ipcRenderer.invoke("workspace-state:save", state),
  },
  workspace: {
    pickDirectory: () => ipcRenderer.invoke("workspace:pick-directory"),
    pickTagsFile: () => ipcRenderer.invoke("workspace:pick-tags-file") as Promise<string | null>,
    readPositionImage: (request: unknown) =>
      ipcRenderer.invoke("workspace:read-position-image", request),
    saveBboxCsv: (request: unknown) =>
      ipcRenderer.invoke("workspace:save-bbox-csv", request),
  },
  zarr: {
    discover: (request: unknown) => ipcRenderer.invoke("zarr:discover", request),
    loadFrame: (request: unknown) => ipcRenderer.invoke("zarr:load-frame", request),
    hasMasks: (request: unknown) => ipcRenderer.invoke("zarr:has-masks", request),
    loadMaskFrame: (request: unknown) => ipcRenderer.invoke("zarr:load-mask-frame", request),
    pickMasksDirectory: () => ipcRenderer.invoke("zarr:pick-masks-dir") as Promise<{ path: string } | null>,
  },
  tasks: {
    pickCropsDestination: () =>
      ipcRenderer.invoke("tasks:pick-crops-destination") as Promise<{ path: string } | null>,
    hasBboxCsv: (payload: { workspacePath: string; pos: number }) =>
      ipcRenderer.invoke("tasks:has-bbox-csv", payload) as Promise<boolean>,
  },
})
