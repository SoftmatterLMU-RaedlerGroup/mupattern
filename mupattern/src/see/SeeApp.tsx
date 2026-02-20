import { useZarrStore } from "@/see/hooks/useZarrStore";
import { Viewer } from "@/see/components/Viewer";
import { PositionPicker } from "@/see/components/PositionPicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { HexBackground } from "@/components/HexBackground";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

export default function SeeApp() {
  const { theme } = useTheme();
  const {
    store,
    index,
    availablePositions,
    loading,
    error,
    openDirectory,
    loadPositions,
  } = useZarrStore();

  // State 3: Viewer — positions loaded, show the viewer
  if (store && index) {
    return <Viewer store={store} index={index} />;
  }

  // State 2: Position picker — directory opened, positions discovered, awaiting selection
  if (store && availablePositions) {
    return (
      <div className="relative flex flex-col items-center justify-center h-screen gap-8 p-6">
        <HexBackground theme={theme} />
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="text-center">
          <h1 className="text-4xl tracking-tight" style={{ fontFamily: '"Bitcount", monospace' }}>MuSee</h1>
          <p className="text-muted-foreground mt-1 text-center max-w-md">
            Select which positions to load into the viewer.
          </p>
        </div>
        <PositionPicker
          positions={availablePositions}
          loading={loading}
          onConfirm={loadPositions}
        />
        {error && (
          <p className="text-destructive text-sm max-w-md text-center">
            {error}
          </p>
        )}
      </div>
    );
  }

  // State 1: Landing — prompt user to open a directory
  return (
    <div className="relative flex flex-col items-center justify-center h-screen gap-8 p-6">
      <HexBackground theme={theme} />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="text-center">
        <h1 className="text-4xl tracking-tight" style={{ fontFamily: '"Bitcount", monospace' }}>MuSee</h1>
        <p className="text-muted-foreground mt-1 text-center max-w-md">
          Open a crops.zarr directory to browse cropped micropattern cells.
        </p>
      </div>
      <div className="border rounded-lg p-8 backdrop-blur-sm bg-background/80 max-w-md w-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center gap-4">
            <FolderOpen className="size-12 text-muted-foreground flex-shrink-0" />
            <p className="font-medium">
              {loading ? "Loading..." : "Open crops.zarr"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Select a crops.zarr folder to browse micropattern crops.
          </p>
          <Button onClick={openDirectory} disabled={loading}>
            Choose folder
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-destructive text-sm max-w-md text-center">
          {error}
        </p>
      )}
    </div>
  );
}
