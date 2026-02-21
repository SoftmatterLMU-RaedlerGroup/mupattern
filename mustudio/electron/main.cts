import { app, BrowserWindow, dialog, ipcMain } from "electron"
import path from "node:path"
import { spawn } from "node:child_process"
import { access, constants, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
import initSqlJs, { type Database } from "sql.js"
import * as UTIF from "utif2"
import type { Array as ZarritaArray, DataType, Location } from "zarrita"
import type { Readable } from "@zarrita/storage"
import type FileSystemStore from "@zarrita/storage/fs"

const DEV_SERVER_URL = "http://localhost:5173"
const WORKSPACE_DB_FILENAME = "mustudio.sqlite"
const WORKSPACE_STATE_KEY = "workspace-state"
const TIFF_RE = /^img_channel(\d+)_position(\d+)_time(\d+)_z(\d+)\.tif$/i

interface WorkspaceScanResult {
  path: string
  name: string
  positions: number[]
  channels: number[]
  times: number[]
  zSlices: number[]
}

interface ReadPositionImageRequest {
  workspacePath: string
  pos: number
  channel: number
  time: number
  z: number
}

interface ReadPositionImageSuccess {
  ok: true
  baseName: string
  width: number
  height: number
  rgba: ArrayBuffer
}

interface ReadPositionImageFailure {
  ok: false
  error: string
}

type ReadPositionImageResponse = ReadPositionImageSuccess | ReadPositionImageFailure

interface SaveBboxCsvRequest {
  workspacePath: string
  pos: number
  csv: string
}

interface DiscoverZarrRequest {
  workspacePath: string
  positionFilter?: string[]
  metadataMode?: "full" | "fast"
}

interface DiscoverZarrResponse {
  positions: string[]
  crops: Record<string, Array<{ posId: string; cropId: string; shape: number[] }>>
}

interface LoadZarrFrameRequest {
  workspacePath: string
  posId: string
  cropId: string
  t: number
  c: number
  z: number
}

interface LoadZarrFrameSuccess {
  ok: true
  width: number
  height: number
  data: ArrayBuffer
}

interface LoadZarrFrameFailure {
  ok: false
  error: string
}

type LoadZarrFrameResponse = LoadZarrFrameSuccess | LoadZarrFrameFailure

interface RunCropRequest {
  taskId: string
  input_dir: string
  pos: number
  bbox: string
  output: string
  background: boolean
}

interface RunCropSuccess {
  ok: true
}

interface RunCropFailure {
  ok: false
  error: string
}

type RunCropResponse = RunCropSuccess | RunCropFailure

interface RunMovieRequest {
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
}

interface RunMovieSuccess {
  ok: true
}

interface RunMovieFailure {
  ok: false
  error: string
}

type RunMovieResponse = RunMovieSuccess | RunMovieFailure

interface HasMasksRequest {
  /** Absolute path to masks zarr folder (e.g. .../masks_fl.zarr). No default. */
  masksPath: string
}

interface HasMasksResponse {
  hasMasks: boolean
}

interface LoadMaskFrameRequest {
  masksPath: string
  posId: string
  cropId: string
  t: number
}

interface LoadMaskFrameSuccess {
  ok: true
  width: number
  height: number
  data: ArrayBuffer
}

interface LoadMaskFrameFailure {
  ok: false
  error: string
}

type LoadMaskFrameResponse = LoadMaskFrameSuccess | LoadMaskFrameFailure

type ZarrArrayHandle = ZarritaArray<DataType, Readable>
type ZarrChunk = Awaited<ReturnType<ZarrArrayHandle["getChunk"]>>
type ZarrLocation = Location<Readable>

interface ZarrContext {
  root: ZarrLocation
  arrays: Map<string, Promise<ZarrArrayHandle>>
}

let workspaceDb: Database | null = null
let zarrModulePromise: Promise<typeof import("zarrita")> | null = null
let fsStoreCtorPromise: Promise<typeof FileSystemStore> | null = null
const zarrContextByWorkspacePath = new Map<string, ZarrContext>()
/** Keyed by absolute masks zarr path (user picks via Load). */
const masksContextByMasksPath = new Map<string, ZarrContext>()

function getWorkspaceDbPath(): string {
  return path.join(app.getPath("userData"), WORKSPACE_DB_FILENAME)
}

function posDirName(pos: number): string {
  return `Pos${pos}`
}

/** Format: img_channel{C:03d}_position{P:03d}_time{T:09d}_z{Z:03d}.tif */
function buildTifFilename(pos: number, channel: number, time: number, z: number): string {
  return `img_channel${String(channel).padStart(3, "0")}_position${String(pos).padStart(3, "0")}_time${String(time).padStart(9, "0")}_z${String(z).padStart(3, "0")}.tif`
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}

function normalizeRgbaInPlace(rgba: Uint8Array, width: number, height: number): void {
  const n = width * height
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (let i = 0; i < n; i += 1) {
    const j = i * 4
    const lum = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]
    if (lum < min) min = lum
    if (lum > max) max = lum
  }

  if (max <= min) return

  const scale = 255 / (max - min)
  for (let i = 0; i < n; i += 1) {
    const j = i * 4
    const lum = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]
    const newLum = (lum - min) * scale
    const factor = lum > 0 ? newLum / lum : 0
    rgba[j] = Math.max(0, Math.min(255, Math.round(rgba[j] * factor)))
    rgba[j + 1] = Math.max(0, Math.min(255, Math.round(rgba[j + 1] * factor)))
    rgba[j + 2] = Math.max(0, Math.min(255, Math.round(rgba[j + 2] * factor)))
  }
}

function parsePosDirName(name: string): number | null {
  const match = name.match(/^Pos(\d+)$/i)
  return match ? Number.parseInt(match[1], 10) : null
}

async function scanWorkspaceDirectory(workspacePath: string): Promise<WorkspaceScanResult | null> {
  const entries = await readdir(workspacePath, { withFileTypes: true })
  const positions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => parsePosDirName(entry.name))
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)

  if (positions.length === 0) return null

  const channels = new Set<number>()
  const times = new Set<number>()
  const zSlices = new Set<number>()
  const firstPosPath = path.join(workspacePath, posDirName(positions[0]))
  const firstPosEntries = await readdir(firstPosPath, { withFileTypes: true })
  for (const entry of firstPosEntries) {
    if (!entry.isFile()) continue
    const match = entry.name.match(TIFF_RE)
    if (!match) continue
    channels.add(Number.parseInt(match[1], 10))
    times.add(Number.parseInt(match[3], 10))
    zSlices.add(Number.parseInt(match[4], 10))
  }

  return {
    path: workspacePath,
    name: path.basename(workspacePath),
    positions,
    channels: [...channels].sort((a, b) => a - b),
    times: [...times].sort((a, b) => a - b),
    zSlices: [...zSlices].sort((a, b) => a - b),
  }
}

async function pickWorkspaceDirectory(): Promise<WorkspaceScanResult | null> {
  const result = await dialog.showOpenDialog({
    title: "Select workspace folder",
    properties: ["openDirectory"],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const workspacePath = result.filePaths[0]
  await access(workspacePath, constants.R_OK)
  return scanWorkspaceDirectory(workspacePath)
}

async function readAndNormalizePositionImage(
  request: ReadPositionImageRequest
): Promise<ReadPositionImageResponse> {
  try {
    const filename = buildTifFilename(request.pos, request.channel, request.time, request.z)
    const filePath = path.join(request.workspacePath, posDirName(request.pos), filename)
    const fileBytes = await readFile(filePath)
    const buffer = toArrayBuffer(fileBytes)
    const ifds = UTIF.decode(buffer)
    if (ifds.length === 0) {
      return { ok: false, error: "Could not decode TIFF file." }
    }

    UTIF.decodeImage(buffer, ifds[0])
    const rgba = UTIF.toRGBA8(ifds[0])
    const width = ifds[0].width
    const height = ifds[0].height
    normalizeRgbaInPlace(rgba, width, height)

    const rgbaCopy = new Uint8Array(rgba.length)
    rgbaCopy.set(rgba)

    return {
      ok: true,
      baseName: path.parse(filename).name,
      width,
      height,
      rgba: toArrayBuffer(rgbaCopy),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message || "Failed to load workspace image." }
  }
}

async function saveBboxCsvToWorkspace({ workspacePath, pos, csv }: SaveBboxCsvRequest): Promise<boolean> {
  const filePath = path.join(workspacePath, `${posDirName(pos)}_bbox.csv`)
  await writeFile(filePath, csv, "utf8")
  return true
}

/** Parse bbox CSV: crop,x,y,w,h */
function parseBboxCsv(csvText: string): Array<{ crop: number; x: number; y: number; w: number; h: number }> {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase())
  const cropIdx = header.indexOf("crop")
  const xIdx = header.indexOf("x")
  const yIdx = header.indexOf("y")
  const wIdx = header.indexOf("w")
  const hIdx = header.indexOf("h")
  if (cropIdx < 0 || xIdx < 0 || yIdx < 0 || wIdx < 0 || hIdx < 0) return []
  const rows: Array<{ crop: number; x: number; y: number; w: number; h: number }> = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",")
    if (parts.length <= Math.max(cropIdx, xIdx, yIdx, wIdx, hIdx)) continue
    rows.push({
      crop: Number.parseInt(parts[cropIdx], 10),
      x: Number.parseInt(parts[xIdx], 10),
      y: Number.parseInt(parts[yIdx], 10),
      w: Number.parseInt(parts[wIdx], 10),
      h: Number.parseInt(parts[hIdx], 10),
    })
  }
  return rows
}

/** Discover TIFFs in pos dir. Returns (c,t,z) -> filepath */
async function discoverTiffsAsync(
  posDirPath: string,
  pos: number
): Promise<Map<string, string>> {
  const index = new Map<string, string>()
  const entries = await readdir(posDirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = entry.name.match(TIFF_RE)
    if (!match) continue
    const filePos = Number.parseInt(match[2], 10)
    if (filePos !== pos) continue
    const c = Number.parseInt(match[1], 10)
    const t = Number.parseInt(match[3], 10)
    const z = Number.parseInt(match[4], 10)
    index.set(`${c},${t},${z}`, path.join(posDirPath, entry.name))
  }
  return index
}

/** Read raw frame from TIFF as TypedArray. Returns { data, width, height, bytesPerPixel } */
async function readTiffFrameRaw(filePath: string): Promise<{
  data: Uint8Array | Uint16Array
  width: number
  height: number
  bytesPerPixel: number
  dtype: string
}> {
  const fileBytes = await readFile(filePath)
  const buffer = toArrayBuffer(fileBytes)
  const ifds = UTIF.decode(buffer)
  if (ifds.length === 0) throw new Error("Could not decode TIFF")
  UTIF.decodeImage(buffer, ifds[0])
  const img = ifds[0]
  const w = img.width
  const h = img.height
  const dataU8 = img.data as Uint8Array
  const bps = (img["t258"] != null ? (img["t258"] as number[])[0] : 8)
  const smpls = (img["t277"] != null ? (img["t277"] as number[])[0] : 1)
  const bytesPerPixel = Math.ceil((bps * smpls) / 8)

  if (bps === 16 && bytesPerPixel >= 2) {
    const nPixels = w * h * smpls
    const view = new Uint16Array(dataU8.buffer, dataU8.byteOffset, nPixels)
    return { data: view, width: w, height: h, bytesPerPixel: 2, dtype: "<u2" }
  }
  return { data: dataU8, width: w, height: h, bytesPerPixel: 1, dtype: "|u1" }
}

/** Extract crop region from frame. Frame is row-major, width x height. Returns buffer for zarr chunk. */
function extractCrop(
  frame: Uint8Array | Uint16Array,
  frameWidth: number,
  _frameHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  bytesPerPixel: number
): ArrayBuffer {
  if (bytesPerPixel === 1) {
    const out = new Uint8Array(w * h)
    for (let r = 0; r < h; r++) {
      const srcStart = (y + r) * frameWidth + x
      out.set(
        (frame as Uint8Array).subarray(srcStart, srcStart + w),
        r * w
      )
    }
    return out.buffer
  }
  const out = new Uint16Array(w * h)
  const f16 = frame instanceof Uint16Array ? frame : new Uint16Array(frame.buffer, frame.byteOffset, frame.byteLength / 2)
  for (let r = 0; r < h; r++) {
    const srcStart = (y + r) * frameWidth + x
    out.set(f16.subarray(srcStart, srcStart + w), r * w)
  }
  return out.buffer
}

/** Compute median of pixels outside mask. Mask is (H,W) bool, frame is (H,W). */
function medianOutsideMask(
  frame: Uint8Array | Uint16Array,
  width: number,
  height: number,
  mask: boolean[]
): number {
  const values: number[] = []
  const n = width * height
  for (let i = 0; i < n; i++) {
    if (mask[i]) continue
    const v = frame instanceof Uint16Array ? frame[i] : frame[i]
    values.push(v)
  }
  if (values.length === 0) return 0
  values.sort((a, b) => a - b)
  const mid = Math.floor(values.length / 2)
  return values.length % 2 === 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2
}

async function runCrop(
  request: RunCropRequest,
  sendProgress: (progress: number, message: string) => void
): Promise<RunCropResponse> {
  const { input_dir, pos, bbox: bboxPath, output, background } = request
  const posDir = path.join(input_dir, posDirName(pos))

  try {
    await access(posDir, constants.R_OK)
  } catch {
    return { ok: false, error: `Position directory not found: ${posDir}` }
  }

  let bboxCsv: string
  try {
    bboxCsv = await readFile(bboxPath, "utf8")
  } catch {
    return { ok: false, error: `Could not read bbox CSV: ${bboxPath}` }
  }

  const bboxes = parseBboxCsv(bboxCsv)
  if (bboxes.length === 0) return { ok: false, error: "No valid bounding boxes in bbox CSV" }

  const index = await discoverTiffsAsync(posDir, pos)
  if (index.size === 0) return { ok: false, error: `No TIFFs found in ${posDir}` }

  const keys = [...index.keys()].sort()
  const nChannels = new Set(keys.map((k) => Number.parseInt(k.split(",")[0], 10))).size
  const nTimes = new Set(keys.map((k) => Number.parseInt(k.split(",")[1], 10))).size
  const nZ = new Set(keys.map((k) => Number.parseInt(k.split(",")[2], 10))).size
  sendProgress(0, `Discovered ${index.size} TIFFs: T=${nTimes}, C=${nChannels}, Z=${nZ}`)

  const firstPath = index.get(keys[0])!
  const sample = await readTiffFrameRaw(firstPath)
  const dtype = sample.dtype

  const outputRoot = path.join(output, "pos", String(pos).padStart(3, "0"))
  await mkdir(path.join(outputRoot, "crop"), { recursive: true })

  const cropDirs: string[] = []
  for (let i = 0; i < bboxes.length; i++) {
    const cropId = String(i).padStart(3, "0")
    const cropDir = path.join(outputRoot, "crop", cropId)
    await mkdir(cropDir, { recursive: true })
    cropDirs.push(cropDir)

    const bb = bboxes[i]
    const zarray = {
      zarr_format: 2,
      shape: [nTimes, nChannels, nZ, bb.h, bb.w],
      chunks: [1, 1, 1, bb.h, bb.w],
      dtype,
      compressor: null,
      fill_value: null,
    }
    await writeFile(path.join(cropDir, ".zarray"), JSON.stringify(zarray), "utf8")
    await writeFile(path.join(cropDir, ".zattrs"), JSON.stringify({ axis_names: ["t", "c", "z", "y", "x"], bbox: bb }), "utf8")
  }

  let bgDir: string | null = null
  if (background) {
    bgDir = path.join(outputRoot, "background")
    await mkdir(bgDir, { recursive: true })
    const zarray = {
      zarr_format: 2,
      shape: [nTimes, nChannels, nZ],
      chunks: [1, 1, 1],
      dtype: "<f8",
      compressor: null,
      fill_value: null,
    }
    await writeFile(path.join(bgDir, ".zarray"), JSON.stringify(zarray), "utf8")
    await writeFile(path.join(bgDir, ".zattrs"), JSON.stringify({ axis_names: ["t", "c", "z"], description: "Median of pixels outside all crop bounding boxes" }), "utf8")
  }

  const mask = background ? (() => {
    const m = new Array(sample.width * sample.height).fill(false)
    for (const bb of bboxes) {
      for (let dy = 0; dy < bb.h; dy++) {
        for (let dx = 0; dx < bb.w; dx++) {
          m[(bb.y + dy) * sample.width + (bb.x + dx)] = true
        }
      }
    }
    return m
  })() : null

  const total = keys.length
  for (let i = 0; i < keys.length; i++) {
    const [cStr, tStr, zStr] = keys[i].split(",")
    const c = Number.parseInt(cStr, 10)
    const t = Number.parseInt(tStr, 10)
    const z = Number.parseInt(zStr, 10)
    const filePath = index.get(keys[i])!
    const frame = await readTiffFrameRaw(filePath)

    for (let cropIdx = 0; cropIdx < bboxes.length; cropIdx++) {
      const bb = bboxes[cropIdx]
      const chunkBuf = extractCrop(
        frame.data,
        frame.width,
        frame.height,
        bb.x,
        bb.y,
        bb.w,
        bb.h,
        frame.bytesPerPixel
      )
      const chunkPath = path.join(cropDirs[cropIdx], `${t}.${c}.${z}.0.0`)
      await writeFile(chunkPath, Buffer.from(chunkBuf))
    }

    if (bgDir != null && mask != null) {
      const med = medianOutsideMask(frame.data, frame.width, frame.height, mask)
      const chunkPath = path.join(bgDir, `${t}.${c}.${z}`)
      const buf = new ArrayBuffer(8)
      new DataView(buf).setFloat64(0, med, true)
      await writeFile(chunkPath, Buffer.from(buf))
    }

    sendProgress((i + 1) / total, `Reading frames ${i + 1}/${total}`)
  }

  sendProgress(1, `Wrote ${output}`)
  return { ok: true }
}

/** Precomputed viridis colormap (256 RGB entries) */
const VIRIDIS_TABLE: number[][] = (() => {
  const out: number[][] = []
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const r = Math.round((0.267 + 0.3244 * t + 2.6477 * t * t - 4.4098 * t * t * t + 2.0942 * t * t * t * t) * 255)
    const g = Math.round((0.0046 + 0.0495 * t + 2.5253 * t * t - 6.0613 * t * t * t + 3.7466 * t * t * t * t) * 255)
    const b = Math.round((0.3294 + 0.1002 * t + 2.3256 * t * t - 3.1356 * t * t * t + 1.5046 * t * t * t * t) * 255)
    out.push([Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))])
  }
  return out
})()

/** Parse slice string: "all", "1,3", "0:10:2" */
function parseSliceString(s: string, length: number): number[] {
  const trimmed = s.trim().toLowerCase()
  if (trimmed === "all") return [...Array(length).keys()]

  const indices = new Set<number>()
  for (const segment of s.split(",")) {
    const seg = segment.trim()
    if (!seg) continue
    if (seg.includes(":")) {
      const parts = seg.split(":").map((p) => (p === "" ? undefined : Number.parseInt(p, 10)))
      if (parts.length === 3 && parts[2] === 0) throw new Error(`Slice step cannot be zero: ${seg}`)
      const [start, end, step] = [parts[0] ?? 0, parts[1] ?? length, parts[2] ?? 1]
      const s0 = start < 0 ? Math.max(0, length + start) : Math.min(start, length)
      const e0 = end < 0 ? Math.max(0, length + end) : Math.min(end, length)
      for (let i = s0; step > 0 ? i < e0 : i > e0; i += step) indices.add(i)
    } else {
      const idx = Number.parseInt(seg, 10)
      if (idx < -length || idx >= length) throw new Error(`Index ${idx} out of range`)
      indices.add(idx < 0 ? idx + length : idx)
    }
  }
  return [...indices].sort((a, b) => a - b)
}

/** Apply colormap to normalized [0,1] value. Returns [r,g,b] 0-255. */
function applyColormap(value: number, colormap: string): [number, number, number] {
  const v = Math.max(0, Math.min(1, value))
  if (colormap === "grayscale") {
    const u = Math.round(v * 255)
    return [u, u, u]
  }
  if (colormap === "hot") {
    // black -> red -> yellow -> white
    if (v < 1 / 3) {
      const r = Math.round(v * 3 * 255)
      return [r, 0, 0]
    }
    if (v < 2 / 3) {
      const g = Math.round((v - 1 / 3) * 3 * 255)
      return [255, g, 0]
    }
    const b = Math.round((v - 2 / 3) * 3 * 255)
    return [255, 255, b]
  }
  if (colormap === "viridis") {
    const idx = Math.min(255, Math.floor(v * 256))
    return VIRIDIS_TABLE[idx] as [number, number, number]
  }
  const u = Math.round(v * 255)
  return [u, u, u]
}

/** Draw white X marker at (y,x) */
function drawMarker(frame: Uint8ClampedArray, width: number, height: number, y: number, x: number, size: number = 1): void {
  for (let d = -size; d <= size; d++) {
    for (const [dy, dx] of [
      [d, d],
      [d, -d],
    ]) {
      const yy = y + dy
      const xx = x + dx
      if (yy >= 0 && yy < height && xx >= 0 && xx < width) {
        const i = (yy * width + xx) * 4
        frame[i] = frame[i + 1] = frame[i + 2] = 255
      }
    }
  }
}

async function runMovie(
  request: RunMovieRequest,
  sendProgress: (progress: number, message: string) => void
): Promise<RunMovieResponse> {
  const { input_zarr, pos, crop, channel, time, output, fps, colormap, spots } = request
  const cropId = String(crop).padStart(3, "0")
  const posId = String(pos).padStart(3, "0")
  const workspacePath = path.dirname(input_zarr)

  try {
    const arr = await getCachedZarrArray(workspacePath, posId, cropId)
    const [, nChannels] = arr.shape
    if (channel >= nChannels) {
      return { ok: false, error: `Channel ${channel} out of range (0-${nChannels - 1})` }
    }
  } catch (e) {
    return { ok: false, error: `Crop ${cropId} not found in position ${posId}: ${e instanceof Error ? e.message : String(e)}` }
  }

  let timeIndices: number[]
  try {
    const arr = await getCachedZarrArray(workspacePath, posId, cropId)
    timeIndices = parseSliceString(time, arr.shape[0])
  } catch (e) {
    return { ok: false, error: `Invalid time slice: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (timeIndices.length === 0) {
    return { ok: false, error: "No frames to write" }
  }

  const spotsByT: Map<number, Array<[number, number]>> = new Map()
  if (spots) {
    try {
      const csvText = await readFile(spots, "utf8")
      const lines = csvText.trim().split("\n")
      if (lines.length > 1) {
        const header = lines[0].toLowerCase()
        const cols = header.split(",").map((c) => c.trim())
        const tIdx = cols.indexOf("t")
        const cropIdx = cols.indexOf("crop")
        const yIdx = cols.indexOf("y")
        const xIdx = cols.indexOf("x")
        if (tIdx >= 0 && cropIdx >= 0 && yIdx >= 0 && xIdx >= 0) {
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",")
            const cVal = parts[cropIdx]?.trim()
            if (cVal !== cropId && cVal !== String(crop)) continue
            const tVal = Number.parseInt(parts[tIdx] ?? "0", 10)
            const yVal = Number.parseFloat(parts[yIdx] ?? "0")
            const xVal = Number.parseFloat(parts[xIdx] ?? "0")
            const list = spotsByT.get(tVal) ?? []
            list.push([yVal, xVal])
            spotsByT.set(tVal, list)
          }
        }
      }
    } catch {
      // ignore spots load errors
    }
  }

  const framesRaw: Float64Array[] = []
  const arr = await getCachedZarrArray(workspacePath, posId, cropId)
  const [, , , height, width] = arr.shape

  for (let i = 0; i < timeIndices.length; i++) {
    const t = timeIndices[i]
    sendProgress((i + 1) / timeIndices.length * 0.4, `Reading frames ${i + 1}/${timeIndices.length}`)
    const resp = await loadZarrFrame({
      workspacePath,
      posId,
      cropId,
      t,
      c: channel,
      z: 0,
    })
    if (!resp.ok) return { ok: false, error: resp.error }
    const data = new Uint8Array(resp.data)
    const u16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2)
    const f64 = new Float64Array(height * width)
    for (let j = 0; j < u16.length; j++) f64[j] = u16[j]
    framesRaw.push(f64)
  }

  let globalMin = Infinity
  let globalMax = -Infinity
  for (const f of framesRaw) {
    for (let i = 0; i < f.length; i++) {
      if (f[i] < globalMin) globalMin = f[i]
      if (f[i] > globalMax) globalMax = f[i]
    }
  }

  const range = globalMax - globalMin
  const frames: Uint8ClampedArray[] = []

  for (let fi = 0; fi < framesRaw.length; fi++) {
    const frameRaw = framesRaw[fi]
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < frameRaw.length; i++) {
      const norm = range > 0 ? (frameRaw[i] - globalMin) / range : 0
      const [r, g, b] = applyColormap(norm, colormap)
      rgba[i * 4] = r
      rgba[i * 4 + 1] = g
      rgba[i * 4 + 2] = b
      rgba[i * 4 + 3] = 255
    }
    const tVal = timeIndices[fi]
    const spotList = spotsByT.get(tVal)
    if (spotList) {
      for (const [yf, xf] of spotList) {
        drawMarker(rgba, width, height, Math.round(yf), Math.round(xf))
      }
    }
    frames.push(rgba)
  }

  let outW = width
  let outH = height
  const padH = (16 - (height % 16)) % 16
  const padW = (16 - (width % 16)) % 16
  if (padH > 0 || padW > 0) {
    outW = width + padW
    outH = height + padH
    const padded: Uint8ClampedArray[] = []
    for (const f of frames) {
      const p = new Uint8ClampedArray(outW * outH * 4)
      p.fill(0)
      for (let y = 0; y < height; y++) {
        p.set(f.subarray(y * width * 4, (y + 1) * width * 4), y * outW * 4)
      }
      padded.push(p)
    }
    frames.length = 0
    frames.push(...padded)
  }

  await mkdir(path.dirname(output), { recursive: true })

  const ffmpegMod = await import("ffmpeg-static")
  const ffmpegPath: string | null =
    typeof ffmpegMod === "object" && ffmpegMod !== null && "default" in ffmpegMod
      ? (ffmpegMod as { default: string | null }).default
      : null
  if (!ffmpegPath || typeof ffmpegPath !== "string") {
    return { ok: false, error: "ffmpeg binary not found" }
  }
  const args = [
    "-f", "rawvideo",
    "-pix_fmt", "rgb24",
    "-s", `${outW}x${outH}`,
    "-r", String(fps),
    "-i", "pipe:0",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "slow",
    "-crf", "15",
    "-y",
    output,
  ]

  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: ["pipe", "ignore", "ignore"],
    }) as ReturnType<typeof spawn> & { stdin: NodeJS.WritableStream }
    let written = 0
    const writeNext = () => {
      if (written >= frames.length) {
        proc.stdin.end()
        proc.on("close", (code: number | null) => {
          if (code === 0) {
            sendProgress(1, `Wrote ${output}`)
            resolve({ ok: true })
          } else {
            resolve({ ok: false, error: `ffmpeg exited with code ${code}` })
          }
        })
        return
      }
      const frame = frames[written]
      const rgb = new Uint8Array(outW * outH * 3)
      for (let i = 0; i < outW * outH; i++) {
        rgb[i * 3] = frame[i * 4]
        rgb[i * 3 + 1] = frame[i * 4 + 1]
        rgb[i * 3 + 2] = frame[i * 4 + 2]
      }
      const ok = proc.stdin.write(rgb)
      written++
      sendProgress(0.4 + (written / frames.length) * 0.6, `Encoding ${written}/${frames.length}`)
      if (ok) {
        setImmediate(writeNext)
      } else {
        proc.stdin.once("drain", writeNext)
      }
    }
    writeNext()
  })
}

async function getZarrDeps(): Promise<{
  zarr: typeof import("zarrita")
  FileSystemStore: typeof FileSystemStore
}> {
  if (!zarrModulePromise) {
    zarrModulePromise = import("zarrita")
  }
  if (!fsStoreCtorPromise) {
    fsStoreCtorPromise = import("@zarrita/storage/fs").then((module) => module.default)
  }
  return {
    zarr: await zarrModulePromise,
    FileSystemStore: await fsStoreCtorPromise,
  }
}

async function getZarrContext(workspacePath: string): Promise<ZarrContext> {
  const existing = zarrContextByWorkspacePath.get(workspacePath)
  if (existing) return existing

  const { zarr, FileSystemStore } = await getZarrDeps()
  const zarrPath = path.join(workspacePath, "crops.zarr")
  const store = new FileSystemStore(zarrPath)
  const root: ZarrLocation = zarr.root(store)
  const context: ZarrContext = { root, arrays: new Map() }
  zarrContextByWorkspacePath.set(workspacePath, context)
  return context
}

async function getMasksContext(masksPath: string): Promise<ZarrContext> {
  const existing = masksContextByMasksPath.get(masksPath)
  if (existing) return existing

  const { zarr, FileSystemStore } = await getZarrDeps()
  const store = new FileSystemStore(masksPath)
  const root: ZarrLocation = zarr.root(store)
  const context: ZarrContext = { root, arrays: new Map() }
  masksContextByMasksPath.set(masksPath, context)
  return context
}

async function getCachedMasksArray(
  masksPath: string,
  posId: string,
  cropId: string
): Promise<ZarrArrayHandle> {
  const context = await getMasksContext(masksPath)
  const key = `${posId}/${cropId}`
  let promise = context.arrays.get(key)
  if (!promise) {
    const { zarr } = await getZarrDeps()
    promise = zarr.open(context.root.resolve(`pos/${posId}/crop/${cropId}`), { kind: "array" })
    promise.catch(() => {
      const current = context.arrays.get(key)
      if (current === promise) context.arrays.delete(key)
    })
    context.arrays.set(key, promise)
  }
  return promise
}

async function getCachedZarrArray(
  workspacePath: string,
  posId: string,
  cropId: string
): Promise<ZarrArrayHandle> {
  const context = await getZarrContext(workspacePath)
  const key = `${posId}/${cropId}`
  let promise = context.arrays.get(key)
  if (!promise) {
    const { zarr } = await getZarrDeps()
    promise = zarr.open(context.root.resolve(`pos/${posId}/crop/${cropId}`), { kind: "array" })
    promise.catch(() => {
      const current = context.arrays.get(key)
      if (current === promise) context.arrays.delete(key)
    })
    context.arrays.set(key, promise)
  }
  return promise
}

async function readShapeFromZarrayFile(cropPath: string): Promise<number[] | null> {
  try {
    const text = await readFile(path.join(cropPath, ".zarray"), "utf8")
    const parsed = JSON.parse(text) as { shape?: unknown }
    if (!Array.isArray(parsed.shape)) return null
    const shape = parsed.shape.filter((value): value is number => typeof value === "number")
    return shape.length >= 5 ? shape : null
  } catch {
    return null
  }
}

/** Resolve requested pos id to actual dir name under posRoot (e.g. 58 → 058 for Python layout). */
async function resolvePosIds(
  posRoot: string,
  positionFilter: string[]
): Promise<string[]> {
  let dirNames: string[]
  try {
    const entries = await readdir(posRoot, { withFileTypes: true })
    dirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
  const resolved: string[] = []
  for (const requested of positionFilter) {
    if (dirNames.includes(requested)) {
      resolved.push(requested)
      continue
    }
    const asNum = Number.parseInt(requested, 10)
    if (!Number.isNaN(asNum)) {
      const padded = String(asNum).padStart(3, "0")
      if (dirNames.includes(padded)) {
        resolved.push(padded)
        continue
      }
    }
    resolved.push(requested)
  }
  return resolved
}

async function discoverZarr({
  workspacePath,
  positionFilter,
  metadataMode = "full",
}: DiscoverZarrRequest): Promise<DiscoverZarrResponse> {
  const response: DiscoverZarrResponse = { positions: [], crops: {} }
  const posRoot = path.join(workspacePath, "crops.zarr", "pos")

  let discoveredPosIds: string[]
  if (positionFilter && positionFilter.length > 0) {
    discoveredPosIds = await resolvePosIds(posRoot, positionFilter)
  } else {
    try {
      const entries = await readdir(posRoot, { withFileTypes: true })
      discoveredPosIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    } catch {
      return response
    }
  }

  for (const posId of discoveredPosIds) {
    const cropRoot = path.join(posRoot, posId, "crop")
    let cropIds: string[]
    try {
      const entries = await readdir(cropRoot, { withFileTypes: true })
      cropIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    } catch {
      continue
    }

    if (cropIds.length === 0) continue

    response.positions.push(posId)
    const infos: Array<{ posId: string; cropId: string; shape: number[] }> = []
    if (metadataMode === "fast") {
      const firstShape = (await readShapeFromZarrayFile(path.join(cropRoot, cropIds[0]))) ?? [1, 1, 1, 1, 1]
      for (const cropId of cropIds) {
        infos.push({ posId, cropId, shape: firstShape })
      }
    } else {
      for (const cropId of cropIds) {
        try {
          const arr = await getCachedZarrArray(workspacePath, posId, cropId)
          infos.push({ posId, cropId, shape: [...arr.shape] })
        } catch {
          // skip crop if it can't be opened
        }
      }
    }
    response.crops[posId] = infos
  }

  return response
}

async function loadZarrFrame({
  workspacePath,
  posId,
  cropId,
  t,
  c,
  z,
}: LoadZarrFrameRequest): Promise<LoadZarrFrameResponse> {
  const key = `${posId}/${cropId}`
  try {
    const context = await getZarrContext(workspacePath)
    let arr = await getCachedZarrArray(workspacePath, posId, cropId)
    let chunk: ZarrChunk
    try {
      chunk = await arr.getChunk([t, c, z, 0, 0])
    } catch {
      context.arrays.delete(key)
      arr = await getCachedZarrArray(workspacePath, posId, cropId)
      chunk = await arr.getChunk([t, c, z, 0, 0])
    }

    const source = chunk.data
    const typed =
      source instanceof Uint16Array
        ? source
        : Uint16Array.from(source as ArrayLike<number>)
    const output = new Uint16Array(typed.length)
    output.set(typed)
    const height = chunk.shape[chunk.shape.length - 2]
    const width = chunk.shape[chunk.shape.length - 1]
    return {
      ok: true,
      width,
      height,
      data: toArrayBuffer(new Uint8Array(output.buffer)),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message || "Failed to load frame." }
  }
}

async function hasMasks({ masksPath }: HasMasksRequest): Promise<HasMasksResponse> {
  try {
    await access(masksPath, constants.R_OK)
    const posRoot = path.join(masksPath, "pos")
    await access(posRoot, constants.R_OK)
    return { hasMasks: true }
  } catch {
    return { hasMasks: false }
  }
}

async function pickMasksDirectory(): Promise<{ path: string } | null> {
  const result = await dialog.showOpenDialog({
    title: "Select masks zarr folder",
    properties: ["openDirectory"],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const chosen = result.filePaths[0]
  try {
    await access(chosen, constants.R_OK)
    const posRoot = path.join(chosen, "pos")
    await access(posRoot, constants.R_OK)
  } catch {
    return null
  }
  return { path: chosen }
}

async function loadMaskFrame({
  masksPath,
  posId,
  cropId,
  t,
}: LoadMaskFrameRequest): Promise<LoadMaskFrameResponse> {
  const key = `${posId}/${cropId}`
  try {
    const context = await getMasksContext(masksPath)
    let arr = await getCachedMasksArray(masksPath, posId, cropId)
    let chunk: ZarrChunk
    try {
      chunk = await arr.getChunk([t, 0, 0])
    } catch {
      context.arrays.delete(key)
      arr = await getCachedMasksArray(masksPath, posId, cropId)
      chunk = await arr.getChunk([t, 0, 0])
    }

    const source = chunk.data
    const typed =
      source instanceof Uint32Array
        ? source
        : Uint32Array.from(source as ArrayLike<number>)
    const output = new Uint32Array(typed.length)
    output.set(typed)
    const height = chunk.shape[chunk.shape.length - 2]
    const width = chunk.shape[chunk.shape.length - 1]
    return {
      ok: true,
      width,
      height,
      data: toArrayBuffer(new Uint8Array(output.buffer)),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message || "Failed to load mask frame." }
  }
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
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      request_json TEXT NOT NULL,
      result_json TEXT,
      error TEXT,
      logs_json TEXT NOT NULL,
      progress_events_json TEXT NOT NULL
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

interface TaskRecord {
  id: string
  kind: string
  status: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  request: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  logs: string[]
  progress_events: Array<{ progress: number; message: string; timestamp: string }>
}

async function insertTask(task: TaskRecord): Promise<void> {
  const db = await ensureWorkspaceDb()
  db.run(
    `INSERT INTO tasks (id, kind, status, created_at, started_at, finished_at, request_json, result_json, error, logs_json, progress_events_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.kind,
      task.status,
      task.created_at,
      task.started_at,
      task.finished_at,
      JSON.stringify(task.request ?? {}),
      task.result != null ? JSON.stringify(task.result) : null,
      task.error,
      JSON.stringify(task.logs ?? []),
      JSON.stringify(task.progress_events ?? []),
    ],
  )
  await persistWorkspaceDb(db)
}

async function updateTask(
  id: string,
  updates: Partial<Pick<TaskRecord, "status" | "finished_at" | "error" | "progress_events">>
): Promise<void> {
  const db = await ensureWorkspaceDb()
  const sets: string[] = []
  const values: (string | number | null)[] = []
  if (updates.status != null) {
    sets.push("status = ?")
    values.push(updates.status)
  }
  if (updates.finished_at != null) {
    sets.push("finished_at = ?")
    values.push(updates.finished_at)
  }
  if (updates.error != null) {
    sets.push("error = ?")
    values.push(updates.error)
  }
  if (updates.progress_events != null) {
    sets.push("progress_events_json = ?")
    values.push(JSON.stringify(updates.progress_events))
  }
  if (sets.length === 0) return
  values.push(id)
  db.run(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`, values)
  await persistWorkspaceDb(db)
}

async function listTasks(): Promise<TaskRecord[]> {
  const db = await ensureWorkspaceDb()
  const stmt = db.prepare(
    "SELECT id, kind, status, created_at, started_at, finished_at, request_json, result_json, error, logs_json, progress_events_json FROM tasks ORDER BY created_at DESC",
  )
  const rows: TaskRecord[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    rows.push({
      id: r.id as string,
      kind: r.kind as string,
      status: r.status as string,
      created_at: r.created_at as string,
      started_at: (r.started_at as string) ?? null,
      finished_at: (r.finished_at as string) ?? null,
      request: (() => {
        try {
          return (typeof r.request_json === "string" ? JSON.parse(r.request_json) : {}) as Record<string, unknown>
        } catch {
          return {}
        }
      })(),
      result: (() => {
        if (r.result_json == null) return null
        try {
          return (typeof r.result_json === "string" ? JSON.parse(r.result_json) : null) as Record<string, unknown>
        } catch {
          return null
        }
      })(),
      error: (r.error as string) ?? null,
      logs: (() => {
        try {
          return (typeof r.logs_json === "string" ? JSON.parse(r.logs_json) : []) as string[]
        } catch {
          return []
        }
      })(),
      progress_events: (() => {
        try {
          return (typeof r.progress_events_json === "string" ? JSON.parse(r.progress_events_json) : []) as TaskRecord["progress_events"]
        } catch {
          return []
        }
      })(),
    })
  }
  stmt.free()
  return rows
}

function registerWorkspaceStateIpc(): void {
  ipcMain.handle("workspace-state:load", async () => {
    return loadWorkspaceStateFromDb()
  })

  ipcMain.handle("workspace-state:save", async (_event, payload: unknown) => {
    await saveWorkspaceStateToDb(payload)
    return true
  })

  ipcMain.handle("workspace:pick-directory", async () => {
    return pickWorkspaceDirectory()
  })

  ipcMain.handle("workspace:read-position-image", async (_event, payload: ReadPositionImageRequest) => {
    return readAndNormalizePositionImage(payload)
  })

  ipcMain.handle("workspace:save-bbox-csv", async (_event, payload: SaveBboxCsvRequest) => {
    return saveBboxCsvToWorkspace(payload)
  })

  ipcMain.handle("workspace:pick-tags-file", async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "Select tags YAML file",
      properties: ["openFile"],
      filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const content = await readFile(result.filePaths[0], "utf-8")
    return content
  })

  ipcMain.handle("zarr:discover", async (_event, payload: DiscoverZarrRequest) => {
    return discoverZarr(payload)
  })

  ipcMain.handle("zarr:load-frame", async (_event, payload: LoadZarrFrameRequest) => {
    return loadZarrFrame(payload)
  })

  ipcMain.handle("zarr:has-masks", async (_event, payload: HasMasksRequest) => {
    return hasMasks(payload)
  })

  ipcMain.handle("zarr:load-mask-frame", async (_event, payload: LoadMaskFrameRequest) => {
    return loadMaskFrame(payload)
  })

  ipcMain.handle("zarr:pick-masks-dir", async () => {
    return pickMasksDirectory()
  })

  ipcMain.handle("tasks:pick-crops-destination", async () => {
    const result = await dialog.showOpenDialog({
      title: "Select folder for crops.zarr",
      properties: ["openDirectory"],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return { path: path.join(result.filePaths[0], "crops.zarr") }
  })

  ipcMain.handle("tasks:pick-movie-output", async (): Promise<{ path: string } | null> => {
    const result = await dialog.showSaveDialog({
      title: "Save movie as",
      filters: [{ name: "MP4", extensions: ["mp4"] }],
    })
    if (result.canceled || !result.filePath) return null
    return { path: result.filePath }
  })

  ipcMain.handle("tasks:pick-spots-file", async (): Promise<{ path: string } | null> => {
    const result = await dialog.showOpenDialog({
      title: "Select spots CSV (t,crop,spot,y,x)",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return { path: result.filePaths[0] }
  })

  ipcMain.handle(
    "tasks:has-bbox-csv",
    async (
      _event,
      payload: { workspacePath: string; pos: number }
    ): Promise<boolean> => {
      try {
        const bboxPath = path.join(
          payload.workspacePath,
          `Pos${payload.pos}_bbox.csv`
        )
        await access(bboxPath, constants.R_OK)
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle(
    "tasks:run-movie",
    async (
      event: Electron.IpcMainInvokeEvent,
      payload: RunMovieRequest
    ): Promise<RunMovieResponse> => {
      const progressEvents: Array<{ progress: number; message: string; timestamp: string }> = []
      const sendProgress = (progress: number, message: string) => {
        progressEvents.push({
          progress,
          message,
          timestamp: new Date().toISOString(),
        })
        event.sender.send("tasks:movie-progress", {
          taskId: payload.taskId,
          progress,
          message,
        })
        updateTask(payload.taskId, { progress_events: progressEvents }).catch(() => {})
      }
      const result = await runMovie(payload, sendProgress)
      await updateTask(payload.taskId, {
        status: result.ok ? "succeeded" : "failed",
        finished_at: new Date().toISOString(),
        error: result.ok ? null : result.error,
        progress_events: progressEvents,
      })
      return result
    }
  )

  ipcMain.handle(
    "tasks:run-crop",
    async (
      event: Electron.IpcMainInvokeEvent,
      payload: RunCropRequest
    ): Promise<RunCropResponse> => {
      const progressEvents: Array<{ progress: number; message: string; timestamp: string }> = []
      const sendProgress = (progress: number, message: string) => {
        progressEvents.push({
          progress,
          message,
          timestamp: new Date().toISOString(),
        })
        event.sender.send("tasks:crop-progress", {
          taskId: payload.taskId,
          progress,
          message,
        })
        updateTask(payload.taskId, { progress_events: progressEvents }).catch(() => {})
      }
      const result = await runCrop(payload, sendProgress)
      await updateTask(payload.taskId, {
        status: result.ok ? "succeeded" : "failed",
        finished_at: new Date().toISOString(),
        error: result.ok ? null : result.error,
        progress_events: progressEvents,
      })
      return result
    }
  )

  ipcMain.handle("tasks:insert-task", async (_event, task: TaskRecord) => {
    await insertTask(task)
    return true
  })

  ipcMain.handle(
    "tasks:update-task",
    async (
      _event,
      id: string,
      updates: Partial<Pick<TaskRecord, "status" | "finished_at" | "error" | "progress_events">>
    ) => {
      await updateTask(id, updates)
      return true
    }
  )

  ipcMain.handle("tasks:list-tasks", async () => {
    return listTasks()
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
