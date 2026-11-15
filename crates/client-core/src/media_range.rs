//! Single HTTP byte ranges for the native-only torrent gateway.
//! A seek reads verified pieces at its offset, not the whole preceding file.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ByteRange {
    pub offset: u64,
    pub length: u64,
    pub partial: bool,
}

impl ByteRange {
    pub fn content_range(self, file_length: u64) -> Option<String> {
        if !self.partial || self.length == 0 {
            return None;
        }
        Some(format!(
            "bytes {}-{}/{}",
            self.offset,
            self.offset + self.length - 1,
            file_length
        ))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Unsatisfiable;

pub fn parse(header: Option<&str>, file_length: u64) -> Result<ByteRange, Unsatisfiable> {
    let Some(header) = header else {
        return Ok(ByteRange {
            offset: 0,
            length: file_length,
            partial: false,
        });
    };
    if header.len() > 256 || file_length == 0 {
        return Err(Unsatisfiable);
    }
    let values = header.trim().strip_prefix("bytes=").ok_or(Unsatisfiable)?;
    let (first, last) = values.split_once('-').ok_or(Unsatisfiable)?;
    if first.is_empty() {
        let suffix = decimal(last)?;
        if suffix == 0 {
            return Err(Unsatisfiable);
        }
        let length = suffix.min(file_length);
        return Ok(ByteRange {
            offset: file_length - length,
            length,
            partial: true,
        });
    }
    let offset = decimal(first)?;
    if offset >= file_length {
        return Err(Unsatisfiable);
    }
    let last = if last.is_empty() {
        file_length - 1
    } else {
        decimal(last)?.min(file_length - 1)
    };
    if last < offset {
        return Err(Unsatisfiable);
    }
    Ok(ByteRange {
        offset,
        length: last - offset + 1,
        partial: true,
    })
}

fn decimal(value: &str) -> Result<u64, Unsatisfiable> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(Unsatisfiable);
    }
    value.parse().map_err(|_| Unsatisfiable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_closed_open_and_suffix_ranges() {
        assert_eq!(
            parse(Some("bytes=10-19"), 100),
            Ok(ByteRange {
                offset: 10,
                length: 10,
                partial: true
            })
        );
        assert_eq!(
            parse(Some("bytes=90-"), 100),
            Ok(ByteRange {
                offset: 90,
                length: 10,
                partial: true
            })
        );
        assert_eq!(
            parse(Some("bytes=-10"), 100),
            Ok(ByteRange {
                offset: 90,
                length: 10,
                partial: true
            })
        );
        assert_eq!(
            parse(Some("bytes=-1000"), 100),
            Ok(ByteRange {
                offset: 0,
                length: 100,
                partial: true
            })
        );
        assert_eq!(
            parse(Some("bytes=90-1000"), 100),
            Ok(ByteRange {
                offset: 90,
                length: 10,
                partial: true
            })
        );
    }

    #[test]
    fn rejects_multiple_malformed_and_unsatisfiable_ranges() {
        for header in [
            "bytes=0-1,3-4",
            "bytes=-0",
            "bytes=100-",
            "bytes=20-10",
            "bytes=+1-3",
            "bytes=0-18446744073709551616",
            "bytes=0--1",
            "items=0-3",
            "bytes=",
        ] {
            assert_eq!(parse(Some(header), 100), Err(Unsatisfiable), "{header}");
        }
        assert_eq!(parse(Some("bytes=0-0"), 0), Err(Unsatisfiable));
    }

    #[test]
    fn supports_empty_files_and_u64_boundary_without_overflow() {
        assert_eq!(
            parse(None, 0),
            Ok(ByteRange {
                offset: 0,
                length: 0,
                partial: false
            })
        );
        let range = parse(Some("bytes=0-"), u64::MAX).unwrap();
        assert_eq!(range.length, u64::MAX);
        assert_eq!(
            range.content_range(u64::MAX),
            Some(format!("bytes 0-{}/{}", u64::MAX - 1, u64::MAX))
        );
        let last = parse(Some("bytes=-1"), u64::MAX).unwrap();
        assert_eq!(last.offset, u64::MAX - 1);
        assert_eq!(last.length, 1);
        assert!(parse(None, 10).unwrap().content_range(10).is_none());
    }
}
