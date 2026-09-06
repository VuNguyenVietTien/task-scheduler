//! Redmine import CLI (project scheduling & WBS, increment 1 / task 1.2).
//!
//! DRY RUN ONLY. Reads a static, source-controlled manifest file, validates
//! every issue-1115 hard gate (pure, deterministic, zero writes), and prints
//! the report as JSON. No database is opened in dry-run mode: the apply path
//! does not exist until increment 4, so the tool structurally cannot write.
//!
//! Usage:
//!   import_redmine --dry-run --input <manifest.json>
//!   import_redmine --apply ...        → REFUSED (increment 4)

use std::path::PathBuf;

use task_scheduler_backend::imports::{
    issue_1115::{self, DryRunReport},
    manifest,
};

const USAGE: &str = "usage: import_redmine --dry-run --input <manifest.json>\n\
                     \x20 --dry-run   validate the bundle against every issue-1115 gate (no writes)\n\
                     \x20 --input     path to the static source bundle (manifest JSON)\n\
                     \x20 --apply     not available until increment 4";

#[derive(Debug, PartialEq, Eq)]
enum CliMode {
    DryRun { input: PathBuf },
    Refused(&'static str),
}

/// Strict CLI parsing: exactly `--dry-run --input <path>`; unknown/missing
/// arguments and `--apply` are hard errors.
fn parse_args(args: &[String]) -> Result<CliMode, String> {
    let mut dry_run = false;
    let mut input: Option<PathBuf> = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--dry-run" => dry_run = true,
            "--input" => {
                i += 1;
                let Some(path) = args.get(i) else {
                    return Err(format!("--input requires a path\n{USAGE}"));
                };
                input = Some(PathBuf::from(path));
            }
            "--apply" => {
                return Ok(CliMode::Refused(
                    "--apply is not implemented: the transactional apply path lands in increment 4",
                ));
            }
            other => return Err(format!("unknown argument: {other}\n{USAGE}")),
        }
        i += 1;
    }
    match (dry_run, input) {
        (true, Some(path)) => Ok(CliMode::DryRun { input: path }),
        _ => Err(format!("--dry-run and --input are both required\n{USAGE}")),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match parse_args(&args) {
        Ok(CliMode::Refused(reason)) => {
            eprintln!("refused: {reason}");
            std::process::exit(2);
        }
        Ok(CliMode::DryRun { input }) => {
            let bundle = match manifest::load_manifest_from_path(&input) {
                Ok(bundle) => bundle,
                Err(e) => {
                    eprintln!("manifest error: {e}");
                    std::process::exit(2);
                }
            };
            // Pure validation: no pool, no async runtime, no writes.
            match issue_1115::dry_run(&bundle) {
                Ok(report) => {
                    print_report(&report);
                    println!("snapshot_sha256: {}", manifest::canonical_snapshot(&bundle));
                    println!("outcome: PASSED (dry run; zero writes)");
                }
                Err(e) => {
                    println!("outcome: FAILED");
                    println!("violations: {e}");
                    std::process::exit(1);
                }
            }
        }
        Err(usage) => {
            eprintln!("{usage}");
            std::process::exit(2);
        }
    }
}

fn print_report(report: &DryRunReport) {
    match serde_json::to_string_pretty(report) {
        Ok(json) => println!("{json}"),
        Err(e) => {
            eprintln!("report serialization failed: {e}");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_is_refused_and_reported_as_increment4() {
        let mode = parse_args(&["--apply".into(), "--input".into(), "x.json".into()])
            .expect("parse succeeds");
        assert!(matches!(mode, CliMode::Refused(_)));
    }

    #[test]
    fn dry_run_requires_both_flags_and_a_path() {
        assert!(parse_args(&[]).is_err());
        assert!(parse_args(&["--dry-run".into()]).is_err());
        assert!(parse_args(&["--input".into(), "x.json".into()]).is_err());
        assert!(matches!(
            parse_args(&["--dry-run".into(), "--input".into(), "x.json".into()]),
            Ok(CliMode::DryRun { .. })
        ));
    }

    #[test]
    fn unknown_arguments_are_rejected() {
        assert!(parse_args(&["--dry-run".into(), "--input".into(), "x.json".into(), "--baselin".into()]).is_err());
    }
}
