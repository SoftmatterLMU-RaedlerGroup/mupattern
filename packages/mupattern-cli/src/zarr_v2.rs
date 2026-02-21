// Manual Zarr v2 write for compatibility with existing crops.zarr (Node zarrita).
// Uses .zarray metadata and dot-separated chunk keys.

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct ZarrayMeta {
    zarr_format: u32,
    shape: Vec<u64>,
    chunks: Vec<u64>,
    dtype: String,
    compressor: Option<()>,
    fill_value: Option<serde_json::Value>,
    order: String,
}

#[derive(Serialize)]
struct CropZattrs {
    axis_names: [&'static str; 5],
    bbox: BboxAttrs,
}

#[derive(Serialize)]
struct BboxAttrs {
    x: u32,
    y: u32,
    w: u32,
    h: u32,
}

pub fn write_array_u16(
    root: &Path,
    array_path: &str,
    shape: Vec<u64>,
    chunks: Vec<u64>,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = root.join(array_path);
    fs::create_dir_all(&dir)?;
    let meta = ZarrayMeta {
        zarr_format: 2,
        shape,
        chunks: chunks.clone(),
        dtype: "<u2".to_string(),
        compressor: None,
        fill_value: None,
        order: "C".to_string(),
    };
    let json = serde_json::to_string(&meta)?;
    fs::write(dir.join(".zarray"), json)?;
    Ok(())
}

pub fn write_crop_zattrs(
    root: &Path,
    array_path: &str,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = root.join(array_path);
    let attrs = CropZattrs {
        axis_names: ["t", "c", "z", "y", "x"],
        bbox: BboxAttrs { x, y, w, h },
    };
    let json = serde_json::to_string(&attrs)?;
    fs::write(dir.join(".zattrs"), json)?;
    Ok(())
}

pub fn write_background_zattrs(root: &Path, array_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    #[derive(Serialize)]
    struct BgZattrs {
        axis_names: [&'static str; 3],
        description: &'static str,
    }
    let dir = root.join(array_path);
    let attrs = BgZattrs {
        axis_names: ["t", "c", "z"],
        description: "Median of pixels outside all crop bounding boxes",
    };
    let json = serde_json::to_string(&attrs)?;
    fs::write(dir.join(".zattrs"), json)?;
    Ok(())
}

pub fn write_array_f64(
    root: &Path,
    array_path: &str,
    shape: Vec<u64>,
    chunks: Vec<u64>,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = root.join(array_path);
    fs::create_dir_all(&dir)?;
    let meta = ZarrayMeta {
        zarr_format: 2,
        shape,
        chunks: chunks.clone(),
        dtype: "<f8".to_string(),
        compressor: None,
        fill_value: None,
        order: "C".to_string(),
    };
    let json = serde_json::to_string(&meta)?;
    fs::write(dir.join(".zarray"), json)?;
    Ok(())
}

pub fn write_chunk_u16(
    root: &Path,
    array_path: &str,
    chunk_key: &str,
    data: &[u16],
) -> Result<(), Box<dyn std::error::Error>> {
    let path = root.join(array_path).join(chunk_key);
    let bytes: Vec<u8> = data
        .iter()
        .flat_map(|v| v.to_le_bytes())
        .collect();
    fs::write(path, bytes)?;
    Ok(())
}

pub fn write_chunk_f64(
    root: &Path,
    array_path: &str,
    chunk_key: &str,
    value: f64,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = root.join(array_path).join(chunk_key);
    fs::write(path, value.to_le_bytes())?;
    Ok(())
}
