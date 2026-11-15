//! Canonical UUID-shaped resource identifiers accepted by client routes.

pub fn valid_id(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_case_and_uuid_version_compatibility() {
        for id in [
            "00112233-4455-6677-8899-aabbccddeeff",
            "00112233-4455-6677-8899-AABBCCDDEEFF",
            "00000000-0000-0000-0000-000000000000",
        ] {
            assert!(valid_id(id), "{id}");
        }
    }

    #[test]
    fn rejects_noncanonical_identifiers_and_route_escapes() {
        for id in [
            "",
            "../../etc/passwd",
            "00112233445566778899aabbccddeeff",
            "00112233-4455-6677-8899-aabbccddeef/",
            "00112233-4455-6677-8899-aabbccddeefg",
            "00112233-4455-6677-8899-aabbccddeeff?",
            "００１１２２３３-4455-6677-8899-aabbccddeeff",
        ] {
            assert!(!valid_id(id), "{id}");
        }
    }
}
