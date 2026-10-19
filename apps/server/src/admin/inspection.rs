//! Session-authorized, read-only inspection. Secret values never enter the selected projection.
use super::{Error, no_store};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    middleware,
    routing::get,
};
use nahhasio_catalog::redaction::{protected, scrub};
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
fn quote(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}
async fn metadata(pool: &PgPool) -> Result<Vec<Table>, Error> {
    let mut connection = pool.acquire().await?;
    let tables = nahhasio_catalog::schema::load(&mut connection)
        .await
        .map_err(|_| Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر قراءة تعريف الجداول."))?;
    Ok(tables
        .into_iter()
        .map(|table| {
            let columns = table
                .columns
                .into_iter()
                .map(|column| {
                    let hidden = protected(&table.name, &column.name);
                    Column {
                        name: column.name,
                        data_type: column.data_type,
                        nullable: column.nullable,
                        primary: column.primary,
                        generated: column.generated,
                        default_value: if hidden { None } else { column.default_value },
                        enum_values: column.enum_values,
                        protected: hidden,
                    }
                })
                .collect();
            Table {
                name: table.name,
                columns,
            }
        })
        .collect())
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
