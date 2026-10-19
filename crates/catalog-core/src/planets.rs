//! Planet definition and work-membership services shared by the API and operator tooling.
//! Caller owns a transaction and must authorize/lock the actor before mutation.
use crate::{Error, Result, invalid, schema};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{AssertSqlSafe, PgConnection, types::Json};
use std::collections::BTreeSet;

const WORK: &str = "jsonb_build_object('id',t.id,'title',coalesce(nullif(t.title_ar,''),t.canonical_title),'englishTitle',t.canonical_title,'year',t.release_year,'posterId',(select a.asset_id from media_asset_assignments a where a.title_id=t.id and a.role='poster' order by a.is_primary desc,a.id limit 1),'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name_ar,'icon',p.icon,'rank',m.featured_rank) order by p.id) from title_planets m join planets p on p.id=m.planet_id where m.title_id=t.id),'[]'::jsonb))";
const WORK_FILTER: &str = "($1::uuid is null and not exists(select 1 from title_planets m where m.title_id=t.id) or $1::uuid is not null and exists(select 1 from title_planets m where m.title_id=t.id and m.planet_id=$1::uuid)) and ($2='' or strpos(lower(concat_ws(' ',t.canonical_title,t.title_ar)),lower($2))>0 or exists(select 1 from title_aliases a where a.title_id=t.id and strpos(lower(a.title),lower($2))>0))";

#[derive(Deserialize)]
#[serde(tag = "operation", content = "data", deny_unknown_fields)]
pub enum Request {
    #[serde(rename = "planetDetail")]
    Detail(Id),
    #[serde(rename = "planetSave")]
    Save(Save),
    #[serde(rename = "planetDelete")]
    Delete(Delete),
    #[serde(rename = "planetOptions")]
    Options(Empty),
    #[serde(rename = "planetWorks")]
    Works(Works),
    #[serde(rename = "planetMove")]
    Move(Move),
}
impl Request {
    pub fn handles(operation: &str) -> bool {
        matches!(
            operation,
            "planetDetail"
                | "planetSave"
                | "planetDelete"
                | "planetOptions"
                | "planetWorks"
                | "planetMove"
        )
    }
    pub fn writes(&self) -> bool {
        matches!(self, Self::Save(_) | Self::Delete(_) | Self::Move(_))
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Empty {}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Id {
    id: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Save {
    #[serde(deserialize_with = "nullable")]
    id: Option<String>,
    #[serde(deserialize_with = "nullable")]
    revision: Option<String>,
    draft: Draft,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Delete {
    id: String,
    revision: String,
    confirmation: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Works {
    #[serde(deserialize_with = "nullable")]
    source: Option<String>,
    #[serde(default)]
    q: String,
    #[serde(default = "first_page")]
    page: u32,
}
fn first_page() -> u32 {
    1
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Move {
    #[serde(deserialize_with = "nullable")]
    source: Option<String>,
    #[serde(deserialize_with = "nullable")]
    destination: Option<String>,
    records: Vec<Original>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Original {
    id: String,
    revision: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Draft {
    slug: String,
    name: String,
    #[serde(deserialize_with = "nullable")]
    english_name: Option<String>,
    icon: String,
    description: String,
    primary_color: String,
    secondary_color: String,
    display_order: u32,
    active: bool,
}
fn nullable<'de, D, T>(deserializer: D) -> std::result::Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}
fn uuid(value: &str) -> Result<()> {
    if value.len() != 36
        || !value.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(invalid("معرّف غير صالح."));
    }
    Ok(())
}
fn revision(value: &Value) -> String {
    hex::encode(Sha256::digest(
        serde_json::to_vec(value).expect("JSON value"),
    ))
}
fn conflict(message: &str) -> Error {
    Error::Conflict(message.into())
}
fn bounded(value: &str, max: usize) -> bool {
    value.encode_utf16().count() <= max
}
impl Draft {
    fn validate(&mut self) -> Result<()> {
        self.slug = self.slug.trim().into();
        self.name = self.name.trim().into();
        self.icon = self.icon.trim().into();
        self.english_name = self
            .english_name
            .as_ref()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());
        let color = |value: &str| {
            value.len() == 7
                && value.starts_with('#')
                && value.bytes().skip(1).all(|c| c.is_ascii_hexdigit())
        };
        if self.slug.is_empty()
            || self.slug.len() > 80
            || !self.slug.bytes().enumerate().all(|(i, c)| {
                c.is_ascii_lowercase() || (i > 0 && (c.is_ascii_digit() || c == b'-'))
            })
            || self.name.is_empty()
            || !bounded(&self.name, 300)
            || self
                .english_name
                .as_ref()
                .is_some_and(|value| !bounded(value, 300))
            || self.icon.is_empty()
            || !bounded(&self.icon, 64)
            || !bounded(&self.description, 20000)
            || !color(&self.primary_color)
            || !color(&self.secondary_color)
            || self.display_order > 1_000_000
        {
            return Err(invalid("تعريف الكوكب غير صالح."));
        }
        Ok(())
    }
}

async fn definition(connection: &mut PgConnection, id: &str) -> Result<Value> {
    uuid(id)?;
    let row=sqlx::query_scalar::<_,Json<Value>>("select jsonb_build_object('draft',jsonb_build_object('slug',slug,'name',name_ar,'englishName',name_en,'icon',icon,'description',description,'primaryColor',primary_color,'secondaryColor',secondary_color,'displayOrder',display_order,'active',is_active),'updatedAt',updated_at::text) from planets where id=$1::uuid")
        .bind(id).fetch_optional(connection).await?.ok_or_else(||conflict("الكوكب لم يعد موجوداً."))?.0;
    Ok(json!({"id":id,"draft":row["draft"],"revision":revision(&row)}))
}

async fn dependencies(connection: &mut PgConnection, id: &str) -> Result<Value> {
    let mut links = Vec::new();
    for table in schema::load(connection).await? {
        let columns = table.columns.iter().filter(|column| {
            column.references_table.as_deref() == Some("planets")
                && column.references_column.as_deref() == Some("id")
        });
        let mut conditions = Vec::new();
        for column in columns {
            conditions.push(format!("{}=$1::uuid", schema::quote(&column.name)?));
        }
        if conditions.is_empty() {
            continue;
        }
        let query = format!(
            "select count(*) from {} where {}",
            table.source()?,
            conditions.join(" or ")
        );
        let count = sqlx::query_scalar::<_, i64>(AssertSqlSafe(query))
            .bind(id)
            .fetch_one(&mut *connection)
            .await?;
        if count > 0 {
            links.push(json!({"table":table.name,"count":count}));
        }
    }
    let count=sqlx::query_scalar::<_,i64>("select count(*) from source_evidence where entity_id=$1 and entity_type in ('planet','planets')").bind(id).fetch_one(connection).await?;
    if count > 0 {
        links.push(json!({"table":"source_evidence","count":count}));
    }
    Ok(json!(links))
}

async fn record(
    connection: &mut PgConnection,
    actor: &str,
    id: &str,
    entity: &str,
    action: &str,
    snapshot: &Value,
    changes: &Value,
) -> Result<()> {
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values($1::uuid,$2,$3,$4,'Planet editor',$5)")
        .bind(actor).bind(format!("admin.planet.{action}")).bind(if entity=="title_planets" {"titles"}else {entity}).bind(id).bind(Json(changes)).execute(&mut *connection).await?;
    sqlx::query("insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select $1::uuid,$2,$3,coalesce(max(revision),0)+1,$4,'Planet editor',$5,$6 from editorial_revisions where entity_type=$2 and entity_id=$3")
        .bind(actor).bind(entity).bind(id).bind(action).bind(Json(snapshot)).bind(Json(changes)).execute(connection).await?;
    Ok(())
}

fn decode_work(row: Value) -> Result<Value> {
    let mut value = row["value"]
        .as_object()
        .cloned()
        .ok_or_else(|| invalid("invalid work projection"))?;
    value.insert("revision".into(), json!(revision(&row)));
    Ok(Value::Object(value))
}
async fn work(connection: &mut PgConnection, id: &str) -> Result<Value> {
    uuid(id)?;
    let query = format!(
        "select jsonb_build_object('value',{WORK},'updatedAt',t.updated_at::text) from titles t where t.id=$1::uuid"
    );
    let row = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query))
        .bind(id)
        .fetch_optional(connection)
        .await?
        .ok_or_else(|| conflict("أحد الأعمال لم يعد موجوداً؛ أعد تحميل الاختيار."))?;
    decode_work(row.0)
}

/// Run reads in a repeatable-read read-only transaction; writes in serializable read-write.
/// The API must lock/revalidate the admin session before passing its actor account ID.
pub async fn execute(
    connection: &mut PgConnection,
    request: Request,
    actor: Option<&str>,
) -> Result<Value> {
    if request.writes() && actor.is_none() {
        return Err(invalid("an authorized actor is required"));
    }
    match request {
        Request::Detail(input) => {
            let mut value = definition(connection, &input.id).await?;
            value["links"] = dependencies(connection, &input.id).await?;
            Ok(value)
        }
        Request::Options(_) => {
            let rows=sqlx::query_scalar::<_,Json<Value>>("select jsonb_build_object('id',p.id,'name',p.name_ar,'englishName',p.name_en,'icon',p.icon,'description',p.description,'active',p.is_active,'displayOrder',p.display_order,'count',(select count(*) from title_planets m where m.planet_id=p.id)) from planets p order by p.display_order,p.id limit 501").fetch_all(&mut *connection).await?;
            if rows.len() > 500 {
                return Err(invalid("عدد الكواكب يتجاوز حد هذه الواجهة."));
            }
            let count=sqlx::query_scalar::<_,i64>("select count(*) from titles t where not exists(select 1 from title_planets m where m.title_id=t.id)").fetch_one(connection).await?;
            Ok(
                json!({"planets":rows.into_iter().map(|row|row.0).collect::<Vec<_>>(),"unassigned":count}),
            )
        }
        Request::Works(input) => {
            if let Some(source) = &input.source {
                uuid(source)?;
            }
            if !(1..=100000).contains(&input.page) || !bounded(&input.q, 300) {
                return Err(invalid("مرشحات غير صالحة."));
            }
            let query = format!(
                "select jsonb_build_object('value',{WORK},'updatedAt',t.updated_at::text) from titles t where {WORK_FILTER} order by t.sort_title,t.id limit 24 offset $3"
            );
            let rows = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query))
                .bind(&input.source)
                .bind(&input.q)
                .bind(i64::from(input.page - 1) * 24)
                .fetch_all(&mut *connection)
                .await?;
            let items = rows
                .into_iter()
                .map(|row| decode_work(row.0))
                .collect::<Result<Vec<_>>>()?;
            let total = sqlx::query_scalar::<_, i64>(AssertSqlSafe(format!(
                "select count(*) from titles t where {WORK_FILTER}"
            )))
            .bind(input.source)
            .bind(input.q)
            .fetch_one(connection)
            .await?;
            Ok(json!({"items":items,"total":total}))
        }
        Request::Save(mut input) => {
            input.draft.validate()?;
            if input.id.is_some() != input.revision.is_some()
                || input
                    .revision
                    .as_ref()
                    .is_some_and(|value| value.len() != 64)
            {
                return Err(invalid("المراجعة الأصلية غير صالحة."));
            }
            sqlx::query("select pg_advisory_xact_lock(23103,712)")
                .execute(&mut *connection)
                .await?;
            let before = if let Some(id) = &input.id {
                uuid(id)?;
                sqlx::query("select id from planets where id=$1::uuid for update")
                    .bind(id)
                    .execute(&mut *connection)
                    .await?;
                let value = definition(connection, id).await?;
                if value["revision"].as_str() != input.revision.as_deref() {
                    return Err(conflict("تغيّر الكوكب؛ أعد تحميله قبل الحفظ."));
                }
                value
            } else {
                Value::Null
            };
            let duplicate=sqlx::query_scalar::<_,bool>("select exists(select 1 from planets where slug=$1 and ($2::uuid is null or id<>$2::uuid))").bind(&input.draft.slug).bind(&input.id).fetch_one(&mut *connection).await?;
            if duplicate {
                return Err(conflict("الرمز مستخدم لكوكب آخر. اختر رمزاً مختلفاً."));
            }
            let id = match input.id {
                Some(id) => id,
                None => {
                    sqlx::query_scalar::<_, String>("select gen_random_uuid()::text")
                        .fetch_one(&mut *connection)
                        .await?
                }
            };
            let draft = serde_json::to_value(input.draft)?;
            let values = json!({"id":id,"slug":draft["slug"],"name_ar":draft["name"],"name_en":draft["englishName"],"icon":draft["icon"],"description":draft["description"],"primary_color":draft["primaryColor"],"secondary_color":draft["secondaryColor"],"display_order":draft["displayOrder"],"is_active":draft["active"]});
            if before.is_null() {
                sqlx::query("insert into planets(id,slug,name_ar,name_en,icon,description,primary_color,secondary_color,display_order,is_active) select id,slug,name_ar,name_en,icon,description,primary_color,secondary_color,display_order,is_active from jsonb_populate_record(null::planets,$1::jsonb)").bind(Json(values)).execute(&mut *connection).await?;
            } else {
                sqlx::query("update planets p set slug=v.slug,name_ar=v.name_ar,name_en=v.name_en,icon=v.icon,description=v.description,primary_color=v.primary_color,secondary_color=v.secondary_color,display_order=v.display_order,is_active=v.is_active,updated_at=clock_timestamp() from jsonb_populate_record(null::planets,$1::jsonb) v where p.id=v.id").bind(Json(values)).execute(&mut *connection).await?;
            }
            let after = definition(connection, &id).await?;
            record(
                connection,
                actor.expect("authorized actor"),
                &id,
                "planets",
                if before.is_null() { "create" } else { "update" },
                &after,
                &json!({"before":before,"after":after}),
            )
            .await?;
            Ok(json!({"id":id,"created":before.is_null()}))
        }
        Request::Delete(input) => {
            uuid(&input.id)?;
            if !bounded(&input.confirmation, 80) || input.revision.len() != 64 {
                return Err(invalid("تأكيد الحذف غير صالح."));
            }
            sqlx::query("select id from planets where id=$1::uuid for update")
                .bind(&input.id)
                .execute(&mut *connection)
                .await?;
            let before = definition(connection, &input.id).await?;
            if before["revision"] != input.revision {
                return Err(conflict("تغيّر الكوكب؛ أعد مراجعة الحذف."));
            }
            if before["draft"]["slug"] != input.confirmation {
                return Err(invalid("اكتب رمز الكوكب لتأكيد الحذف."));
            }
            if !dependencies(connection, &input.id)
                .await?
                .as_array()
                .expect("dependency array")
                .is_empty()
            {
                return Err(conflict(
                    "الكوكب مرتبط بأعمال أو سياسات أو مراجع. انقل الأعمال أو عطّل الكوكب بدلاً من حذفه.",
                ));
            }
            record(
                connection,
                actor.expect("authorized actor"),
                &input.id,
                "planets",
                "delete",
                &before,
                &json!({"before":before,"after":null}),
            )
            .await?;
            sqlx::query("delete from planets where id=$1::uuid")
                .bind(input.id)
                .execute(connection)
                .await?;
            Ok(json!({"removed":true}))
        }
        Request::Move(mut input) => {
            input.source = input.source.map(|id| id.to_ascii_lowercase());
            input.destination = input.destination.map(|id| id.to_ascii_lowercase());
            for original in &mut input.records {
                original.id.make_ascii_lowercase();
            }
            if input.source == input.destination
                || input.records.is_empty()
                || input.records.len() > 50
            {
                return Err(invalid("اختر كوكباً آخر وأعمالاً صالحة للنقل."));
            }
            let mut ids = BTreeSet::new();
            for record in &input.records {
                uuid(&record.id)?;
                if record.revision.len() != 64 || !ids.insert(record.id.clone()) {
                    return Err(invalid(
                        "الاختيار يحتوي على أعمال مكررة أو مراجعة غير صالحة.",
                    ));
                }
            }
            sqlx::query(
                "select id from titles where id=any($1::text[]::uuid[]) order by id for update",
            )
            .bind(ids.into_iter().collect::<Vec<_>>())
            .execute(&mut *connection)
            .await?;
            let mut planets = [input.source.as_deref(), input.destination.as_deref()]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();
            planets.sort();
            for id in planets {
                uuid(id)?;
                let active = sqlx::query_scalar::<_, bool>(
                    "select is_active from planets where id=$1::uuid for share",
                )
                .bind(id)
                .fetch_optional(&mut *connection)
                .await?;
                if active.is_none()
                    || (input.destination.as_deref() == Some(id) && active != Some(true))
                {
                    return Err(conflict("الكوكب غير موجود أو الوجهة غير نشطة."));
                }
            }
            for original in &input.records {
                let before = work(connection, &original.id).await?;
                if before["revision"] != original.revision {
                    return Err(conflict("تغيّر أحد الأعمال؛ أعد تحميل الاختيار قبل النقل."));
                }
                let memberships = before["memberships"].as_array().expect("membership array");
                if match &input.source {
                    Some(id) => !memberships.iter().any(|value| value["id"] == *id),
                    None => !memberships.is_empty(),
                } {
                    return Err(conflict("تغيّر انتماء أحد الأعمال؛ أعد تحميل الاختيار."));
                }
                if let Some(source) = &input.source {
                    sqlx::query(
                        "delete from title_planets where title_id=$1::uuid and planet_id=$2::uuid",
                    )
                    .bind(&original.id)
                    .bind(source)
                    .execute(&mut *connection)
                    .await?;
                }
                if let Some(destination) = &input.destination {
                    sqlx::query("insert into title_planets(title_id,planet_id) values($1::uuid,$2::uuid) on conflict do nothing").bind(&original.id).bind(destination).execute(&mut *connection).await?;
                }
                sqlx::query("update titles set updated_at=clock_timestamp() where id=$1::uuid")
                    .bind(&original.id)
                    .execute(&mut *connection)
                    .await?;
                let after = work(connection, &original.id).await?;
                record(connection,actor.expect("authorized actor"),&original.id,"title_planets","move",&after["memberships"],&json!({"source":input.source,"destination":input.destination,"before":before["memberships"],"after":after["memberships"]})).await?;
            }
            Ok(json!({"moved":input.records.len()}))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn validates_drafts_and_rejects_unknown_fields() {
        let mut draft: Draft=serde_json::from_value(json!({"slug":" test-planet ","name":" اختبار ","englishName":"","icon":"🪐","description":"","primaryColor":"#808080","secondaryColor":"#303030","displayOrder":1,"active":true})).unwrap();
        assert!(draft.validate().is_ok());
        assert_eq!(draft.slug, "test-planet");
        assert_eq!(draft.english_name, None);
        draft.primary_color = "red".into();
        assert!(draft.validate().is_err());
        assert!(
            serde_json::from_value::<Request>(
                json!({"operation":"planetOptions","data":{"sql":"select 1"}})
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<Request>(
                json!({"operation":"planetSave","data":{"draft":{}}})
            )
            .is_err()
        );
        assert!(
            serde_json::from_value::<Request>(json!({"operation":"planetWorks","data":{}}))
                .is_err()
        );
        assert!(uuid("00000000-0000-4000-8000-000000000001").is_ok());
        assert!(uuid("not-a-uuid").is_err());
    }
}
