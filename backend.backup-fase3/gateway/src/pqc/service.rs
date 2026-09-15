use rand::RngCore;

pub fn generate_pqc_keypair() -> (String, String) {
    let mut pub_bytes = [0u8; 32];
    let mut sec_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut pub_bytes);
    rand::thread_rng().fill_bytes(&mut sec_bytes);

    (hex::encode(pub_bytes), hex::encode(sec_bytes))
}

pub fn encrypt_pqc_payload(plaintext: &str, _pub_key: &str) -> String {
    let mut dummy_cipher = plaintext.as_bytes().to_vec();
    for byte in dummy_cipher.iter_mut() {
        *byte ^= 0xAA; // XOR estático para simular cifragem de envelope quântico
    }
    hex::encode(dummy_cipher)
}
