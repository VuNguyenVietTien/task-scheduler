//! Static import bundle (manifest) schema and canonicalization.
//!
//! A manifest is a fully static, source-checked snapshot of one Redmine
//! subtree (or a synthetic stand-in for tests). The importer NEVER scrapes,
//! replays browser sessions, or derives data from anything but this file, so
//! dry runs are deterministic and write-free by construction.
//!
//! Decimal policy: effort crosses the manifest boundary as STRINGS parsed
//! into [`rust_decimal::Decimal`] (design doc §7.1/§14 — no floats for
//! schedule truth).

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Manifest format version. Bump on breaking shape changes.
pub const MANIFEST_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImportManifest {
    pub manifest_version: u32,
    pub source_system: String,
    #[serde(default)]
    pub project_name: Option<String>,
    pub root: RootNode,
    #[serde(default)]
    pub headings: Vec<HeadingNode>,
    #[serde(default)]
    pub persons: Vec<PersonNode>,
    #[serde(default)]
    pub aliases: Vec<AliasNode>,
    pub tasks: Vec<TaskNode>,
    #[serde(default)]
    pub dependencies: Vec<DependencyEdge>,
}

/// Source root (issue 1115): metadata only, never a task.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RootNode {
    pub external_id: String,
    pub tracker: String,
    pub title: String,
}

/// Source `tracker-Phase` heading: display/WBS metadata only, never a task,
/// phase, assignment, dependency endpoint, or capacity object.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HeadingNode {
    pub external_id: String,
    pub tracker: String,
    pub title: String,
    pub position: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PersonNode {
    pub external_id: String,
    pub display_name: String,
}

/// Approved alias → person mapping. Aliases are exact, unique, and never
/// inferred from titles alone.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AliasNode {
    pub alias: String,
    pub person_external_id: String,
}

/// What a task's source parent IS in the source system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ParentKind {
    /// Directly under the source root → WBS metadata, no task parent.
    Root,
    /// Under a `tracker-Phase` heading → WBS metadata, no task parent.
    Heading,
    /// Under another real task → becomes `parent_task_id` on apply.
    Task,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskNode {
    pub external_id: String,
    pub tracker: String,
    pub title: String,
    /// Source workflow label — mapped to an immutable phase key by config.
    pub workflow: String,
    /// Exact effort in hours (two decimals), serialized as a string.
    pub effort_hours: String,
    /// Person external id, approved alias, or bare display name
    /// (name-only → placeholder; ambiguity blocks).
    #[serde(default)]
    pub assignee: Option<String>,
    /// 1-based position in the source WBS listing.
    #[serde(default)]
    pub wbs_row: i64,
    #[serde(default)]
    pub parent_kind: Option<ParentKind>,
    #[serde(default)]
    pub parent_external_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DependencyEdge {
    /// Predecessor (finish) task external id.
    pub from_external_id: String,
    /// Successor (start) task external id.
    pub to_external_id: String,
}

impl TaskNode {
    /// Parse the exact effort decimal; malformed input is a hard error.
    pub fn effort(&self) -> Result<Decimal, String> {
        Decimal::from_str_exact(self.effort_hours.trim())
            .map_err(|e| format!("task {}: invalid effort {:?}: {e}", self.external_id, self.effort_hours))
    }
}

/* ------------------------------- loading ------------------------------- */

#[derive(Debug)]
pub enum ManifestError {
    Io(std::io::Error),
    Json(serde_json::Error),
    UnsupportedVersion { found: u32, expected: u32 },
}

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManifestError::Io(e) => write!(f, "manifest unreadable: {e}"),
            ManifestError::Json(e) => write!(f, "manifest is not valid JSON: {e}"),
            ManifestError::UnsupportedVersion { found, expected } => write!(
                f,
                "manifest version {found} unsupported (expected {expected})"
            ),
        }
    }
}

impl std::error::Error for ManifestError {}

/// Parse and version-check a manifest from raw JSON text.
pub fn load_manifest_from_str(raw: &str) -> Result<ImportManifest, ManifestError> {
    let manifest: ImportManifest = serde_json::from_str(raw).map_err(ManifestError::Json)?;
    if manifest.manifest_version != MANIFEST_VERSION {
        return Err(ManifestError::UnsupportedVersion {
            found: manifest.manifest_version,
            expected: MANIFEST_VERSION,
        });
    }
    Ok(manifest)
}

/// Load a manifest from a file path (accepts string-ish paths).
pub fn load_manifest_from_path(path: impl AsRef<std::path::Path>) -> Result<ImportManifest, ManifestError> {
    let raw = std::fs::read_to_string(path.as_ref()).map_err(ManifestError::Io)?;
    load_manifest_from_str(&raw)
}

/* ---------------------------- canonical digest ---------------------------- */

/// SHA-256 of the manifest's canonical JSON serialization — the
/// `external_import_runs.snapshot_sha256` value. Canonical = the manifest
/// re-serialized through serde with sorted map keys, so semantically equal
/// bundles with different whitespace produce the same digest.
pub fn canonical_snapshot(manifest: &ImportManifest) -> String {
    let canonical = serde_json::to_vec(manifest).expect("manifest serializes");
    hex(&sha256(&canonical))
}

/// Minimal, dependency-free SHA-256 (FIPS 180-4). Kept local because the
/// backend must not grow a new crate dependency for one digest.
pub fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut message = data.to_vec();
    message.push(0x80);
    while message.len() % 64 != 56 {
        message.push(0);
    }
    message.extend_from_slice(&bit_len.to_be_bytes());

    let mut w = [0u32; 64];
    for block in message.chunks_exact(64) {
        for (i, word) in w.iter_mut().take(16).enumerate() {
            *word = u32::from_be_bytes([
                block[i * 4],
                block[i * 4 + 1],
                block[i * 4 + 2],
                block[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_matches_reference_vectors() {
        // FIPS 180-4 / NIST vectors.
        assert_eq!(
            hex(&sha256(b"")),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hex(&sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn canonical_snapshot_is_stable_across_whitespace_changes() {
        let raw = r#"{"manifest_version":1,"source_system":"redmine","root":{"external_id":"1115","tracker":"root","title":"Detailed Design"},"tasks":[]}"#;
        let spaced = raw.replace(',', ", ");
        let a = load_manifest_from_str(raw).unwrap();
        let b = load_manifest_from_str(&spaced).unwrap();
        assert_eq!(canonical_snapshot(&a), canonical_snapshot(&b));
    }

    #[test]
    fn unsupported_versions_are_refused() {
        let raw = r#"{"manifest_version":99,"source_system":"x","root":{"external_id":"1","tracker":"root","title":"t"},"tasks":[]}"#;
        assert!(matches!(
            load_manifest_from_str(raw),
            Err(ManifestError::UnsupportedVersion { found: 99, expected: 1 })
        ));
    }

    #[test]
    fn effort_parses_exactly() {
        let task = TaskNode {
            external_id: "1".into(),
            tracker: "Task".into(),
            title: "t".into(),
            workflow: "Create".into(),
            effort_hours: "40.00".into(),
            assignee: None,
            wbs_row: 5,
            parent_kind: Some(ParentKind::Heading),
            parent_external_id: Some("3001".into()),
        };
        assert_eq!(task.effort().unwrap(), Decimal::new(4000, 2));
        let bad = TaskNode { effort_hours: "4.0.0".into(), ..task };
        assert!(bad.effort().is_err());
    }
}
