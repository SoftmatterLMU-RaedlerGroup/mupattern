import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@mupattern/shared"
import type { Workspace } from "@/workspace/store"

interface ExpressionRow {
  t: number
  crop: string
  intensity: number
  area: number
  background: number
}

/** Gray at 30% opacity for bulk time-series display (no per-series legend) */
const BULK_LINE_STROKE = "rgba(128, 128, 128, 0.3)"

interface ExpressionTask {
  id: string
  kind: string
  status: string
  request: { pos?: number; channel?: number; output?: string }
  result: { output: string; rows: ExpressionRow[] } | null
}

interface ExpressionTabProps {
  workspace: Workspace
  initialRows?: ExpressionRow[] | null
}

export function ExpressionTab({ workspace: _workspace, initialRows }: ExpressionTabProps) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ExpressionRow[] | null>(initialRows ?? null)
  const [tasks, setTasks] = useState<ExpressionTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  useEffect(() => {
    if (initialRows && initialRows.length > 0) setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    let cancelled = false
    setLoadingTasks(true)
    window.mustudio.tasks
      .listTasks()
      .then((list) => {
        if (cancelled) return
        const expr = (list as unknown as ExpressionTask[]).filter(
          (t) => t.kind === "expression.analyze" && t.status === "succeeded" && t.result?.rows?.length
        )
        setTasks(expr)
      })
      .finally(() => {
        if (!cancelled) setLoadingTasks(false)
      })
    return () => { cancelled = true }
  }, [])

  const crops = rows
    ? [...new Set(rows.map((r) => r.crop))].sort()
    : []
  const pivotByT = (mapper: (r: ExpressionRow) => number) => {
    if (!rows) return []
    const byT = new Map<number, Record<string, number>>()
    for (const r of rows) {
      let row = byT.get(r.t)
      if (!row) {
        row = {}
        byT.set(r.t, row)
      }
      row[r.crop] = mapper(r)
    }
    return [...byT.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, row]) => ({ t, ...row }))
  }

  const intensityAboveBgData = pivotByT((r) => r.intensity - r.area * r.background)

  return (
    <div className="space-y-6">
      {!rows || rows.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add an Expression analyze task from the Tasks page, run it, then click &quot;View in Application&quot; — or pick a completed task below.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/tasks")}>
            Go to Tasks
          </Button>
          {loadingTasks ? (
            <p className="text-sm text-muted-foreground">Loading tasks…</p>
          ) : tasks.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Completed expression tasks</p>
              <div className="flex flex-wrap gap-2">
                {tasks.map((t) => (
                  <Button
                    key={t.id}
                    variant="outline"
                    size="sm"
                    onClick={() => t.result?.rows && setRows(t.result.rows)}
                  >
                    pos {t.request?.pos ?? "?"} ch{t.request?.channel ?? "?"} ({t.result?.rows?.length ?? 0} rows)
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {rows && rows.length > 0 && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {rows.length} rows from expression analyze
            </span>
            <Button variant="ghost" size="sm" onClick={() => setRows(null)}>
              Choose different task
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">
              Background-corrected total fluor per crop
            </h3>
            <div className="h-64 [&_*]:pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={intensityAboveBgData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="t" tick={{ fontSize: 12 }} domain={["dataMin", "dataMax"]} />
                  <YAxis tick={{ fontSize: 12 }} domain={["dataMin", "dataMax"]} />
                  <Tooltip cursor={false} content={() => null} />
                  {crops.map((crop) => (
                    <Line
                      key={crop}
                      type="monotone"
                      dataKey={crop}
                      stroke={BULK_LINE_STROKE}
                      strokeWidth={1}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
