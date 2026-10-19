use crate::{Result, invalid};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgConnection, types::Json};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub generated: bool,
    pub primary: bool,
    pub default_value: Option<String>,
    pub references_table: Option<String>,
    pub references_column: Option<String>,
    pub enum_values: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Table {
    pub name: String,
    pub columns: Vec<Column>,
}

/// Quote identifiers only after checking a deliberately narrow alphabet. Table and column
/// existence must additionally be checked against `load`; values always use bind parameters.
pub fn quote(value: &str) -> Result<String> {
    if value.is_empty()
        || !value
            .bytes()
            .enumerate()
            .all(|(i, c)| c == b'_' || c.is_ascii_lowercase() || (i > 0 && c.is_ascii_digit()))
    {
        return Err(invalid("invalid SQL identifier"));
    }
    Ok(format!("\"{value}\""))
}

impl Table {
    pub fn column(&self, name: &str) -> Result<&Column> {
        self.columns
            .iter()
            .find(|column| column.name == name)
            .ok_or_else(|| invalid(format!("unknown column in {}", self.name)))
    }

    pub fn key(&self) -> Result<&Column> {
        let keys: Vec<_> = self
            .columns
            .iter()
            .filter(|column| column.primary)
            .collect();
        if keys.len() != 1 {
            return Err(invalid(
                "use --where for a table without a single-column primary key",
            ));
        }
        Ok(keys[0])
    }

    pub fn source(&self) -> Result<String> {
        Ok(format!("public.{}", quote(&self.name)?))
    }

    pub fn reference_columns(&self) -> Vec<&str> {
        [
            "slug",
            "canonical_title",
            "title_ar",
            "sort_title",
            "name",
            "sort_name",
            "name_ar",
            "name_en",
            "title",
            "label_en",
            "label_ar",
            "display_name",
            "path",
        ]
        .into_iter()
        .filter(|name| self.columns.iter().any(|column| column.name == *name))
        .collect()
    }
}

pub async fn load(connection: &mut PgConnection) -> Result<Vec<Table>> {
    let rows = sqlx::query_scalar::<_, Json<Value>>(r#"
        select jsonb_build_object('name',t.table_name,'columns',(
          select jsonb_agg(jsonb_build_object(
            'name',c.column_name,'dataType',c.udt_name,'nullable',c.is_nullable='YES',
            'generated',c.is_generated='ALWAYS' or coalesce(c.identity_generation='ALWAYS',false),
            'defaultValue',c.column_default,
            'primary',exists(select 1 from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
              where i.indrelid=format('public.%I',t.table_name)::regclass and i.indisprimary and a.attname=c.column_name),
            'referencesTable',(select target.relname from pg_constraint f join pg_class target on target.oid=f.confrelid
              join pg_attribute a on a.attrelid=f.conrelid and a.attnum=f.conkey[1]
              where f.conrelid=format('public.%I',t.table_name)::regclass and f.contype='f' and cardinality(f.conkey)=1 and a.attname=c.column_name limit 1),
            'referencesColumn',(select b.attname from pg_constraint f
              join pg_attribute a on a.attrelid=f.conrelid and a.attnum=f.conkey[1]
              join pg_attribute b on b.attrelid=f.confrelid and b.attnum=f.confkey[1]
              where f.conrelid=format('public.%I',t.table_name)::regclass and f.contype='f' and cardinality(f.conkey)=1 and a.attname=c.column_name limit 1),
            'enumValues',coalesce((select jsonb_agg(e.enumlabel order by e.enumsortorder)
              from pg_enum e join pg_type p on p.oid=e.enumtypid join pg_namespace n on n.oid=p.typnamespace
              where n.nspname='public' and p.typname=c.udt_name),'[]'::jsonb)
          ) order by c.ordinal_position) from information_schema.columns c
          where c.table_schema='public' and c.table_name=t.table_name))
        from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE' order by t.table_name
    "#).fetch_all(connection).await?;
    rows.into_iter()
        .map(|row| Ok(serde_json::from_value(row.0)?))
        .collect()
}

/// Defaults for human-friendly command names. Unlisted tables remain discoverable by name.
pub fn resource(name: &str) -> (&str, Option<(&str, &str)>) {
    let table = match name {
        "title" | "work" => "titles",
        "alias" => "title_aliases",
        "installment" | "season" | "movie" | "film" | "special" => "installments",
        "episode" => "episodes",
        "score" => "installment_scores",
        "entity" | "person" | "studio" | "org" => "entities",
        "credit" | "contribution" => "contributions",
        "planet" | "universe" => "planets",
        "genre" => "genres",
        "tone" => "tones",
        "tag" => "tags",
        "country" => "countries",
        "role" => "roles",
        "relation" => "title_relations",
        "org-relation" => "organization_relations",
        "external-id" => "external_identities",
        "media-asset" | "asset" | "image" => "media_assets",
        "media-assignment" | "assignment" => "media_asset_assignments",
        "account" | "profile" => "accounts",
        "capability" => "account_capabilities",
        "preference" => "account_preferences",
        "content-policy" | "policy" => "account_content_policies",
        "review" => "title_reviews",
        "comment" => "title_comments",
        "collection" => "collections",
        "library" => "account_title_states",
        "audit" => "audit_logs",
        "revision" => "editorial_revisions",
        "job" => "background_jobs",
        "source" => "source_evidence",
        "invite" => "account_invites",
        "server" => "server_instance",
        "device" => "devices",
        "library-root" => "library_roots",
        "trailer" => "title_trailers",
        "media-file" => "media_files",
        "media-track" => "media_tracks",
        "playback" => "account_playback_states",
        "download" => "account_downloads",
        "jellyfin-server" => "jellyfin_servers",
        "jellyfin-item" => "jellyfin_items",
        "award" | "recognition" => "award_recognitions",
        "award-org" | "organization" => "award_organizations",
        "award-category" => "award_categories",
        "award-ceremony" | "ceremony" => "award_ceremonies",
        other => other,
    };
    let scope = match name {
        "person" => Some(("kind", "person")),
        "studio" | "org" => Some(("kind", "organization")),
        _ => None,
    };
    (table, scope)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn identifier_injection_is_rejected() {
        for value in [
            "",
            "1a",
            "public.titles",
            "x\"",
            "x;delete",
            "x y",
            "العنوان",
        ] {
            assert!(quote(value).is_err(), "{value}");
        }
        assert_eq!(quote("title_aliases").unwrap(), "\"title_aliases\"");
    }
}
