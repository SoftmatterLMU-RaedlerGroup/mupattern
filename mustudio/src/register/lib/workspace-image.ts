import { loadImageFile } from "@/lib/load-tif"
import { clearDetectedPoints, loadImage } from "@/register/store"
import { readCurrentPositionImage } from "@/workspace/store"

function imageToDataURL(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas")
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL("image/png")
}

export async function reloadActiveWorkspaceImage(): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = await readCurrentPositionImage()
  if (!file) {
    return { ok: false, error: "Could not read selected file. Try a different position/channel/time/z." }
  }
  try {
    const loaded = await loadImageFile(file)
    const dataURL = imageToDataURL(loaded.img)
    loadImage(dataURL, loaded.baseName, loaded.width, loaded.height)
    clearDetectedPoints()
    return { ok: true }
  } catch {
    return { ok: false, error: "Failed to decode selected image." }
  }
}
