#![deny(clippy::all)]

use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub fn sum_uint16_array(array: Uint16Array) -> u64 {
    array.iter().map(|&x| x as u64).sum()
}
