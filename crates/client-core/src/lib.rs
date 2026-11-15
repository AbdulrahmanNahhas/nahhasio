//! Client policies and models shared by native frontends.
//!
//! This crate does not discover OS directories, persist state, perform HTTP requests,
//! render a UI, or access the catalog database. Adapters supply those capabilities.

pub mod browse_preferences;
pub mod identifiers;
pub mod media_range;
pub mod playback;
pub mod server_address;
pub mod storage;

mod error;
pub use error::Error;
