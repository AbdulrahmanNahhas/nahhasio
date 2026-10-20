//! Shared editor services. The caller owns authorization and the transaction boundary.
mod assets;
mod entities;
mod providers;
mod references;
mod storage;
mod tickets;
pub mod work;

use crate::{Result, invalid};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{AssertSqlSafe, PgConnection, types::Json};
use std::{collections::BTreeMap, sync::OnceLock};

pub fn handles(operation: &str) -> bool {
    operation.starts_with("asset")
        || matches!(
            operation,
            "ingest" | "upload" | "preview" | "search" | "season" | "episodeImages"
        )
        || operation.starts_with("entity")
        || matches!(
            operation,
            "read"
                | "review"
                | "save"
                | "create"
                | "parse"
                | "links"
                | "refs"
                | "schema"
                | "vocabulary"
                | "media"
        )
}
pub fn writes(operation: &str) -> bool {
    matches!(
        operation,
        "assetAssign"
            | "assetUnlink"
            | "assetDelete"
            | "assetRename"
            | "ingest"
            | "upload"
            | "entitySave"
            | "entityRoleCreate"
            | "entityBulkDelete"
            | "entityJsonSave"
            | "entityJsonReview"
            | "review"
            | "save"
            | "create"
    )
}

/// No external schema resolution is enabled. Schemas are generated from the existing contracts.
pub fn validate(operation: &str, mut value: Value) -> Result<Value> {
    static SCHEMAS: OnceLock<Value> = OnceLock::new();
    static VALIDATORS: OnceLock<BTreeMap<String, jsonschema::Validator>> = OnceLock::new();
    let schemas = SCHEMAS.get_or_init(|| {
        serde_json::from_str(include_str!("contracts.json")).expect("generated contracts")
    });
    let validators = VALIDATORS.get_or_init(|| {
        schemas
            .as_object()
            .expect("schema map")
            .iter()
            .map(|(name, schema)| {
                (
                    name.clone(),
                    jsonschema::options()
                        .should_validate_formats(true)
                        .build(schema)
                        .expect("generated input schema"),
                )
            })
            .collect()
    });
    let schema = schemas
        .get(operation)
        .ok_or_else(|| invalid("Unknown editor operation"))?;
    defaults(schema, &mut value);
    known_fields(schema, &value)?;
    let validator = validators
        .get(operation)
        .ok_or_else(|| invalid("Unknown editor operation"))?;
    if let Some(error) = validator.iter_errors(&value).next() {
        // Include only the field path: schema errors can otherwise echo private values.
        return Err(invalid(format!(
            "Invalid editor field: {}",
            error.instance_path()
        )));
    }
    Ok(value)
}
fn known_fields(schema: &Value, value: &Value) -> Result<()> {
    if let (Some(properties), Some(object)) = (schema["properties"].as_object(), value.as_object())
    {
        for (key, value) in object {
            let field = properties
                .get(key)
                .ok_or_else(|| invalid(format!("Unknown editor field: {key}")))?;
            known_fields(field, value)?;
            if matches!(key.as_str(), "languages" | "dubLanguages") {
                unique(array(value).iter().map(Value::to_string))?;
            }
        }
    }
    if let Some(items) = value.as_array() {
        for item in items {
            known_fields(&schema["items"], item)?;
        }
    }
    Ok(())
}
fn defaults(schema: &Value, value: &mut Value) {
    if let (Some(properties), Some(object)) =
        (schema["properties"].as_object(), value.as_object_mut())
    {
        for (key, field) in properties {
            if !object.contains_key(key)
                && let Some(default) = field.get("default")
            {
                object.insert(key.clone(), default.clone());
            }
            if let Some(child) = object.get_mut(key) {
                defaults(field, child);
            }
        }
    }
    if let Some(items) = value.as_array_mut() {
        for item in items {
            defaults(&schema["items"], item);
        }
    }
}
pub async fn execute(
    connection: &mut PgConnection,
    operation: &str,
    data: Value,
    actor: &str,
    secret: &[u8],
) -> Result<Value> {
    let data = validate(operation, data)?;
    if array(&data["ids"]).len() > 5000 {
        return Err(invalid(
            "Selection exceeds 5000 records; narrow the filters",
        ));
    }

    if operation.starts_with("asset") {
        assets::execute(connection, operation, &data, actor).await
    } else if matches!(operation, "ingest" | "upload" | "preview") {
        storage::execute(connection, operation, &data, actor).await
    } else if matches!(operation, "search" | "season" | "episodeImages") {
        providers::execute(operation, &data).await
    } else if operation.starts_with("entity") {
        entities::execute(connection, operation, &data, actor, secret).await
    } else if matches!(operation, "refs" | "schema" | "vocabulary" | "media") {
        references::execute(connection, operation, &data).await
    } else {
        work::execute(connection, operation, &data, actor, secret).await
    }
}
pub(super) fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().unwrap_or("")
}
pub(super) fn array(value: &Value) -> &[Value] {
    value.as_array().map(Vec::as_slice).unwrap_or(&[])
}
pub(super) fn fingerprint(value: &Value) -> String {
    hex::encode(Sha256::digest(
        serde_json::to_vec(value).expect("JSON value"),
    ))
}
pub(super) fn unique(values: impl IntoIterator<Item = String>) -> Result<()> {
    let mut seen = std::collections::BTreeSet::new();
    for value in values {
        if !seen.insert(value) {
            return Err(invalid("توجد سجلات أو قيم مكررة في المسودة."));
        }
    }
    Ok(())
}
// Queries are private Rust templates. Dynamic identifiers are fixed allowlists or quoted
// catalog metadata; all caller-supplied values bind as a single JSON parameter.
pub(super) async fn rows(
    conn: &mut PgConnection,
    query: &str,
    params: Value,
) -> Result<Vec<Value>> {
    Ok(
        sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query.to_owned()))
            .bind(Json(params))
            .fetch_all(conn)
            .await?
            .into_iter()
            .map(|v| v.0)
            .collect(),
    )
}
pub(super) async fn one(conn: &mut PgConnection, query: &str, params: Value) -> Result<Value> {
    rows(conn, query, params)
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| invalid("السجل المرتبط لم يعد موجوداً."))
}
pub(super) async fn exec(conn: &mut PgConnection, query: &str, params: Value) -> Result<()> {
    sqlx::query(AssertSqlSafe(query.to_owned()))
        .bind(Json(params))
        .execute(conn)
        .await?;
    Ok(())
}
pub(super) async fn revision(
    conn: &mut PgConnection,
    actor: &str,
    id: &str,
    action: &str,
    before: Value,
    after: Value,
) -> Result<()> {
    let params = json!({"actor":actor,"id":id,"action":action,"before":before,"after":after});
    exec(conn, "insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(nullif($1->>'actor','')::uuid,'admin.entity.'||($1->>'action'),'entities',$1->>'id','Entity editor',jsonb_build_object('before',$1->'before','after',$1->'after'))", params.clone()).await?;
    exec(conn, "insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select nullif($1->>'actor','')::uuid,'entities',$1->>'id',coalesce(max(revision),0)+1,$1->>'action','Entity editor',case when $1->>'action'='delete' then $1->'before' else $1->'after' end,jsonb_build_object('before',$1->'before','after',$1->'after') from editorial_revisions where entity_type='entities' and entity_id=$1->>'id'", params).await
}

/// Inspect full foreign keys, including composite ownership keys whose ON DELETE CASCADE
/// would otherwise silently erase downloads or viewing history during episode removal.
async fn dependencies(
    c: &mut PgConnection,
    target: &str,
    id: &str,
    excluded: &[&str],
) -> Result<Value> {
    let keys=rows(c,"select jsonb_build_object('table',child.relname,'columns',jsonb_agg(jsonb_build_object('source',src.attname,'target',dst.attname) order by k.ordinality)) from pg_constraint f join pg_class child on child.oid=f.conrelid join pg_namespace ns on ns.oid=child.relnamespace cross join lateral unnest(f.conkey,f.confkey) with ordinality k(source,target,ordinality) join pg_attribute src on src.attrelid=f.conrelid and src.attnum=k.source join pg_attribute dst on dst.attrelid=f.confrelid and dst.attnum=k.target where f.contype='f' and f.confrelid=to_regclass('public.'||($1->>'target')) and ns.nspname='public' group by f.oid,child.relname",json!({"target":target})).await?;
    let mut tables: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for key in keys {
        let table = text(&key, "table");
        if excluded.contains(&table) {
            continue;
        }
        let joins = array(&key["columns"])
            .iter()
            .map(|pair| {
                Ok(format!(
                    "child.{}=parent.{}",
                    crate::schema::quote(text(pair, "source"))?,
                    crate::schema::quote(text(pair, "target"))?
                ))
            })
            .collect::<Result<Vec<_>>>()?
            .join(" and ");
        tables
            .entry(table.to_owned())
            .or_default()
            .push(format!("({joins})"));
    }
    let mut result = vec![];
    for (table, joins) in tables {
        let count=one(c,&format!("select to_jsonb(count(*)) from public.{} child where exists(select 1 from public.{} parent where parent.id=($1->>'id')::uuid and ({}))",crate::schema::quote(&table)?,crate::schema::quote(target)?,joins.join(" or ")),json!({"id":id})).await?;
        if count.as_u64().unwrap_or(0) > 0 {
            result.push(json!({"table":table,"count":count}));
        }
    }
    let count=one(c,"select to_jsonb(count(*)) from source_evidence where entity_id=$1->>'id' and entity_type in($1->>'target',rtrim($1->>'target','s'))",json!({"id":id,"target":target})).await?;
    if count.as_u64().unwrap_or(0) > 0 {
        result.push(json!({"table":"source_evidence","count":count}));
    }
    Ok(json!(result))
}

/// Local operator artwork convenience: shares the exact server registration and guards.
pub async fn upload_file(
    c: &mut PgConnection,
    path: &std::path::Path,
    role: &str,
    name: &str,
    actor: &str,
) -> Result<Value> {
    use base64::Engine;
    use std::io::Read;
    let mut bytes = vec![];
    std::fs::File::open(path)?
        .take(10 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    let mime = storage::detect(&bytes)?;
    let input = json!({"dataUrl":format!("data:{mime};base64,{}",base64::engine::general_purpose::STANDARD.encode(&bytes)),"fileName":path.file_name().and_then(|s|s.to_str()).unwrap_or("image"),"role":role,"ownerName":name});
    execute(c, "upload", input, actor, &[]).await
}

/// Input discovery for trusted local tools; no database or provider access.
pub fn input_schema(operation: Option<&str>) -> Result<Value> {
    let schemas: Value = serde_json::from_str(include_str!("contracts.json"))?;
    match operation {
        Some(name) => schemas
            .get(name)
            .cloned()
            .ok_or_else(|| invalid("Unknown editor operation")),
        None => Ok(schemas),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn generated_contracts_preserve_defaults_and_reject_unknown_fields() {
        let list = validate("entityList", json!({"kind":"person"})).unwrap();
        assert_eq!(list["page"], 1);
        assert_eq!(list["sort"], "works");
        assert!(
            validate(
                "workDocument",
                json!({"canonicalTitle":"Fixture","unknown":true})
            )
            .is_err()
        );
        assert!(
            validate(
                "workDocument",
                json!({"canonicalTitle":"Fixture","installments":[{"title":"Part","unknown":true}]})
            )
            .is_err()
        );
        assert!(
            validate(
                "workDocument",
                json!({"canonicalTitle":"Fixture","dubLanguages":["ar","ar"]})
            )
            .is_err()
        );
        assert!(validate("entityDetail", json!({"id":"not-a-uuid","kind":"person"})).is_err());
        let error = validate(
            "entityDetail",
            json!({"id":"private-value","kind":"person"}),
        )
        .unwrap_err()
        .to_string();
        assert!(!error.contains("private-value"));
    }
}
