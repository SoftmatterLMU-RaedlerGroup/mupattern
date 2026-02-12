/**
 * Zarr tree discovery and data access.
 *
 * Layout: /pos/{posId}/crop/{cropId} → TCZYX arrays
 */

import * as zarr from "zarrita";
import type { DirectoryStore } from "./directory-store";

export interface CropInfo {
  posId: string;
  cropId: string;
  /** TCZYX shape */
  shape: readonly number[];
  bbox?: { x: number; y: number; w: number; h: number; crop: number };
}

export interface StoreIndex {
  positions: string[];
  crops: Map<string, CropInfo[]>;
}

export interface DiscoverStoreOptions {
  metadataMode?: "full" | "fast";
}

const arrayCache = new WeakMap<
  DirectoryStore,
  Map<string, Promise<{ getChunk: (idx: number[]) => Promise<{ data: unknown; shape: number[] }> } & { shape: readonly number[]; attrs?: unknown }>>
>();

function getCachedArray(
  store: DirectoryStore,
  posId: string,
  cropId: string
) {
  let storeCache = arrayCache.get(store);
  if (!storeCache) {
    storeCache = new Map();
    arrayCache.set(store, storeCache);
  }
  const key = `${posId}/${cropId}`;
  let arrPromise = storeCache.get(key);
  if (!arrPromise) {
    const root = zarr.root(store);
    arrPromise = zarr.open(root.resolve(`pos/${posId}/crop/${cropId}`), {
      kind: "array",
    }) as Promise<{ getChunk: (idx: number[]) => Promise<{ data: unknown; shape: number[] }> } & { shape: readonly number[]; attrs?: unknown }>;
    arrPromise.catch(() => {
      const current = storeCache.get(key);
      if (current === arrPromise) {
        storeCache.delete(key);
      }
    });
    storeCache.set(key, arrPromise);
  }
  return arrPromise;
}

/** List immediate subdirectory names. */
async function listDirs(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === "directory") {
      names.push(entry.name);
    }
  }
  return names.sort();
}

async function readShapeFromZarray(
  cropDir: FileSystemDirectoryHandle,
  cropId: string
): Promise<readonly number[] | null> {
  try {
    const cropHandle = await cropDir.getDirectoryHandle(cropId);
    const zarrayHandle = await cropHandle.getFileHandle(".zarray");
    const zarrayFile = await zarrayHandle.getFile();
    const text = await zarrayFile.text();
    const parsed = JSON.parse(text) as { shape?: unknown };
    if (!Array.isArray(parsed.shape)) return null;
    const shape = parsed.shape.filter((v): v is number => typeof v === "number");
    return shape.length >= 5 ? shape : null;
  } catch {
    return null;
  }
}

/**
 * Quick scan: list just the position IDs without reading any zarr arrays.
 */
export async function listPositions(
  rootDirHandle: FileSystemDirectoryHandle
): Promise<string[]> {
  let posDir: FileSystemDirectoryHandle;
  try {
    posDir = await rootDirHandle.getDirectoryHandle("pos");
  } catch {
    return [];
  }

  const posIds = await listDirs(posDir);

  // Filter to only positions that actually have a crop/ subdirectory
  const valid: string[] = [];
  for (const posId of posIds) {
    try {
      const posHandle = await posDir.getDirectoryHandle(posId);
      await posHandle.getDirectoryHandle("crop");
      valid.push(posId);
    } catch {
      continue;
    }
  }

  return valid;
}

/**
 * Discover positions and crops inside a crops.zarr directory handle.
 * If `positionFilter` is provided, only those positions are scanned.
 */
export async function discoverStore(
  rootDirHandle: FileSystemDirectoryHandle,
  store: DirectoryStore,
  positionFilter?: string[],
  options: DiscoverStoreOptions = {}
): Promise<StoreIndex> {
  const positions: string[] = [];
  const crops = new Map<string, CropInfo[]>();
  const metadataMode = options.metadataMode ?? "full";

  let posDir: FileSystemDirectoryHandle;
  try {
    posDir = await rootDirHandle.getDirectoryHandle("pos");
  } catch {
    return { positions, crops };
  }

  const root = zarr.root(store);
  const posIds = positionFilter ?? await listDirs(posDir);

  for (const posId of posIds) {
    let cropDir: FileSystemDirectoryHandle;
    try {
      const posHandle = await posDir.getDirectoryHandle(posId);
      cropDir = await posHandle.getDirectoryHandle("crop");
    } catch {
      continue;
    }

    const cropIds = await listDirs(cropDir);
    if (cropIds.length === 0) continue;

    positions.push(posId);
    const infos: CropInfo[] = [];
    if (metadataMode === "fast") {
      // Fast path for large positions: avoid array opens, read shape from .zarray metadata.
      const representativeShape =
        await readShapeFromZarray(cropDir, cropIds[0]) ?? [1, 1, 1, 1, 1];
      for (const cropId of cropIds) {
        infos.push({
          posId,
          cropId,
          shape: representativeShape,
        });
      }
    } else {
      for (const cropId of cropIds) {
        try {
          const arr = await zarr.open(
            root.resolve(`pos/${posId}/crop/${cropId}`),
            { kind: "array" }
          );
          const attrs = (arr.attrs ?? {}) as Record<string, unknown>;
          infos.push({
            posId,
            cropId,
            shape: arr.shape,
            bbox: attrs.bbox as CropInfo["bbox"],
          });
        } catch {
          // skip
        }
      }
    }

    crops.set(posId, infos);
  }

  return { positions, crops };
}

/**
 * Load a single (t, c, z) chunk → { data, height, width }.
 */
export async function loadFrame(
  store: DirectoryStore,
  posId: string,
  cropId: string,
  t: number,
  c: number = 0,
  z: number = 0
): Promise<{ data: Uint16Array; height: number; width: number }> {
  const key = `${posId}/${cropId}`;
  let arr = await getCachedArray(store, posId, cropId);
  let chunk;
  try {
    chunk = await arr.getChunk([t, c, z, 0, 0]);
  } catch {
    // First attempt failed: evict cached handle/promise and retry once.
    arrayCache.get(store)?.delete(key);
    arr = await getCachedArray(store, posId, cropId);
    chunk = await arr.getChunk([t, c, z, 0, 0]);
  }
  // chunk.shape is the full chunk shape: [1, 1, 1, H, W]
  const height = chunk.shape[chunk.shape.length - 2];
  const width = chunk.shape[chunk.shape.length - 1];
  return {
    data: chunk.data as Uint16Array,
    height,
    width,
  };
}
