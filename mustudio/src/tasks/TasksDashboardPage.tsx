import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useStore } from "@tanstack/react-store"
import { Button, HexBackground, ThemeToggle, useTheme } from "@mupattern/shared"
import { ArrowLeft, Plus } from "lucide-react"
import { workspaceStore } from "@/workspace/store"
import {
  healthCheck,
  cropTask,
  cancelTask,
  taskStream,
  type TaskRecord,
} from "@/backend/api"
import { CropTaskConfigModal } from "@/tasks/components/CropTaskConfigModal"

export default function TasksDashboardPage() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const workspaces = useStore(workspaceStore, (s) => s.workspaces)
  const activeId = useStore(workspaceStore, (s) => s.activeId)

  const [apiReachable, setApiReachable] = useState<boolean | null>(null)
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activeWorkspace = useMemo(
    () => (activeId ? workspaces.find((w) => w.id === activeId) ?? null : null),
    [activeId, workspaces]
  )

  const [positionsWithBboxResolved, setPositionsWithBboxResolved] = useState<
    number[]
  >([])

  useEffect(() => {
    if (!activeWorkspace?.rootPath) {
      setPositionsWithBboxResolved([])
      return
    }
    const check = async () => {
      const results = await Promise.all(
        activeWorkspace.positions.map((pos) =>
          window.mustudio.tasks.hasBboxCsv({
            workspacePath: activeWorkspace.rootPath!,
            pos,
          })
        )
      )
      setPositionsWithBboxResolved(
        activeWorkspace.positions.filter((_, i) => results[i])
      )
    }
    void check()
  }, [activeWorkspace])

  useEffect(() => {
    const check = async () => {
      const ok = await healthCheck()
      setApiReachable(ok)
    }
    void check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [])

  const handleCreateCrop = useCallback(
    async (pos: number, destination: string, background: boolean) => {
      if (!activeWorkspace?.rootPath) return
      setError(null)
      try {
        const bbox = `${activeWorkspace.rootPath}/Pos${pos}_bbox.csv`
        const task = await cropTask({
          input_dir: activeWorkspace.rootPath,
          pos,
          bbox,
          output: destination,
          background,
        })
        setTasks((prev) => [task, ...prev])
        setSelectedTaskId(task.id)
        setCropModalOpen(false)
        setAddMenuOpen(false)

        taskStream(task.id, (ev) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== task.id) return t
              if ("done" in ev) {
                return { ...t, status: ev.status as TaskRecord["status"] }
              }
              return {
                ...t,
                progress_events: [
                  ...t.progress_events,
                  {
                    progress: ev.progress,
                    message: ev.message,
                    timestamp: new Date().toISOString(),
                  },
                ],
              }
            })
          )
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [activeWorkspace]
  )

  const handleCancelTask = useCallback(async (taskId: string) => {
    try {
      await cancelTask(taskId)
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "canceled" as const } : t))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen">
      <HexBackground theme={theme} />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative flex-1 flex flex-col items-center p-6 gap-6">
        <div className="w-full max-w-3xl space-y-4 backdrop-blur-sm bg-background/80 rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate("/workspace")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h1 className="text-xl font-medium">Tasks</h1>
          </div>

          {!activeWorkspace ? (
            <p className="text-sm text-muted-foreground">
              Open a workspace from the workspace dashboard first.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Workspace: {activeWorkspace.name} ({activeWorkspace.rootPath})
              </p>

              {apiReachable === false && (
                <p className="text-sm text-destructive">
                  Cannot reach muapplication API. Run: uv run muapplication serve --dev
                </p>
              )}

              <div className="relative">
                <Button
                  onClick={() => setAddMenuOpen((o) => !o)}
                  disabled={!apiReachable || !positionsWithBboxResolved.length}
                >
                  <Plus className="size-4 mr-2" />
                  Add task
                </Button>
                {addMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 border rounded bg-background shadow-lg py-1 z-20 min-w-[120px]">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-accent text-sm"
                      onClick={() => {
                        setCropModalOpen(true)
                        setAddMenuOpen(false)
                      }}
                    >
                      Crop
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="space-y-2">
                <h2 className="text-sm font-medium">Active / recent tasks</h2>
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tasks yet. Click Add task to create one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`border rounded p-3 ${
                          selectedTaskId === task.id ? "border-primary" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{task.kind}</span>
                            {" — "}
                            <span className="text-muted-foreground text-sm">
                              pos {String(task.request?.pos ?? "?")} →{" "}
                              {String(task.request?.output ?? "?")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center h-8 text-sm px-3 rounded ${
                                task.status === "running"
                                  ? "bg-primary/20"
                                  : task.status === "succeeded"
                                    ? "bg-green-500/20"
                                    : task.status === "failed"
                                      ? "bg-destructive/20"
                                      : "bg-muted"
                              }`}
                            >
                              {task.status}
                            </span>
                            {task.status === "running" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelTask(task.id)}
                              >
                                Cancel
                              </Button>
                            )}
                            {task.status === "succeeded" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate("/see")}
                              >
                                View in See
                              </Button>
                            )}
                          </div>
                        </div>
                        {selectedTaskId === task.id && (
                          <div className="mt-2 pt-2 border-t text-sm space-y-1">
                            {task.progress_events.length > 0 && (
                              <p>
                                {task.progress_events[task.progress_events.length - 1]
                                  ?.message ?? ""}
                              </p>
                            )}
                            {task.logs.length > 0 && (
                              <pre className="text-xs overflow-auto max-h-24">
                                {task.logs.join("\n")}
                              </pre>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className="text-xs text-muted-foreground mt-1"
                          onClick={() =>
                            setSelectedTaskId((id) => (id === task.id ? null : task.id))
                          }
                        >
                          {selectedTaskId === task.id ? "Collapse" : "Expand"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {activeWorkspace && (
        <CropTaskConfigModal
          key={activeWorkspace.id}
          open={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          workspace={activeWorkspace}
          onCreate={handleCreateCrop}
          positionsWithBbox={positionsWithBboxResolved}
        />
      )}
    </div>
  )
}
