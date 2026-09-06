//! Controlled Redmine import: manifest schema + issue-1115 dry-run
//! validation (project scheduling & WBS, increment 1 / task 1.2).
//!
//! STATUS: foundation only. The APPLY path does not exist until increment 4
//! (design doc §9.2); `dry_run` is pure and write-free by construction.

pub mod issue_1115;
pub mod manifest;

pub use issue_1115::{dry_run, DryRunReport, ImportValidationError};
pub use manifest::{ImportManifest, ManifestError};
