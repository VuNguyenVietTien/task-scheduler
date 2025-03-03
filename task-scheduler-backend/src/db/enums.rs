use serde::{Deserialize, Serialize};
use strum_macros::EnumString;

#[derive(Debug, Clone, Serialize, Deserialize, EnumString, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectStatus {
    NotStarted,
    InProgress,
    OnHold,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, EnumString, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, EnumString, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ProjectVisibility {
    Private,
    Team,
    Public,
}

impl Default for ProjectStatus {
    fn default() -> Self {
        Self::NotStarted
    }
}

impl Default for ProjectPriority {
    fn default() -> Self {
        Self::Medium
    }
}

impl Default for ProjectVisibility {
    fn default() -> Self {
        Self::Private
    }
}

impl ToString for ProjectStatus {
    fn to_string(&self) -> String {
        serde_json::to_string(self)
            .unwrap()
            .trim_matches('"')
            .to_string()
    }
}

impl ToString for ProjectPriority {
    fn to_string(&self) -> String {
        serde_json::to_string(self)
            .unwrap()
            .trim_matches('"')
            .to_string()
    }
}

impl ToString for ProjectVisibility {
    fn to_string(&self) -> String {
        serde_json::to_string(self)
            .unwrap()
            .trim_matches('"')
            .to_string()
    }
}