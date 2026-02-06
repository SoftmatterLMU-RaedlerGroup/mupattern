import { useState, useCallback, useEffect, useRef } from "react";
import type { DirectoryStore } from "@/lib/directory-store";
import type { StoreIndex, CropInfo } from "@/lib/zarr";
import { loadFrame } from "@/lib/zarr";
import { renderUint16ToCanvas } from "@/lib/render";
import {
  type Annotations,
  annotationKey,
  downloadCSV,
  uploadCSV,
} from "@/lib/annotations";
import { Slider } from "@mupattern/ui/components/ui/slider";
import { Button } from "@mupattern/ui/components/ui/button";
import { Switch } from "@mupattern/ui/components/ui/switch";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sun,
  Moon,
  Download,
  Upload,
  Pencil,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

const PAGE_SIZE = 25; // 5x5

interface ViewerProps {
  store: DirectoryStore;
  index: StoreIndex;
}

export function Viewer({ store, index }: ViewerProps) {
  const { theme, toggleTheme } = useTheme();
  const [selectedPos, setSelectedPos] = useState(index.positions[0] ?? "");
  const [t, setT] = useState(0);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [contrastMin, setContrastMin] = useState(0);
  const [contrastMax, setContrastMax] = useState(65535);
  const [autoContrastDone, setAutoContrastDone] = useState(false);
  const [annotations, setAnnotations] = useState<Annotations>(new Map());
  const [annotating, setAnnotating] = useState(false);

  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const crops: CropInfo[] = index.crops.get(selectedPos) ?? [];
  const maxT = crops.length > 0 ? crops[0].shape[0] - 1 : 0;
  const totalPages = Math.ceil(crops.length / PAGE_SIZE);
  const pageCrops = crops.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Playback
  useEffect(() => {
    if (playing) {
      playIntervalRef.current = setInterval(() => {
        setT((prev) => (prev >= maxT ? 0 : prev + 1));
      }, 500);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [playing, maxT]);

  // Load visible crops and render
  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      const frames = await Promise.all(
        pageCrops.map((crop) =>
          loadFrame(store, crop.posId, crop.cropId, t).catch(() => null)
        )
      );

      if (cancelled) return;

      // Compute auto-contrast from all visible crops combined
      if (!autoContrastDone) {
        const allData: number[] = [];
        for (const f of frames) {
          if (f) {
            for (let i = 0; i < f.data.length; i += 4) {
              allData.push(f.data[i]);
            }
          }
        }
        if (allData.length > 0) {
          const sorted = new Uint16Array(allData).sort();
          const lo = sorted[Math.floor(sorted.length * 0.02)];
          const hi = sorted[Math.floor(sorted.length * 0.98)];
          setContrastMin(lo);
          setContrastMax(hi);
          setAutoContrastDone(true);
        }
      }

      // Render each crop
      for (let i = 0; i < pageCrops.length; i++) {
        const frame = frames[i];
        const canvas = canvasRefs.current.get(pageCrops[i].cropId);
        if (!frame || !canvas) continue;
        renderUint16ToCanvas(
          canvas,
          frame.data,
          frame.width,
          frame.height,
          contrastMin,
          contrastMax
        );
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, selectedPos, t, page, contrastMin, contrastMax, autoContrastDone]);

  const setCanvasRef = useCallback(
    (cropId: string) => (el: HTMLCanvasElement | null) => {
      if (el) {
        canvasRefs.current.set(cropId, el);
      } else {
        canvasRefs.current.delete(cropId);
      }
    },
    []
  );

  const resetAutoContrast = useCallback(() => {
    setAutoContrastDone(false);
  }, []);

  const handleChangePos = useCallback((posId: string) => {
    setSelectedPos(posId);
    setT(0);
    setPage(0);
    setAutoContrastDone(false);
  }, []);

  // Annotation handler: click cycles true → false → remove
  const handleAnnotate = useCallback(
    (cropId: string) => {
      setAnnotations((prev) => {
        const key = annotationKey(t, cropId);
        const next = new Map(prev);
        const current = prev.get(key);
        if (current === undefined) {
          next.set(key, true);
        } else if (current === true) {
          next.set(key, false);
        } else {
          next.delete(key);
        }
        return next;
      });
    },
    [t]
  );

  const handleSave = useCallback(() => {
    downloadCSV(annotations, `annotations_pos${selectedPos}.csv`);
  }, [annotations, selectedPos]);

  const handleLoad = useCallback(async () => {
    try {
      const loaded = await uploadCSV();
      setAnnotations(loaded);
    } catch {
      // user cancelled
    }
  }, []);

  // Border color for annotation state
  function borderClass(cropId: string): string {
    const key = annotationKey(t, cropId);
    const label = annotations.get(key);
    if (label === true) return "ring-2 ring-blue-500";
    if (label === false) return "ring-2 ring-red-500";
    return "";
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h1
            className="text-4xl tracking-tight"
            style={{ fontFamily: '"Bitcount", monospace' }}
          >
            MuSee
          </h1>
          <p className="text-base text-muted-foreground">
            Micropattern crop viewer
          </p>
        </div>
        <div className="flex items-center gap-6">
          {index.positions.length > 1 && (
            <select
              value={selectedPos}
              onChange={(e) => handleChangePos(e.target.value)}
              className="bg-secondary text-secondary-foreground rounded px-2 py-1 text-sm"
            >
              {index.positions.map((p) => (
                <option key={p} value={p}>
                  Pos {p}
                </option>
              ))}
            </select>
          )}
          <span className="text-sm text-muted-foreground">
            {crops.length} crops
          </span>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            variant={annotating ? "default" : "ghost"}
            size="xs"
            onClick={() => setAnnotating(!annotating)}
            title="Toggle annotation mode"
          >
            <Pencil className="size-3" />
            {annotating ? "Annotating" : "Annotate"}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {annotations.size} labeled
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleLoad} title="Load annotations CSV">
            <Upload className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={handleSave} title="Save annotations CSV" disabled={annotations.size === 0}>
            <Download className="size-3.5" />
          </Button>
          <div className="mx-1 h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Sun className="size-3.5 text-muted-foreground" />
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <Moon className="size-3.5 text-muted-foreground" />
          </div>
        </div>
      </header>

      {/* Slider row */}
      <div className="px-4 py-1 border-b">
        <Slider
          min={0}
          max={maxT}
          value={[t]}
          onValueChange={([v]) => setT(v)}
        />
      </div>

      {/* Frame controls + contrast */}
      <div className="flex items-center justify-center gap-3 px-4 py-2 border-b">
        <Button variant="ghost" size="icon-xs" onClick={() => setT(0)} disabled={t === 0}>
          <SkipBack className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setT(Math.max(0, t - 10))} disabled={t === 0}>
          <ChevronsLeft className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setT(Math.max(0, t - 1))} disabled={t === 0}>
          <ChevronLeft className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setPlaying(!playing)}>
          {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setT(Math.min(maxT, t + 1))} disabled={t >= maxT}>
          <ChevronRight className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setT(Math.min(maxT, t + 10))} disabled={t >= maxT}>
          <ChevronsRight className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={() => setT(maxT)} disabled={t >= maxT}>
          <SkipForward className="size-3" />
        </Button>

        <span className="text-sm tabular-nums whitespace-nowrap">
          t = {t} / {maxT}
        </span>

        <div className="mx-2 h-4 w-px bg-border" />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Contrast:</span>
          <input
            type="number"
            value={contrastMin}
            onChange={(e) => setContrastMin(Number(e.target.value))}
            className="w-20 bg-secondary text-center rounded px-1 py-0.5 text-sm"
          />
          <span>-</span>
          <input
            type="number"
            value={contrastMax}
            onChange={(e) => setContrastMax(Number(e.target.value))}
            className="w-20 bg-secondary text-center rounded px-1 py-0.5 text-sm"
          />
          <button
            onClick={resetAutoContrast}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Auto
          </button>
        </div>
      </div>

      {/* Crop grid */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="grid grid-cols-5 grid-rows-5 gap-2 h-full">
          {pageCrops.map((crop) => (
            <div
              key={crop.cropId}
              className={`relative rounded-sm ${annotating ? "cursor-crosshair" : ""} ${borderClass(crop.cropId)}`}
              onClick={annotating ? () => handleAnnotate(crop.cropId) : undefined}
            >
              <canvas
                ref={setCanvasRef(crop.cropId)}
                className="block w-full h-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="absolute bottom-0 left-0 px-1 text-[10px] bg-black/60 text-white">
                {crop.cropId}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 border-t">
        <Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(0)}>
          <SkipBack className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-3" />
        </Button>
        <span className="text-sm tabular-nums">
          Page {page + 1} / {totalPages}
        </span>
        <Button variant="ghost" size="icon-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
          <ChevronRight className="size-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
          <SkipForward className="size-3" />
        </Button>
      </div>
    </div>
  );
}
