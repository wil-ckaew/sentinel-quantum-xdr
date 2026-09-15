use anyhow::Result;

use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash,
        PasswordHasher,
        PasswordVerifier,
        SaltString,
    },
    Argon2,
};

pub fn hash_password(
    password: &str,
) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);

    let hash = Argon2::default()
        .hash_password(
            password.as_bytes(),
            &salt,
        )
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .to_string();

    Ok(hash)
}

pub fn verify_password(
    password: &str,
    hash: &str,
) -> Result<bool> {
    let parsed_hash =
        PasswordHash::new(hash)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    Ok(
        Argon2::default()
            .verify_password(
                password.as_bytes(),
                &parsed_hash,
            )
            .is_ok(),
    )
}
