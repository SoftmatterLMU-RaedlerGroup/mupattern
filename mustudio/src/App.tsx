import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useStore } from "@tanstack/react-store"
import WorkspaceDashboard from "@/workspace/WorkspaceDashboard"
import RegisterApp from "@/register/RegisterApp"
import SeeApp from "@/see/SeeApp"
import { appStore } from "@/register/store"
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

function WorkspaceOnlyRoute({
  children,
  requireStarted = false,
}: {
  children: React.ReactElement
  requireStarted?: boolean
}) {
  const activeId = useStore(workspaceStore, (s) => s.activeId)
  const started = useStore(appStore, (s) => s.started)
  if (!activeId) {
    return <Navigate to="/workspace" replace />
  }
  if (requireStarted && !started) {
    return <Navigate to="/workspace" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <InitHandles />
      <Routes>
        <Route path="/" element={<WorkspaceDashboard />} />
        <Route path="/workspace" element={<WorkspaceDashboard />} />
        <Route path="/register" element={<WorkspaceOnlyRoute requireStarted><RegisterApp /></WorkspaceOnlyRoute>} />
        <Route path="/see" element={<WorkspaceOnlyRoute><SeeApp /></WorkspaceOnlyRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
