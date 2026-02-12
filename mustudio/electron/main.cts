import { app, BrowserWindow, ipcMain } from "electron"
import path from "node:path"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import initSqlJs, { type Database } from "sql.js"

const DEV_SERVER_URL = "http://localhost:5173"
const WORKSPACE_DB_FILENAME = "mustudio.sqlite"
const WORKSPACE_STATE_KEY = "workspace-state"

let workspaceDb: Database | null = null

function getWorkspaceDbPath(): string {
  return path.join(app.getPath("userData"), WORKSPACE_DB_FILENAME)
}

async function persistWorkspaceDb(db: Database): Promise<void> {
  const dir = app.getPath("userData")
  const targetPath = getWorkspaceDbPath()
  const tempPath = `${targetPath}.tmp`

  await mkdir(dir, { recursive: true })
  await writeFile(tempPath, Buffer.from(db.export()))
  await rename(tempPath, targetPath)
}

async function ensureWorkspaceDb(): Promise<Database> {
  if (workspaceDb) return workspaceDb

  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  })

  let db: Database
  try {
    const fileBytes = await readFile(getWorkspaceDbPath())
    db = new SQL.Database(new Uint8Array(fileBytes))
  } catch {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  workspaceDb = db
  return workspaceDb
}

async function loadWorkspaceStateFromDb(): Promise<unknown | null> {
  const db = await ensureWorkspaceDb()
  const stmt = db.prepare("SELECT state_json FROM workspace_state WHERE id = ?")
  stmt.bind([WORKSPACE_STATE_KEY])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject() as { state_json?: unknown }
  stmt.free()
  if (typeof row.state_json !== "string") return null
  try {
    return JSON.parse(row.state_json)
  } catch {
    return null
  }
}

async function saveWorkspaceStateToDb(payload: unknown): Promise<void> {
  const db = await ensureWorkspaceDb()
  db.run(
    `
    INSERT INTO workspace_state (id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
    `,
    [WORKSPACE_STATE_KEY, JSON.stringify(payload ?? {}), Date.now()],
  )
  await persistWorkspaceDb(db)
}

function registerWorkspaceStateIpc(): void {
  ipcMain.handle("workspace-state:load", async () => {
    return loadWorkspaceStateFromDb()
  })

  ipcMain.handle("workspace-state:save", async (_event, payload: unknown) => {
    await saveWorkspaceStateToDb(payload)
    return true
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (!app.isPackaged) {
    win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: "detach" })
    return
  }

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"))
}

app.whenReady().then(() => {
  registerWorkspaceStateIpc()
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (workspaceDb) {
    workspaceDb.close()
    workspaceDb = null
  }
  if (process.platform !== "darwin") {
    app.quit()
  }
})
