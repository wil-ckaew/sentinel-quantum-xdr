use argon2::{
    password_hash::{
        PasswordHash,
        PasswordHasher,
        PasswordVerifier,
        SaltString,
        rand_core::OsRng,
    },
    Argon2,
};

pub fn hash_password(
    password: &str,
) -> anyhow::Result<String> {

    let salt = SaltString::generate(
        &mut OsRng
    );

    let hash = Argon2::default()
        .hash_password(
            password.as_bytes(),
            &salt,
        )?
        .to_string();

    Ok(hash)
}

pub fn verify_password(
    password: &str,
    hash: &str,
) -> bool {

    let parsed = match PasswordHash::new(hash) {
        Ok(value) => value,
        Err(_) => return false,
    };

    Argon2::default()
        .verify_password(
            password.as_bytes(),
            &parsed,
        )
        .is_ok()
}
