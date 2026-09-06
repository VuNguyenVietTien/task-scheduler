use chrono::Local;
use env_logger::Builder;
use log::LevelFilter;
use std::io::Write;

pub fn setup_logging() {
    Builder::new()
        .format(|buf, record| {
            writeln!(
                buf,
                "{} [{}] {}: {}",
                Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                record.target(),
                record.args()
            )
        })
        .filter(None, LevelFilter::Debug)
        .init();
}

pub fn log_db_query(query: &str, values: &[&dyn std::fmt::Debug]) {
    log::debug!("Executing query:\n{}\nwith values: {:?}", query, values);
}

pub fn log_db_result<T: std::fmt::Debug>(result: &T) {
    log::debug!("Query result:\n{:#?}", result);
}

pub fn log_error(error: &dyn std::error::Error) {
    log::error!("Error occurred: {}\nBacktrace: {:#?}", error, error);
}
