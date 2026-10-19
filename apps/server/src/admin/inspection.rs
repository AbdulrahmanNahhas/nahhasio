//! Session-authorized, read-only inspection. Secret values never enter the selected projection.
use super::{Error, no_store};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Column {
    name: String,
    data_type: String,
    nullable: bool,
    primary: bool,
    generated: bool,
    default_value: Option<String>,
    enum_values: Vec<String>,
    protected: bool,
}
#[derive(Deserialize, Serialize)]
struct Table {
    name: String,
    columns: Vec<Column>,
}
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Page {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
}

pub(super) fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/admin/database/schema", get(schema))
        .route("/api/v1/admin/database/{table}", get(rows))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(middleware::from_fn(no_store))
        .with_state(pool)
}
fn protected(table: &str, column: &str) -> bool {
    match table {
        "auth_users" => ![
            "id",
            "name",
            "email",
            "email_verified",
            "username",
            "display_username",
            "role",
            "banned",
            "ban_expires",
            "created_at",
            "updated_at",
        ]
        .contains(&column),
        "auth_accounts" => {
            !["id", "user_id", "provider_id", "created_at", "updated_at"].contains(&column)
        }
        "auth_sessions" => ![
            "id",
            "user_id",
            "device_id",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        .contains(&column),
        "auth_verifications" => !["id", "expires_at", "created_at", "updated_at"].contains(&column),
        _ => secret_key(column),
    }
}
fn secret_key(key: &str) -> bool {
    let key = key
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase();
    key.contains("password")
        || key.contains("secret")
        || key.contains("token")
        || key.contains("credential")
        || key.contains("sessionkey")
        || key.contains("apikey")
        || key.contains("privatekey")
}
fn scrub(value: &mut Value, depth: usize) {
    if depth > 24 {
        *value = json!("[value too deeply nested]");
        return;
    }
    match value {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if secret_key(key) {
                    *value = json!("[protected]");
                } else {
                    scrub(value, depth + 1);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                scrub(item, depth + 1);
            }
        }
        Value::String(text) if text.contains("://") || text.starts_with("magnet:") => {
            // Tracker passkeys, signed URLs and embedded connection credentials stay server-side.
            if let Some(index) = text.find('?') {
                text.truncate(index);
                text.push_str("?[protected parameters]");
            }
            if text.contains('@') || text.starts_with("postgres") {
                *text = "[protected connection]".into();
            }
        }
        _ => {}
    }
}
fn quote(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}
async fn metadata(pool: &PgPool) -> Result<Vec<Table>, Error> {
    let records=sqlx::query_scalar::<_,SqlJson<Value>>(r#"select jsonb_build_object('name',t.table_name,'columns',(
        select jsonb_agg(jsonb_build_object('name',c.column_name,'dataType',c.udt_name,'nullable',c.is_nullable='YES',
        'primary',exists(select 1 from information_schema.key_column_usage k join information_schema.table_constraints x using(constraint_catalog,constraint_schema,constraint_name) where k.table_schema='public' and k.table_name=t.table_name and k.column_name=c.column_name and x.constraint_type='PRIMARY KEY'),
        'generated',coalesce(c.is_generated<>'NEVER',false),'defaultValue',c.column_default,
        'enumValues',coalesce((select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e join pg_type p on p.oid=e.enumtypid where p.typname=c.udt_name),'[]'::jsonb),'protected',false)
        order by c.ordinal_position) from information_schema.columns c where c.table_schema='public' and c.table_name=t.table_name))
        from information_schema.tables t where t.table_schema='public' and t.table_type='BASE TABLE' order by t.table_name"#)
        .fetch_all(pool).await?;
    records
        .into_iter()
        .map(|record| {
            let mut table: Table = serde_json::from_value(record.0).map_err(|_| {
                Error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "تعذّر قراءة تعريف الجداول.",
                )
            })?;
            for column in &mut table.columns {
                column.protected = protected(&table.name, &column.name);
                if column.protected {
                    column.default_value = None;
                }
            }
            Ok(table)
        })
        .collect()
}
async fn schema(State(pool): State<PgPool>) -> Result<Json<Value>, Error> {
    Ok(Json(json!({"tables":metadata(&pool).await?})))
}
async fn rows(
    State(pool): State<PgPool>,
    Path(name): Path<String>,
    Query(input): Query<Page>,
) -> Result<Json<Value>, Error> {
    let page = input.page.unwrap_or(1);
    let size = input.page_size.unwrap_or(25);
    let q = input.q.unwrap_or_default();
    if !(1..=100000).contains(&page) || !(1..=50).contains(&size) || q.chars().count() > 200 {
        return Err(Error(StatusCode::BAD_REQUEST, "مرشحات الجدول غير صالحة."));
    }
    let table = metadata(&pool)
        .await?
        .into_iter()
        .find(|table| table.name == name)
        .ok_or(Error(StatusCode::NOT_FOUND, "الجدول غير متاح."))?;
    let fields=table.columns.iter().map(|column| {
        let name=quote(&column.name);
        let value=if column.protected { "to_jsonb('[protected]'::text)".into() } else { format!("case when octet_length(to_jsonb(t.{name})::text)>262144 then jsonb_build_object('_truncated',true,'bytes',octet_length(to_jsonb(t.{name})::text)) else to_jsonb(t.{name}) end") };
        format!("'{}',{value}",column.name.replace('\'',"''"))
    }).collect::<Vec<_>>().join(",");
    let search = table
        .columns
        .iter()
        .filter(|column| {
            !column.protected && ["text", "varchar", "uuid"].contains(&column.data_type.as_str())
        })
        .map(|column| {
            format!(
                "strpos(lower(coalesce(t.{}::text,'')),lower($1))>0",
                quote(&column.name)
            )
        })
        .collect::<Vec<_>>()
        .join(" or ");
    let search = if search.is_empty() {
        "$1=''".to_owned()
    } else {
        format!("($1='' or {search})")
    };
    let order = table
        .columns
        .iter()
        .filter(|column| column.primary)
        .map(|column| format!("t.{}", quote(&column.name)))
        .collect::<Vec<_>>();
    let order = if order.is_empty() {
        "t.ctid".into()
    } else {
        order.join(",")
    };
    let query = format!(
        "select jsonb_build_object('table',$4::text,'page',$5::bigint,'pageSize',$2::bigint,'total',(select count(*) from public.{table} t where {search}),'rows',coalesce((select jsonb_agg(item order by ordinal) from (select jsonb_build_object({fields}) item,row_number() over(order by {order}) ordinal from public.{table} t where {search} order by {order} limit $2 offset $3) p),'[]'::jsonb))",
        table = quote(&table.name)
    );
    let mut tx = pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    sqlx::query("SET LOCAL statement_timeout = '5s'")
        .execute(&mut *tx)
        .await?;
    let mut result = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(q)
        .bind(size)
        .bind((page - 1) * size)
        .bind(name)
        .bind(page)
        .fetch_one(&mut *tx)
        .await?
        .0;
    tx.commit().await?;
    scrub(&mut result, 0);
    Ok(Json(result))
}
