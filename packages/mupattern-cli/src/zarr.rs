use std::path::Path;
use std::sync::Arc;
use zarrs::array::{Array, ArrayBuilder};
use zarrs::storage::ReadableWritableListableStorage;
use zarrs::filesystem::FilesystemStore;

pub type Store = Arc<FilesystemStore>;

pub fn open_store(root: &Path) -> Result<Store, Box<dyn std::error::Error>> {
    let store = FilesystemStore::new(root)?;
    Ok(Arc::new(store))
}

pub fn open_array(
    store: &Store,
    path: &str,
) -> Result<Array<Arc<dyn ReadableWritableListableStorage>>, Box<dyn std::error::Error>> {
    let store_trait: Arc<dyn ReadableWritableListableStorage> = store.clone();
    let array = Array::open(store_trait, path)?;
    Ok(array)
}

pub fn read_chunk_u16(
    array: &Array<impl zarrs::storage::ReadableStorageTraits>,
    chunk_indices: &[u64],
) -> Result<Vec<u16>, Box<dyn std::error::Error>> {
    let data = array.retrieve_chunk_elements::<u16>(chunk_indices)?;
    Ok(data)
}

pub fn read_chunk_f64(
    array: &Array<impl zarrs::storage::ReadableStorageTraits>,
    chunk_indices: &[u64],
) -> Result<Vec<f64>, Box<dyn std::error::Error>> {
    let data = array.retrieve_chunk_elements::<f64>(chunk_indices)?;
    Ok(data)
}

pub fn create_array_u16(
    store: &Store,
    path: &str,
    shape: Vec<u64>,
    chunk_shape: Vec<u64>,
) -> Result<Array<Arc<dyn ReadableWritableListableStorage>>, Box<dyn std::error::Error>> {
    use zarrs::array::data_type;
    let store_trait: Arc<dyn ReadableWritableListableStorage> = store.clone();
    let array = ArrayBuilder::new(
        shape.clone(),
        chunk_shape.clone(),
        data_type::uint16(),
        0u16,
    )
    .build(store_trait, path)?;
    array.store_metadata()?;
    Ok(array)
}

pub fn write_chunk_u16(
    array: &Array<impl zarrs::storage::WritableStorageTraits>,
    chunk_indices: &[u64],
    data: &[u16],
) -> Result<(), Box<dyn std::error::Error>> {
    array.store_chunk_elements(chunk_indices, data)?;
    Ok(())
}
