//! Explicit migration command with strict argument handling.
//!
//! - `cargo run --bin migrate` — apply the forward-only strategy
//!   (`migration_runner::run`): bootstrap empty DBs in dependency order,
//!   apply only pending migrations on existing history.
//! - `cargo run --bin migrate -- --baseline` — record ONLY the versions the
//!   validated schema actually represents WITHOUT executing (for databases
//!   whose schema pre-exists without `_sqlx_migrations` history; explicit
//!   operator decision).
//!
//! Unknown or misspelled arguments are REJECTED (non-zero exit) so a typo like
//! `--baselin` can never silently fall through to the normal migration path.
//! Never modifies applied migration files; sqlx checksum enforcement stays in
//! effect for every path.

use std::{env, error::Error, time::Duration};

use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;

/// What `bin/migrate` should do.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrateMode {
    /// Apply the forward-only strategy (bootstrap/forward).
    Apply,
    /// Validate the existing schema and baseline it (no execution).
    Baseline,
}

const USAGE: &str = "usage: migrate [--baseline]\n\
                     \x20 --baseline   validate the existing schema and mark the embedded\n\
                     \x20              versions it represents WITHOUT executing migrations\n\
                     \x20(no args)     apply the forward-only migration strategy";

/// Strict CLI parsing: exactly zero arguments (`Apply`) or exactly
/// `--baseline` (`Baseline`); anything else is an error.
fn parse_args(args: &[String]) -> Result<MigrateMode, String> {
    match args {
        [] => Ok(MigrateMode::Apply),
        [single] if single == "--baseline" => Ok(MigrateMode::Baseline),
        _ => Err(format!(
            "unknown or unexpected argument(s): {:?}\n{}",
            args, USAGE
        )),
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv().ok();

    let args: Vec<String> = env::args().skip(1).collect();
    let mode = match parse_args(&args) {
        Ok(mode) => mode,
        Err(message) => {
            // Argument errors print usage clearly and exit non-zero — never a
            // silent fallthrough into a different mode.
            eprintln!("migrate: {}", message);
            std::process::exit(2);
        }
    };

    let database_url =
        env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required to run migrations")?;

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&database_url)
        .await?;

    let outcome = match mode {
        MigrateMode::Baseline => task_scheduler_backend::migration_runner::baseline(&pool).await?,
        MigrateMode::Apply => task_scheduler_backend::migration_runner::run(&pool).await?,
    };

    let state = task_scheduler_backend::migration_runner::probe_state(&pool).await?;
    pool.close().await;

    let label = state.label();
    println!("migration outcome: {:?}", outcome);
    println!("migration state now: {:?} ({})", state, label);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn no_arguments_apply_baseline_flag_and_reject_everything_else() {
        assert_eq!(parse_args(&args(&[])), Ok(MigrateMode::Apply));
        assert_eq!(
            parse_args(&args(&["--baseline"])),
            Ok(MigrateMode::Baseline)
        );

        // Misspelled flag must be REJECTED, never fall through to Apply.
        assert!(parse_args(&args(&["--baselin"])).is_err());
        assert!(parse_args(&args(&["--BASELINE"])).is_err());
        assert!(parse_args(&args(&["baseline"])).is_err());
        // Unknown/extra arguments rejected.
        assert!(parse_args(&args(&["--force"])).is_err());
        assert!(parse_args(&args(&["--baseline", "--baseline"])).is_err());
        assert!(parse_args(&args(&["--baseline", "extra"])).is_err());
        // Error messages must be actionable.
        let err = parse_args(&args(&["--baselin"])).unwrap_err();
        assert!(err.contains("--baselin"), "{}", err);
        assert!(err.contains("usage:"), "{}", err);
    }
}
