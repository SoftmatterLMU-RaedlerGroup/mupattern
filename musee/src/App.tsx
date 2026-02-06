import { useZarrStore } from "@/hooks/useZarrStore";
import { Viewer } from "@/components/Viewer";
import { Button } from "@mupattern/ui/components/ui/button";
import { FolderOpen } from "lucide-react";

export default function App() {
  const { store, index, loading, error, openDirectory } = useZarrStore();

  // Landing page: prompt user to open a directory
  if (!store || !index) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6">
        <h1 className="text-4xl tracking-tight" style={{ fontFamily: '"Bitcount", monospace' }}>MuSee</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Open a <span className="font-bold">crops.zarr</span> directory to browse cropped micropattern cells.
        </p>
        <Button onClick={openDirectory} disabled={loading} size="lg" className="whitespace-nowrap">
          <FolderOpen className="size-5" />
          {loading ? "Loading..." : <>Open <span className="font-bold">crops.zarr</span></>}
        </Button>
        {error && (
          <p className="text-destructive text-sm max-w-md text-center">
            {error}
          </p>
        )}
      </div>
    );
  }

  return <Viewer store={store} index={index} />;
}
