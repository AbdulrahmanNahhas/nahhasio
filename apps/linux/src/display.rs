//! Display formatting never changes catalog identity or stored episode numbers.
use std::sync::OnceLock;

pub fn episode_number(value: &str) -> &str {
    if let Some((_, fraction)) = value.split_once('.')
        && !fraction.is_empty()
        && fraction.bytes().all(|byte| byte.is_ascii_digit())
    {
        value.trim_end_matches('0').trim_end_matches('.')
    } else {
        value
    }
}

pub fn episode_title(value: &str) -> String {
    static EPISODE: OnceLock<regex::Regex> = OnceLock::new();
    let pattern = EPISODE.get_or_init(|| {
        regex::Regex::new(r"(الحلقة\s+)([0-9]+\.[0-9]+)").expect("static episode label pattern")
    });
    pattern
        .replace_all(value, |captures: &regex::Captures<'_>| {
            format!("{}{}", &captures[1], episode_number(&captures[2]))
        })
        .into_owned()
}
