import { contextBridge, ipcRenderer } from "electron"

contextBridge.exposeInMainWorld("mustudio", {
  platform: process.platform,
  workspaceState: {
    load: () => ipcRenderer.invoke("workspace-state:load"),
    save: (state: unknown) => ipcRenderer.invoke("workspace-state:save", state),
  },
})
