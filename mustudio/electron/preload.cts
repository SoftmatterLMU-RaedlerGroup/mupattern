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
    pickMovieOutput: () =>
      ipcRenderer.invoke("tasks:pick-movie-output") as Promise<{ path: string } | null>,
    pickSpotsFile: () =>
      ipcRenderer.invoke("tasks:pick-spots-file") as Promise<{ path: string } | null>,
    hasBboxCsv: (payload: { workspacePath: string; pos: number }) =>
      ipcRenderer.invoke("tasks:has-bbox-csv", payload) as Promise<boolean>,
    runCrop: (payload: {
      taskId: string
      input_dir: string
      pos: number
      bbox: string
      output: string
      background: boolean
    }) => ipcRenderer.invoke("tasks:run-crop", payload),
    onCropProgress: (callback: (ev: { taskId: string; progress: number; message: string }) => void) => {
      const fn = (_event: Electron.IpcRendererEvent, ev: { taskId: string; progress: number; message: string }) => callback(ev)
      ipcRenderer.on("tasks:crop-progress", fn)
      return () => ipcRenderer.removeListener("tasks:crop-progress", fn)
    },
    runMovie: (payload: {
      taskId: string
      input_zarr: string
      pos: number
      crop: number
      channel: number
      time: string
      output: string
      fps: number
      colormap: string
      spots: string | null
    }) => ipcRenderer.invoke("tasks:run-movie", payload),
    onMovieProgress: (callback: (ev: { taskId: string; progress: number; message: string }) => void) => {
      const fn = (_event: Electron.IpcRendererEvent, ev: { taskId: string; progress: number; message: string }) => callback(ev)
      ipcRenderer.on("tasks:movie-progress", fn)
      return () => ipcRenderer.removeListener("tasks:movie-progress", fn)
    },
    insertTask: (task: unknown) => ipcRenderer.invoke("tasks:insert-task", task),
    updateTask: (id: string, updates: unknown) => ipcRenderer.invoke("tasks:update-task", id, updates),
    listTasks: () => ipcRenderer.invoke("tasks:list-tasks"),
  },
})
