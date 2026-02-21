/**
 * HTTP client for muapplication serve API.
 * Default base URL: http://127.0.0.1:8787
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8787"

export interface TaskRecord {
  id: string
  kind: string
  status: "queued" | "running" | "succeeded" | "failed" | "canceled"
  created_at: string
  started_at: string | null
  finished_at: string | null
  request: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  logs: string[]
  progress_events: Array<{ progress: number; message: string; timestamp: string }>
}

export interface TaskListResponse {
  tasks: TaskRecord[]
}

export interface CropTaskRequest {
  input_dir: string
  pos: number
  bbox: string
  output: string
  background: boolean
}

export type TaskProgressEvent =
  | { progress: number; message: string }
  | { done: true; status: string; error?: string }

function getBaseUrl(): string {
  return DEFAULT_BASE_URL
}

export async function healthCheck(baseUrl?: string): Promise<boolean> {
  const url = (baseUrl ?? getBaseUrl()) + "/health"
  try {
    const res = await fetch(url)
    return res.ok
  } catch {
    return false
  }
}

export async function cropTask(
  req: CropTaskRequest,
  baseUrl?: string
): Promise<TaskRecord> {
  const url = (baseUrl ?? getBaseUrl()) + "/tasks/file.crop"
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Crop task failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function getTask(
  taskId: string,
  baseUrl?: string
): Promise<TaskRecord> {
  const url = (baseUrl ?? getBaseUrl()) + "/tasks/" + encodeURIComponent(taskId)
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Get task failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function cancelTask(
  taskId: string,
  baseUrl?: string
): Promise<{ task_id: string; canceled: boolean }> {
  const url =
    (baseUrl ?? getBaseUrl()) + "/tasks/" + encodeURIComponent(taskId) + "/cancel"
  const res = await fetch(url, { method: "POST" })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Cancel task failed: ${res.status} ${text}`)
  }
  return res.json()
}

/**
 * Subscribe to task progress via SSE. Calls onEvent for each progress or done event.
 */
export function taskStream(
  taskId: string,
  onEvent: (ev: TaskProgressEvent) => void,
  baseUrl?: string
): () => void {
  const url =
    (baseUrl ?? getBaseUrl()) +
    "/tasks/" +
    encodeURIComponent(taskId) +
    "/stream"
  const eventSource = new EventSource(url)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    eventSource.close()
  }

  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as TaskProgressEvent
      onEvent(data)
      if ("done" in data && data.done) {
        close()
      }
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    close()
  }

  return close
}
