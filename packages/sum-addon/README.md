# @mupattern/sum-addon

Native addon (Rust/napi-rs) for fast Uint16Array summation. Used by mustudio expression analyze.

## Prerequisites

- [Rust](https://rustup.rs/) (for building)
- **Windows**: Visual Studio Build Tools with "Desktop development with C++" (for `link.exe`)

## Build

```bash
bun run build
# or
napi build --release --platform
```

Builds `.node` binaries for the current platform. From mustudio root, run `bun run build:addon` before a full build.
