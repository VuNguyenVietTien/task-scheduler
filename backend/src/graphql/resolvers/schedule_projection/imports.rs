//! Bin-tree shim: mounts the PURE import modules (manifest schema +
//! issue-1115 dry-run validator) inside the schedule_projection resolver
//! tree so the GraphQL query works in BOTH the lib crate and the binary's
//! own module tree (`src/main.rs` declares its modules directly and has no
//! `mod imports;` — and `main.rs` is outside task-1.3 ownership).
//! The files stay single-sourced at `src/imports/**`; this shim only adds a
//! second compilation path for them, which is safe because both modules are
//! pure (no DB, no clocks, no side effects).

#[path = "../../../imports/manifest.rs"]
pub mod manifest;

#[path = "../../../imports/issue_1115.rs"]
pub mod issue_1115;
