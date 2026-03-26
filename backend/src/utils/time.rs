use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::ops::{Deref, DerefMut};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct FixedTime(DateTime<Utc>);

pub trait ToFixedOffset {
    fn to_fixed_offset(&self) -> FixedTime;
}

impl ToFixedOffset for DateTime<Utc> {
    fn to_fixed_offset(&self) -> FixedTime {
        FixedTime(*self)
    }
}

impl From<FixedTime> for DateTime<Utc> {
    fn from(time: FixedTime) -> Self {
        time.0
    }
}

impl From<DateTime<Utc>> for FixedTime {
    fn from(time: DateTime<Utc>) -> Self {
        Self(time)
    }
}

impl Deref for FixedTime {
    type Target = DateTime<Utc>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for FixedTime {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_fixed_time() {
        let now = Utc::now();
        let fixed = now.to_fixed_offset();
        
        assert_eq!(fixed.timestamp(), now.timestamp());
        
        let later = now + Duration::hours(1);
        let fixed_later = later.to_fixed_offset();
        
        assert!(fixed_later > fixed);

        // Test conversions
        let dt: DateTime<Utc> = fixed.into();
        assert_eq!(dt.timestamp(), now.timestamp());

        let fixed_back: FixedTime = dt.into();
        assert_eq!(fixed_back.timestamp(), now.timestamp());
    }
}