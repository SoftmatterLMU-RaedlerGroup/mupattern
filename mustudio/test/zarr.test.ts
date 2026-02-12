import { describe, expect, it, mock } from "bun:test";

const openMock = mock(async () => ({
  shape: [5, 2, 3, 32, 32],
  attrs: {},
}));

mock.module("zarrita", () => ({
  root: () => ({
    resolve: (path: string) => path,
  }),
  open: openMock,
}));

import { discoverStore } from "../src/see/lib/zarr";

class FakeDirHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private readonly children = new Map<string, FakeDirHandle>();

  constructor(name: string) {
    this.name = name;
  }

  addChild(child: FakeDirHandle): FakeDirHandle {
    this.children.set(child.name, child);
    return this;
  }

  async getDirectoryHandle(name: string): Promise<FakeDirHandle> {
    const next = this.children.get(name);
    if (!next) {
      throw new Error(`Missing directory: ${name}`);
    }
    return next;
  }

  async *values(): AsyncIterableIterator<FakeDirHandle> {
    for (const child of this.children.values()) {
      yield child;
    }
  }
}

function makeRootWithCrops(posId: string, cropIds: string[]): FakeDirHandle {
  const root = new FakeDirHandle("root");
  const pos = new FakeDirHandle("pos");
  const posEntry = new FakeDirHandle(posId);
  const crop = new FakeDirHandle("crop");
  for (const cropId of cropIds) {
    crop.addChild(new FakeDirHandle(cropId));
  }
  posEntry.addChild(crop);
  pos.addChild(posEntry);
  root.addChild(pos);
  return root;
}

describe("discoverStore", () => {
  it("uses fast metadata mode to avoid opening every crop array", async () => {
    openMock.mockClear();
    const root = makeRootWithCrops("140", ["a", "b", "c", "d"]);

    const index = await discoverStore(
      root as unknown as FileSystemDirectoryHandle,
      {} as never,
      ["140"],
      { metadataMode: "fast" }
    );

    expect(index.positions).toEqual(["140"]);
    expect(index.crops.get("140")?.map((x) => x.cropId)).toEqual(["a", "b", "c", "d"]);
    expect(openMock).toHaveBeenCalledTimes(0);
  });

  it("keeps full metadata mode behavior by opening each crop array", async () => {
    openMock.mockClear();
    const root = makeRootWithCrops("140", ["a", "b", "c"]);

    const index = await discoverStore(
      root as unknown as FileSystemDirectoryHandle,
      {} as never,
      ["140"],
      { metadataMode: "full" }
    );

    expect(index.positions).toEqual(["140"]);
    expect(index.crops.get("140")?.length).toBe(3);
    expect(openMock).toHaveBeenCalledTimes(3);
  });
});
