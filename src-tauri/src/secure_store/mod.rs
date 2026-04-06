use keyring::Entry;

use crate::models::AppError;

pub const SERVICE_NAME: &str = "GitRoast";
pub const KEY_ALIAS: &str = "gemini-api-key";

fn entry() -> Result<Entry, AppError> {
    Entry::new(SERVICE_NAME, KEY_ALIAS).map_err(|error| AppError::Provider(error.to_string()))
}

pub fn store_api_key(api_key: &str) -> Result<(), AppError> {
    entry()?
        .set_password(api_key)
        .map_err(|error| AppError::Provider(error.to_string()))
}

pub fn read_api_key() -> Result<String, AppError> {
    entry()?
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => AppError::MissingApiKey,
            _ => AppError::Provider(error.to_string()),
        })
}

pub fn has_api_key() -> Result<bool, AppError> {
    match read_api_key() {
        Ok(_) => Ok(true),
        Err(AppError::MissingApiKey) => Ok(false),
        Err(error) => Err(error),
    }
}
