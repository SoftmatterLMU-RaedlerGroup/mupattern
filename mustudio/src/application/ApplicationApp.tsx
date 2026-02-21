import { useNavigate, useLocation } from "react-router-dom"
import * as Tabs from "@radix-ui/react-tabs"
import { Button, HexBackground, ThemeToggle, useTheme } from "@mupattern/shared"
import { ArrowLeft } from "lucide-react"
import { useStore } from "@tanstack/react-store"
import { workspaceStore } from "@/workspace/store"
import { ExpressionTab } from "./expression/ExpressionTab"
import { KillTab } from "./kill/KillTab"

export default function ApplicationApp() {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as {
    expressionRows?: Array<{ t: number; crop: string; intensity: number; area: number; background: number }>
    killRows?: Array<{ t: number; crop: string; label: boolean }>
  } | null
  const expressionRows = locationState?.expressionRows ?? null
  const killRows = locationState?.killRows ?? null
  const workspaces = useStore(workspaceStore, (s) => s.workspaces)
  const activeId = useStore(workspaceStore, (s) => s.activeId)
  const activeWorkspace = activeId
    ? workspaces.find((w) => w.id === activeId) ?? null
    : null

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
            <h1 className="text-xl font-medium">Application</h1>
          </div>

          {!activeWorkspace ? (
            <p className="text-sm text-muted-foreground">
              Open a workspace from the workspace dashboard first.
            </p>
          ) : (
            <Tabs.Root defaultValue="expression" className="mt-4">
              <Tabs.List className="flex gap-2 border-b pb-2 mb-4">
                <Tabs.Trigger
                  value="expression"
                  className="px-4 py-2 rounded border data-[state=active]:bg-primary/20 data-[state=active]:border-primary text-sm font-medium transition-colors"
                >
                  Expression
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="kill"
                  className="px-4 py-2 rounded border data-[state=active]:bg-primary/20 data-[state=active]:border-primary text-sm font-medium transition-colors"
                >
                  Kill
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="expression">
                <ExpressionTab workspace={activeWorkspace} initialRows={expressionRows} />
              </Tabs.Content>
              <Tabs.Content value="kill">
                <KillTab workspace={activeWorkspace} initialRows={killRows} />
              </Tabs.Content>
            </Tabs.Root>
          )}
        </div>
      </div>
    </div>
  )
}
