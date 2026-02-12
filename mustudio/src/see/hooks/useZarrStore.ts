import { useState, useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import { DirectoryStore } from "@/see/lib/directory-store";
import { discoverStore, type StoreIndex } from "@/see/lib/zarr";
import {
  workspaceStore,
  getDirHandle,
  restoreDirHandle,
} from "@/workspace/store";
import { setSelectedPositions, setSelectedPos, setC, setZ } from "@/see/store";

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function useZarrStore() {
  const activeWorkspace = useStore(workspaceStore, (s) => {
    const { activeId, workspaces } = s;
    if (!activeId) return null;
    return workspaces.find((w) => w.id === activeId) ?? null;
  });
  const loadKey = useStore(workspaceStore, (s) => {
    const { activeId, workspaces } = s;
    if (!activeId) return "none";
    const w = workspaces.find((item) => item.id === activeId);
    if (!w) return "none";
    const pos = w.positions[w.currentIndex];
    return `${w.id}:${w.currentIndex}:${pos ?? "none"}`;
  });
  const [store, setStore] = useState<DirectoryStore | null>(null);
  const [index, setIndex] = useState<StoreIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Auto-load crops.zarr from the active workspace and current position. */
  useEffect(() => {
    let cancelled = false;

    async function loadFromWorkspace() {
      if (!activeWorkspace) {
        setStore(null);
        setIndex(null);
        setError("No active workspace.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let workspaceHandle = getDirHandle(activeWorkspace.id);
        if (!workspaceHandle) {
          workspaceHandle = await restoreDirHandle(activeWorkspace.id);
        }
        if (!workspaceHandle) {
          throw new Error("Workspace folder is unavailable. Re-open the workspace.");
        }

        const cropsHandle = await workspaceHandle.getDirectoryHandle("crops.zarr");
        const ds = new DirectoryStore(cropsHandle);

        const workspacePos = activeWorkspace.positions[activeWorkspace.currentIndex];
        if (typeof workspacePos !== "number") {
          throw new Error("No position selected in workspace.");
        }

        const resolvedPosId = String(workspacePos);
        const idx: StoreIndex = await withTimeout(
          discoverStore(
            cropsHandle,
            ds,
            [resolvedPosId],
            { metadataMode: "fast" }
          ),
          12000,
          `Timed out loading crops at pos/${resolvedPosId}/crop.`
        );

        if (idx.positions.length === 0) {
          throw new Error(`No crops found at path pos/${resolvedPosId}/crop.`);
        }

        if (cancelled) return;
        setStore(ds);
        setIndex(idx);
        setSelectedPositions([resolvedPosId]);
        setSelectedPos(resolvedPosId);
        setC(activeWorkspace.selectedChannel);
        setZ(activeWorkspace.selectedZ);
      } catch (e) {
        if (!cancelled) {
          setStore(null);
          setIndex(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadFromWorkspace();
    return () => { cancelled = true; };
  }, [activeWorkspace, loadKey]);

  return {
    store,
    index,
    loading,
    error,
  };
}
