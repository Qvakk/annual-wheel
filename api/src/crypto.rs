//! Cryptographic utilities for secure key generation
//!
//! Uses the same algorithms as the frontend for consistency.

use rand::Rng;

/// Generate a secure random key (64 hex characters = 256 bits)
/// Matches frontend: `generateShareKey()` in sharing.ts
pub fn generate_share_key() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();
    hex::encode(bytes)
}

/// Generate a short code for URLs (8 alphanumeric characters)
/// Matches frontend: `generateShortCode()` in sharing.ts
/// Excludes confusing characters: 0, O, I, l, 1
pub fn generate_short_code() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

/// Validate share key format (64 hex characters)
pub fn is_valid_share_key(key: &str) -> bool {
    key.len() == 64 && key.chars().all(|c| c.is_ascii_hexdigit())
}

/// Validate short code format (8 alphanumeric characters)
pub fn is_valid_short_code(code: &str) -> bool {
    code.len() == 8 && code.chars().all(|c| c.is_ascii_alphanumeric())
}

/// Constant-time string comparison to prevent timing attacks
pub fn secure_compare(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (x, y) in a.bytes().zip(b.bytes()) {
        result |= x ^ y;
    }
    result == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_share_key_generation() {
        let key = generate_share_key();
        assert_eq!(key.len(), 64);
        assert!(is_valid_share_key(&key));
    }
    
    #[test]
    fn test_short_code_generation() {
        let code = generate_short_code();
        assert_eq!(code.len(), 8);
        assert!(is_valid_short_code(&code));
        
        // Should not contain confusing characters
        assert!(!code.contains('0'));
        assert!(!code.contains('O'));
        assert!(!code.contains('I'));
        assert!(!code.contains('l'));
        assert!(!code.contains('1'));
    }
    
    #[test]
    fn test_secure_compare() {
        assert!(secure_compare("abc", "abc"));
        assert!(!secure_compare("abc", "abd"));
        assert!(!secure_compare("abc", "abcd"));
    }
    
    #[test]
    fn test_validation() {
        assert!(is_valid_share_key(&"a".repeat(64)));
        assert!(!is_valid_share_key(&"a".repeat(63)));
        assert!(!is_valid_share_key(&"g".repeat(64))); // 'g' is not hex
        
        assert!(is_valid_short_code("AbCd1234"));
        assert!(!is_valid_short_code("AbCd123")); // too short
        assert!(!is_valid_short_code("AbCd1234!")); // invalid char
    }
}
