import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import WorkspaceDashboard from "@/workspace/WorkspaceDashboard"
import RegisterApp from "@/register/RegisterApp"
import SeeApp from "@/see/SeeApp"
import {
  workspaceStore,
  restoreDirHandle,
  getDirHandle,
} from "@/workspace/store"

function InitHandles() {
  useEffect(() => {
    const restored = new Set<string>()
    const restoreMissingHandles = () => {
      for (const w of workspaceStore.state.workspaces) {
        if (restored.has(w.id)) continue
        restored.add(w.id)
        if (!getDirHandle(w.id)) {
          restoreDirHandle(w.id).then(() => {})
        }
      }
    }

    restoreMissingHandles()
    return workspaceStore.subscribe(restoreMissingHandles)
  }, [])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <InitHandles />
      <Routes>
        <Route path="/" element={<WorkspaceDashboard />} />
        <Route path="/workspace" element={<WorkspaceDashboard />} />
        <Route path="/register" element={<RegisterApp />} />
        <Route path="/see" element={<SeeApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
