import { useState, useCallback } from "react";
import { DirectoryStore } from "@/lib/directory-store";
import { discoverStore, type StoreIndex } from "@/lib/zarr";

export function useZarrStore() {
  const [store, setStore] = useState<DirectoryStore | null>(null);
  const [dirHandle, setDirHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [index, setIndex] = useState<StoreIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDirectory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const handle = await window.showDirectoryPicker({ mode: "read" });
      const ds = new DirectoryStore(handle);
      const idx = await discoverStore(handle, ds);

      if (idx.positions.length === 0) {
        setError("No positions found. Expected layout: pos/{id}/crop/{id}/");
        return;
      }

      setDirHandle(handle);
      setStore(ds);
      setIndex(idx);
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { store, dirHandle, index, loading, error, openDirectory };
}
