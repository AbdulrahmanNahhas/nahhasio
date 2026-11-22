//! Torrent discovery configured by the native client's environment.
use crate::{bridge::Error, torrent_addon};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Addon {
    name: String,
    url: String,
    config: Option<String>,
}

#[derive(Serialize)]
pub struct ProviderStatus {
    pub id: String,
    pub count: usize,
    pub error: Option<Error>,
}

#[derive(Default)]
pub struct Discovery {
    pub candidates: Vec<torrent_addon::Candidate>,
    pub providers: Vec<ProviderStatus>,
}

fn configuration_error() -> Error {
    Error::new(
        "source_config",
        "إعداد مزوّدي التورنت غير صالح. تحقق من NAHHASIO_TORRENT_ADDONS في بيئة العميل.",
    )
}

fn addons(value: &str) -> Result<Vec<Addon>, Error> {
    if value.trim().is_empty() {
        return Ok(Vec::new());
    }
    if value.len() > 16 * 1024 {
        return Err(configuration_error());
    }
    let addons: Vec<Addon> = serde_json::from_str(value).map_err(|_| configuration_error())?;
    if addons.len() > 2 {
        return Err(configuration_error());
    }
    let mut names = std::collections::BTreeSet::new();
    for addon in &addons {
        let name = &addon.name;
        if name.is_empty()
            || name.len() > 40
            || name.trim() != name
            || !name.chars().any(char::is_alphanumeric)
            || !name.chars().all(|character| {
                character.is_alphanumeric() || matches!(character, ' ' | '-' | '_')
            })
            || !names.insert(name.to_lowercase())
        {
            return Err(configuration_error());
        }
    }
    Ok(addons)
}

async fn search_one(input: torrent_addon::Search, addon: Addon) -> Discovery {
    let (candidates, error) =
        match torrent_addon::search_addon(input, &addon.url, addon.config.as_deref(), &addon.name)
            .await
        {
            Ok(candidates) => (candidates, None),
            Err(error) => (Vec::new(), Some(error)),
        };
    Discovery {
        providers: vec![ProviderStatus {
            id: addon.name,
            count: candidates.len(),
            error,
        }],
        candidates,
    }
}

pub async fn search(input: torrent_addon::Search) -> Result<Discovery, Error> {
    let value = match std::env::var("NAHHASIO_TORRENT_ADDONS") {
        Ok(value) => value,
        Err(std::env::VarError::NotPresent) => String::new(),
        Err(std::env::VarError::NotUnicode(_)) => return Err(configuration_error()),
    };
    let mut addons = addons(&value)?.into_iter();
    let Some(first) = addons.next() else {
        return Err(Error::new(
            "source_unconfigured",
            "لم يُضبط أي مزوّد تورنت. أضف المزوّدين إلى NAHHASIO_TORRENT_ADDONS في بيئة العميل.",
        ));
    };
    let Some(second) = addons.next() else {
        return Ok(search_one(input, first).await);
    };
    let (mut first, second) =
        tokio::join!(search_one(input.clone(), first), search_one(input, second));
    first.candidates.extend(second.candidates);
    first.providers.extend(second.providers);
    Ok(first)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn addon_configuration_accepts_zero_one_or_two_named_endpoints() {
        assert!(addons("").unwrap().is_empty());
        assert!(addons("[]").unwrap().is_empty());
        let one = addons(r#"[{"name":"One","url":"https://one.example"}]"#).unwrap();
        assert!(one[0].config.is_none());
        let two = addons(
            r#"[{"name":"One","url":"https://one.example"},{"name":"Two","url":"https://two.example","config":"private-fixture"}]"#,
        )
        .unwrap();
        assert_eq!(two.len(), 2);
        assert_eq!(two[1].config.as_deref(), Some("private-fixture"));
    }

    #[test]
    fn configuration_rejects_duplicates_urls_as_names_and_oversized_lists() {
        for input in [
            r#"[{"name":"One","url":"https://one.example"},{"name":"one","url":"https://two.example"}]"#,
            r#"[{"name":"https://one.example/token","url":"https://one.example"}]"#,
            r#"[{"name":"One","url":"https://one.example"},{"name":"Two","url":"https://two.example"},{"name":"Three","url":"https://three.example"}]"#,
        ] {
            let result = addons(input);
            assert!(result.is_err());
        }
    }
}
