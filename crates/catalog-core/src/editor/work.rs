use super::*;
use crate::{Error, schema};

const TITLE: &[&str] = &[
    "canonicalTitle",
    "sortTitle",
    "titleAr",
    "summary",
    "contentWarnings",
    "analysisNotes",
    "curatorNotes",
    "releaseYear",
    "format",
    "isPrivate",
    "workflowStatus",
    "playbackPolicy",
    "dubLanguages",
    "dubbingNotes",
    "qualityScore",
    "audience",
    "age",
    "sexualityRisk",
    "behavioralRisk",
    "theologyRisk",
    "tmdbId",
    "imdbId",
    "anilistId",
    "malId",
];
const PART: &[&str] = &[
    "kind",
    "position",
    "title",
    "summary",
    "status",
    "releaseDate",
    "runtimeMinutes",
    "audienceOverride",
    "ageOverride",
    "sexualityRiskOverride",
    "behavioralRiskOverride",
    "theologyRiskOverride",
    "tmdbId",
    "imdbId",
    "anilistId",
    "malId",
];
const EPISODE: &[&str] = &[
    "number",
    "position",
    "title",
    "summary",
    "releaseDate",
    "runtimeMinutes",
];
const SCORE: &[&str] = &[
    "story",
    "characters",
    "depth",
    "worldBuilding",
    "originality",
    "craft",
];
fn snake(key: &str) -> String {
    let mut s = String::new();
    for c in key.chars() {
        if c.is_ascii_uppercase() {
            s.push('_');
            s.push(c.to_ascii_lowercase());
        } else {
            s.push(c);
        }
    }
    s
}
fn projection(alias: &str, keys: &[&str]) -> String {
    keys.iter()
        .map(|key| format!("'{key}',{alias}.{}", snake(key)))
        .collect::<Vec<_>>()
        .join(",")
}
async fn uuid(c: &mut PgConnection) -> Result<Value> {
    one(c, "select to_jsonb(gen_random_uuid())", Value::Null).await
}
async fn media(c: &mut PgConnection, column: &str, id: &str) -> Result<Value> {
    one(c,&format!("select coalesce(jsonb_object_agg(role,path),'{{}}') from(select x.role,a.path from media_asset_assignments x join media_assets a on a.id=x.asset_id where x.{}=($1->>'id')::uuid and x.is_primary order by x.role,x.id)s",schema::quote(column)?),json!({"id":id})).await
}
pub async fn export(c: &mut PgConnection, id: &str) -> Result<Value> {
    let p = json!({"id":id});
    let mut doc = one(
        c,
        &format!(
            "select jsonb_build_object('id',t.id,{}) from titles t where t.id=($1->>'id')::uuid",
            projection("t", TITLE)
        ),
        p.clone(),
    )
    .await?;
    for (key, sql) in [
        (
            "aliases",
            "select to_jsonb(title) from title_aliases where title_id=($1->>'id')::uuid order by title",
        ),
        (
            "trivia",
            "select to_jsonb(text) from title_trivia where title_id=($1->>'id')::uuid order by position",
        ),
        (
            "planets",
            "select to_jsonb(p.slug) from title_planets j join planets p on p.id=j.planet_id where j.title_id=($1->>'id')::uuid order by p.slug",
        ),
        (
            "credits",
            "select jsonb_build_object('entity',e.name,'role',r.slug,'languages',c.languages,'isPrimary',c.is_primary,'position',c.position) from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id where c.title_id=($1->>'id')::uuid order by c.position,c.entity_id,c.role_id",
        ),
        (
            "externalIds",
            "select jsonb_build_object('provider',provider,'externalId',external_id,'url',url) from external_identities where title_id=($1->>'id')::uuid order by provider,external_id,id",
        ),
        (
            "relations",
            "select jsonb_build_object('target',t.canonical_title,'kind',r.kind,'notes',r.notes) from title_relations r join titles t on t.id=r.target_title_id where r.source_title_id=($1->>'id')::uuid order by r.kind,r.target_title_id",
        ),
        (
            "trailers",
            "select jsonb_build_object('id',id,'youtubeVideoId',youtube_video_id,'title',title,'language',language,'isPrimary',is_primary,'position',position) from title_trailers where title_id=($1->>'id')::uuid order by position,id",
        ),
        (
            "awards",
            "select jsonb_build_object('id',a.id,'ceremonyId',a.ceremony_id,'position',a.position,'organization',a.organization_slug,'category',a.category,'year',a.year,'result',a.result,'installment',i.position,'isFeatured',a.is_featured,'sourceUrl',a.source_url,'notes',a.notes) from award_recognitions a left join installments i on i.id=a.installment_id where a.title_id=($1->>'id')::uuid order by a.position,a.id",
        ),
    ] {
        doc[key] = json!(rows(c, sql, p.clone()).await?);
    }
    for key in ["genres", "tones", "tags", "countries"] {
        doc[key]=json!(rows(c,&format!("select to_jsonb(g.slug) from title_{key} j join {key} g on g.id=j.value_id where j.title_id=($1->>'id')::uuid order by g.slug"),p.clone()).await?);
    }
    doc["media"] = media(c, "title_id", id).await?;
    let mut parts=rows(c,&format!("select jsonb_build_object('id',i.id,{}) from installments i where i.title_id=($1->>'id')::uuid order by i.position,i.id",projection("i",PART)),p).await?;
    for part in &mut parts {
        let id = text(part, "id").to_owned();
        let p = json!({"id":id});
        part["score"]=rows(c,&format!("select jsonb_build_object({}) from installment_scores s where installment_id=($1->>'id')::uuid",projection("s",SCORE)),p.clone()).await?.into_iter().next().unwrap_or_else(||json!(SCORE.iter().map(|k|(k.to_string(),Value::Null)).collect::<serde_json::Map<_,_>>()));
        part["media"] = media(c, "installment_id", &id).await?;
        let mut episodes=rows(c,&format!("select jsonb_build_object('id',e.id,{}) from episodes e where e.installment_id=($1->>'id')::uuid order by e.position,e.id",projection("e",EPISODE)),p).await?;
        for episode in &mut episodes {
            episode["media"] = media(c, "episode_id", text(episode, "id")).await?;
        }
        part["episodes"] = json!(episodes);
    }
    doc["installments"] = json!(parts);
    Ok(doc)
}
/// Only the field constants above and explicit foreign-key fields reach this helper.
async fn upsert(
    c: &mut PgConnection,
    table: &str,
    fields: &[&str],
    record: &Value,
    extra: Value,
) -> Result<Value> {
    let mut values = extra.as_object().cloned().unwrap_or_default();
    for key in fields {
        if let Some(value) = record.get(*key) {
            values.insert(snake(key), value.clone());
        }
    }
    let keys: Vec<_> = values
        .keys()
        .map(|k| schema::quote(k))
        .collect::<Result<_>>()?;
    let columns = keys.join(",");
    let source = keys
        .iter()
        .map(|k| format!("r.{k}"))
        .collect::<Vec<_>>()
        .join(",");
    let table = schema::quote(table)?;
    let update = keys
        .iter()
        .filter(|k| k.as_str() != "\"id\"")
        .map(|k| format!("{k}=excluded.{k}"))
        .collect::<Vec<_>>()
        .join(",");
    one(c,&format!("insert into {table} ({columns}) select {source} from jsonb_populate_record(null::{table},$1)r on conflict(id) do update set {update} returning to_jsonb(id)"),json!(values)).await
}
async fn resolve(
    c: &mut PgConnection,
    table: &str,
    value: &str,
    kind: Option<&str>,
) -> Result<Value> {
    let columns: &[&str] = match table {
        "genres" | "tones" | "tags" | "countries" | "roles" => &["slug", "label_en", "label_ar"],
        "planets" | "award_organizations" => &["slug", "name_ar", "name_en"],
        "entities" => &["name", "sort_name"],
        "titles" => &["canonical_title", "title_ar", "sort_title"],
        _ => return Err(invalid("Unknown reference table")),
    };
    let mut conditions = vec!["id::text=$1->>'value'".to_owned()];
    for column in columns {
        conditions.push(format!(
            "lower(btrim({}))=lower(btrim($1->>'value'))",
            schema::quote(column)?
        ));
    }
    if table == "entities" {
        conditions.push("exists(select 1 from entity_aliases a where a.entity_id=t.id and lower(btrim(a.alias))=lower(btrim($1->>'value')))".into());
    }
    if table == "titles" {
        conditions.push("exists(select 1 from title_aliases a where a.title_id=t.id and lower(btrim(a.title))=lower(btrim($1->>'value')))".into());
    }
    let kind_filter = if kind.is_some() {
        " and kind::text=$1->>'kind'"
    } else {
        ""
    };
    let matches = rows(
        c,
        &format!(
            "select to_jsonb(t) from {} t where ({}){kind_filter} limit 2",
            schema::quote(table)?,
            conditions.join(" or ")
        ),
        json!({"value":value,"kind":kind}),
    )
    .await?;
    if matches.len() != 1 {
        return Err(invalid(format!("Missing or ambiguous {table} reference")));
    }
    Ok(matches[0].clone())
}
async fn assign_media(c: &mut PgConnection, column: &str, id: &str, images: &Value) -> Result<()> {
    let Some(images) = images.as_object() else {
        return Ok(());
    };
    let column = schema::quote(column)?;
    for (role, path) in images {
        if !["poster", "banner", "profile", "logo", "still"].contains(&role.as_str()) {
            return Err(invalid("Unknown artwork role"));
        }
        let asset = if path.is_null() {
            Value::Null
        } else {
            one(c,"select to_jsonb(a.id) from media_assets a where a.path=$1->>'path' or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=$1->>'path') order by (a.path=$1->>'path') desc limit 1",json!({"path":path})).await?
        };
        let p = json!({"id":id,"role":role,"asset":asset});
        exec(c,&format!("update media_asset_assignments set is_primary=false,updated_at=now() where {column}=($1->>'id')::uuid and role::text=$1->>'role' and is_primary"),p.clone()).await?;
        if asset.is_null() {
            continue;
        }
        let assignments=rows(c,&format!("select to_jsonb(id) from media_asset_assignments where {column}=($1->>'id')::uuid and role::text=$1->>'role' and asset_id=($1->>'asset')::uuid order by id limit 1 for update"),p.clone()).await?;
        if let Some(id) = assignments.first() {
            exec(c,"update media_asset_assignments set is_primary=true,updated_at=now() where id=($1->>'id')::uuid",json!({"id":id})).await?;
        } else {
            exec(c,&format!("insert into media_asset_assignments({column},asset_id,role,is_primary) values(($1->>'id')::uuid,($1->>'asset')::uuid,($1->>'role')::media_asset_role,true)"),p).await?;
        }
    }
    Ok(())
}
fn preserve(current: &Value, patch: &Value) -> Value {
    match (current, patch) {
        (Value::Object(before), Value::Object(after)) => {
            let mut result = before.clone();
            for (key, value) in after {
                result.insert(key.clone(), preserve(&current[key], value));
            }
            json!(result)
        }
        (Value::Array(before), Value::Array(after)) => json!(
            after
                .iter()
                .map(|next| {
                    if let Some(old) = before
                        .iter()
                        .find(|old| next["id"].is_string() && old["id"] == next["id"])
                    {
                        preserve(old, next)
                    } else {
                        next.clone()
                    }
                })
                .collect::<Vec<_>>()
        ),
        _ => patch.clone(),
    }
}
async fn ownership(
    c: &mut PgConnection,
    table: &str,
    column: &str,
    parent: &str,
    record: &mut Value,
) -> Result<()> {
    if record.get("id").is_none() {
        record["id"] = uuid(c).await?;
        return Ok(());
    }
    let found = rows(
        c,
        &format!(
            "select to_jsonb({}) from {} where id=($1->>'id')::uuid",
            schema::quote(column)?,
            schema::quote(table)?
        ),
        record.clone(),
    )
    .await?;
    if found.first().is_some_and(|id| id != parent) {
        return Err(invalid("Child ID belongs to another parent"));
    }
    Ok(())
}
async fn prune(
    c: &mut PgConnection,
    table: &str,
    column: &str,
    parent: &str,
    ids: &[Value],
) -> Result<()> {
    exec(c,&format!("delete from {} where {}=($1->>'parent')::uuid and id not in(select value::uuid from jsonb_array_elements_text($1->'ids'))",schema::quote(table)?,schema::quote(column)?),json!({"parent":parent,"ids":ids})).await
}
async fn links(c: &mut PgConnection, id: &str) -> Result<Value> {
    super::dependencies(c, "episodes", id, &[]).await
}
async fn structure(c: &mut PgConnection, patch: &mut Value, before: &Value) -> Result<()> {
    for field in ["trailers", "awards"] {
        if let Some(records) = patch.get_mut(field).and_then(Value::as_array_mut) {
            for record in records {
                if record.get("id").is_some()
                    && !array(&before[field])
                        .iter()
                        .any(|old| old["id"] == record["id"])
                {
                    return Err(invalid("المعرّف لا ينتمي إلى هذا العمل."));
                }
                if record.get("id").is_none() {
                    record["id"] = uuid(c).await?;
                }
            }
        }
    }
    let Some(parts) = patch.get_mut("installments").and_then(Value::as_array_mut) else {
        return Ok(());
    };
    for part in parts.iter_mut() {
        let old = array(&before["installments"])
            .iter()
            .find(|old| old["id"] == part["id"] && part["id"].is_string())
            .cloned()
            .unwrap_or(Value::Null);
        if part.get("id").is_some() && old.is_null() {
            return Err(invalid(
                "معرّف جزء لا ينتمي إلى العمل. اترك المعرّف فارغاً للأجزاء الجديدة.",
            ));
        }
        if part.get("id").is_none() {
            part["id"] = uuid(c).await?;
        }
        if let Some(episodes) = part.get_mut("episodes").and_then(Value::as_array_mut) {
            for episode in episodes {
                if episode.get("id").is_some()
                    && !array(&old["episodes"])
                        .iter()
                        .any(|old| old["id"] == episode["id"])
                {
                    return Err(invalid("معرّف حلقة لا ينتمي إلى الجزء."));
                }
                if episode.get("id").is_none() {
                    episode["id"] = uuid(c).await?;
                }
            }
        }
    }
    unique(parts.iter().map(|p| p["id"].to_string()))?;
    for old in array(&before["installments"]) {
        if !parts.iter().any(|p| p["id"] == old["id"]) {
            return Err(invalid(
                "حذف الأجزاء يحتاج مراجعة مستقلة لحماية الحلقات وسجل المشاهدة. أعد الأجزاء المحذوفة إلى المسودة.",
            ));
        }
    }
    for key in ["tmdbId", "imdbId", "anilistId", "malId"] {
        unique(
            parts
                .iter()
                .filter_map(|p| p.get(key).filter(|v| !v.is_null()).map(Value::to_string)),
        )?;
    }
    Ok(())
}
/// Applies already-validated fields in one caller-owned serializable transaction.
/// Supplied lists replace their members; absent lists and scalar fields are preserved.
pub async fn apply(c: &mut PgConnection, patch: &Value, create: bool) -> Result<()> {
    let id = text(patch, "id");
    let p = json!({"id":id});
    let mut scalars = patch.clone();
    if scalars.get("sortTitle").is_none() && scalars.get("canonicalTitle").is_some() {
        scalars["sortTitle"] = json!(text(patch, "canonicalTitle").trim().to_lowercase());
    }
    if !create {
        one(
            c,
            "select to_jsonb(id) from titles where id=($1->>'id')::uuid for update",
            p.clone(),
        )
        .await?;
    }
    upsert(c, "titles", TITLE, &scalars, json!({"id":id})).await?;
    exec(
        c,
        "update titles set updated_at=now() where id=($1->>'id')::uuid",
        p.clone(),
    )
    .await?;
    for key in [
        "aliases",
        "trivia",
        "genres",
        "tones",
        "tags",
        "countries",
        "planets",
    ] {
        let Some(values) = patch.get(key) else {
            continue;
        };
        unique(array(values).iter().map(Value::to_string))?;
        if key == "aliases" {
            exec(c,"delete from title_aliases where title_id=($1->>'id')::uuid and title not in(select jsonb_array_elements_text($1->'values'))",json!({"id":id,"values":values})).await?;
            for value in array(values) {
                exec(c,"insert into title_aliases(title_id,title) select ($1->>'id')::uuid,$1->>'value' where not exists(select 1 from title_aliases where title_id=($1->>'id')::uuid and title=$1->>'value')",json!({"id":id,"value":value})).await?;
            }
        } else if key == "trivia" {
            for (index, value) in array(values).iter().enumerate() {
                exec(c,"insert into title_trivia(title_id,position,text) values(($1->>'id')::uuid,($1->>'position')::integer,$1->>'value') on conflict(title_id,position) do update set text=excluded.text",json!({"id":id,"position":index,"value":value})).await?;
            }
            exec(c,"delete from title_trivia where title_id=($1->>'id')::uuid and position>=($1->>'length')::integer",json!({"id":id,"length":array(values).len()})).await?;
        } else {
            let mut ids = vec![];
            for value in array(values) {
                ids.push(
                    resolve(
                        c,
                        key,
                        value.as_str().ok_or_else(|| invalid("Invalid reference"))?,
                        None,
                    )
                    .await?["id"]
                        .clone(),
                );
            }
            let (table, column) = if key == "planets" {
                ("title_planets".into(), "planet_id")
            } else {
                (format!("title_{key}"), "value_id")
            };
            exec(c,&format!("delete from {table} where title_id=($1->>'id')::uuid and {column} not in(select value::uuid from jsonb_array_elements_text($1->'ids'))"),json!({"id":id,"ids":ids})).await?;
            for value in ids {
                exec(c,&format!("insert into {table}(title_id,{column}) values(($1->>'id')::uuid,($1->>'value')::uuid) on conflict do nothing"),json!({"id":id,"value":value})).await?;
            }
        }
    }
    if let Some(credits) = patch.get("credits") {
        let mut tuples = vec![];
        for (index, credit) in array(credits).iter().enumerate() {
            let role = resolve(c, "roles", text(credit, "role"), None).await?;
            let entity = resolve(
                c,
                "entities",
                text(credit, "entity"),
                Some(text(&role, "entity_kind")),
            )
            .await?;
            let tuple = json!({"entity":entity["id"],"role":role["id"]});
            tuples.push(tuple);
            unique(array(&credit["languages"]).iter().map(Value::to_string))?;
            exec(c,"insert into contributions(title_id,entity_id,role_id,position,is_primary,languages) values(($1->>'id')::uuid,($1->>'entity')::uuid,($1->>'role')::uuid,($1->>'position')::integer,($1->>'primary')::boolean,array(select jsonb_array_elements_text($1->'languages'))) on conflict(title_id,entity_id,role_id) do update set position=excluded.position,is_primary=excluded.is_primary,languages=case when ($1->>'hasLanguages')::boolean then excluded.languages else contributions.languages end",json!({"id":id,"entity":entity["id"],"role":role["id"],"position":credit.get("position").cloned().unwrap_or(json!(index)),"primary":credit.get("isPrimary").cloned().unwrap_or(json!(false)),"languages":credit.get("languages").cloned().unwrap_or(json!([])),"hasLanguages":credit.get("languages").is_some()})).await?;
        }
        unique(tuples.iter().map(Value::to_string))?;
        exec(c,"delete from contributions where title_id=($1->>'id')::uuid and not exists(select 1 from jsonb_array_elements($1->'tuples')t where (t->>'entity')::uuid=entity_id and (t->>'role')::uuid=role_id)",json!({"id":id,"tuples":tuples})).await?;
    }
    if let Some(values) = patch.get("externalIds") {
        unique(array(values).iter().map(|v| {
            format!(
                "{}:{}",
                text(v, "provider").trim().to_lowercase(),
                text(v, "externalId")
            )
        }))?;
        exec(c,"delete from external_identities where title_id=($1->>'id')::uuid and installment_id is null and not exists(select 1 from jsonb_array_elements($1->'values')v where lower(btrim(v->>'provider'))=lower(btrim(provider)) and v->>'externalId'=external_id)",json!({"id":id,"values":values})).await?;
        for value in array(values) {
            exec(c,"insert into external_identities(title_id,provider,external_id,url) values(($1->>'id')::uuid,$1->'value'->>'provider',$1->'value'->>'externalId',$1->'value'->>'url') on conflict(coalesce(title_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(installment_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(provider)),external_id) do update set url=excluded.url",json!({"id":id,"value":value})).await?;
        }
    }
    if let Some(values) = patch.get("relations") {
        let mut tuples = vec![];
        for value in array(values) {
            let target = resolve(c, "titles", text(value, "target"), None).await?;
            if target["id"] == id {
                return Err(invalid("A work cannot relate to itself"));
            }
            tuples.push(json!({"target":target["id"],"kind":value["kind"]}));
            exec(c,"insert into title_relations(source_title_id,target_title_id,kind,notes) values(($1->>'id')::uuid,($1->>'target')::uuid,($1->'value'->>'kind')::title_relation_kind,coalesce($1->'value'->>'notes','')) on conflict(source_title_id,target_title_id,kind) do update set notes=excluded.notes",json!({"id":id,"target":target["id"],"value":value})).await?;
        }
        unique(tuples.iter().map(Value::to_string))?;
        exec(c,"delete from title_relations where source_title_id=($1->>'id')::uuid and not exists(select 1 from jsonb_array_elements($1->'tuples')t where (t->>'target')::uuid=target_title_id and t->>'kind'=kind::text)",json!({"id":id,"tuples":tuples})).await?;
    }
    if let Some(values) = patch.get("trailers") {
        unique(
            array(values)
                .iter()
                .map(|v| text(v, "youtubeVideoId").to_owned()),
        )?;
        if array(values)
            .iter()
            .filter(|v| v["isPrimary"] == true)
            .count()
            > 1
        {
            return Err(invalid("Choose one primary trailer"));
        }
        exec(
            c,
            "update title_trailers set is_primary=false where title_id=($1->>'id')::uuid",
            p.clone(),
        )
        .await?;
        let mut ids = vec![];
        for (index, value) in array(values).iter().enumerate() {
            let mut value = value.clone();
            ownership(c, "title_trailers", "title_id", id, &mut value).await?;
            let saved = upsert(
                c,
                "title_trailers",
                &[
                    "youtubeVideoId",
                    "title",
                    "language",
                    "isPrimary",
                    "position",
                ],
                &preserve(
                    &json!({"title":"","language":null,"isPrimary":false,"position":index}),
                    &value,
                ),
                json!({"id":value["id"],"title_id":id}),
            )
            .await?;
            ids.push(saved);
        }
        prune(c, "title_trailers", "title_id", id, &ids).await?;
    }
    assign_media(c, "title_id", id, &patch["media"]).await?;
    if let Some(values) = patch.get("installments") {
        let current = export(c, id).await?;
        let mut parts = array(values).to_vec();
        // Move all existing positions outside the final range before swaps.
        let high = array(&current["installments"])
            .iter()
            .chain(parts.iter())
            .filter_map(|p| p["position"].as_i64())
            .max()
            .unwrap_or(0)
            + parts.len() as i64
            + 1;
        for (index, old) in array(&current["installments"]).iter().enumerate() {
            exec(c,"update installments set position=($1->>'position')::integer where id=($1->>'id')::uuid",json!({"id":old["id"],"position":high+index as i64})).await?;
        }
        for (index, part) in parts.iter_mut().enumerate() {
            ownership(c, "installments", "title_id", id, part).await?;
            if part.get("position").is_none() {
                part["position"] = json!(index + 1);
            }
            if part.get("kind").is_none() {
                part["kind"] = json!("season");
            }
            let part_id = upsert(
                c,
                "installments",
                PART,
                part,
                json!({"id":part["id"],"title_id":id}),
            )
            .await?;
            let part_id = part_id.as_str().expect("UUID");
            if let Some(score) = part.get("score") {
                let columns: Vec<_> = SCORE
                    .iter()
                    .filter(|k| score.get(**k).is_some())
                    .map(|k| snake(k))
                    .collect();
                if !columns.is_empty() {
                    let values = columns
                        .iter()
                        .map(|col| format!("r.{col}"))
                        .collect::<Vec<_>>()
                        .join(",");
                    let update = columns
                        .iter()
                        .map(|col| format!("{col}=excluded.{col}"))
                        .collect::<Vec<_>>()
                        .join(",");
                    let mut values_json = serde_json::Map::new();
                    for key in SCORE {
                        if let Some(v) = score.get(*key) {
                            values_json.insert(snake(key), v.clone());
                        }
                    }
                    exec(c,&format!("insert into installment_scores(installment_id,{}) select ($1->>'id')::uuid,{values} from jsonb_populate_record(null::installment_scores,$1->'score')r on conflict(installment_id) do update set {update}",columns.join(",")),json!({"id":part_id,"score":values_json})).await?;
                }
            }
            assign_media(c, "installment_id", part_id, &part["media"]).await?;
            if let Some(values) = part.get("episodes") {
                let old=rows(c,"select to_jsonb(e) from episodes e where installment_id=($1->>'id')::uuid order by id for update",json!({"id":part_id})).await?;
                for episode in &old {
                    if !array(values).iter().any(|next| next["id"] == episode["id"]) {
                        if !array(&links(c, text(episode, "id")).await?).is_empty() {
                            return Err(invalid(
                                "لا يمكن حذف الحلقة: ترتبط بسجلات محفوظة أو سجل مشاهدة.",
                            ));
                        }
                        exec(
                            c,
                            "delete from episodes where id=($1->>'id')::uuid",
                            episode.clone(),
                        )
                        .await?;
                    }
                }
                let high = old
                    .iter()
                    .chain(array(values).iter())
                    .filter_map(|v| v["position"].as_i64())
                    .max()
                    .unwrap_or(0)
                    + old.len() as i64
                    + array(values).len() as i64
                    + 1;
                let low = old
                    .iter()
                    .filter_map(|v| v["number"].as_f64())
                    .fold(0.0, f64::min)
                    - old.len() as f64
                    - 1.0;
                for (index, episode) in old.iter().enumerate() {
                    if array(values).iter().any(|v| v["id"] == episode["id"]) {
                        exec(c,"update episodes set position=($1->>'position')::integer,number=($1->>'number')::numeric where id=($1->>'id')::uuid",json!({"id":episode["id"],"position":high+index as i64,"number":low-index as f64})).await?;
                    }
                }
                for (index, value) in array(values).iter().enumerate() {
                    let mut value = value.clone();
                    ownership(c, "episodes", "installment_id", part_id, &mut value).await?;
                    if value.get("position").is_none() {
                        value["position"] = json!(index + 1);
                    }
                    let saved = upsert(
                        c,
                        "episodes",
                        EPISODE,
                        &value,
                        json!({"id":value["id"],"installment_id":part_id}),
                    )
                    .await?;
                    assign_media(
                        c,
                        "episode_id",
                        saved.as_str().expect("UUID"),
                        &value["media"],
                    )
                    .await?;
                }
            }
        }
    }
    if let Some(values) = patch.get("awards") {
        let mut ids = vec![];
        for (index, value) in array(values).iter().enumerate() {
            let mut value = value.clone();
            ownership(c, "award_recognitions", "title_id", id, &mut value).await?;
            let organization =
                resolve(c, "award_organizations", text(&value, "organization"), None).await?;
            let categories=rows(c,"select to_jsonb(a) from award_categories a where organization_id=($1->>'org')::uuid and (id::text=$1->>'category' or slug=$1->>'category' or lower(name_ar)=lower($1->>'category') or lower(name_en)=lower($1->>'category')) limit 2",json!({"org":organization["id"],"category":value["category"]})).await?;
            if categories.len() != 1 {
                return Err(invalid("Missing or ambiguous award category"));
            }
            let installment = if value["installment"].is_null() {
                Value::Null
            } else {
                one(c,"select to_jsonb(id) from installments where title_id=($1->>'id')::uuid and (id::text=$1->>'part' or position::text=$1->>'part')",json!({"id":id,"part":value["installment"]})).await?
            };
            if !value["ceremonyId"].is_null() {
                one(c,"select to_jsonb(id) from award_ceremonies where id=($1->>'ceremony')::uuid and organization_id=($1->>'org')::uuid and year=($1->>'year')::integer",json!({"ceremony":value["ceremonyId"],"org":organization["id"],"year":value["year"]})).await?;
            }
            let saved=upsert(c,"award_recognitions",&["category","year","result","isFeatured","sourceUrl","notes","position","ceremonyId"],&preserve(&json!({"position":index,"isFeatured":false,"year":null,"notes":null,"sourceUrl":null,"ceremonyId":null}),&value),json!({"id":value["id"],"title_id":id,"installment_id":installment,"organization_id":organization["id"],"category_id":categories[0]["id"],"organization_slug":organization["slug"],"organization_name":organization["name_ar"]})).await?;
            ids.push(saved);
        }
        prune(c, "award_recognitions", "title_id", id, &ids).await?;
    }
    Ok(())
}
fn changes(before: &Value, after: &Value, path: &str, output: &mut Vec<Value>) {
    if before == after {
        return;
    }
    if let (Some(a), Some(b)) = (before.as_object(), after.as_object()) {
        let keys: std::collections::BTreeSet<_> = a.keys().chain(b.keys()).collect();
        for key in keys {
            changes(
                &before[key],
                &after[key],
                &if path.is_empty() {
                    key.clone()
                } else {
                    format!("{path}.{key}")
                },
                output,
            );
        }
        return;
    }
    if let (Some(a), Some(b)) = (before.as_array(), after.as_array())
        && a.iter().chain(b).all(|v| v["id"].is_string())
    {
        let ids: std::collections::BTreeSet<_> = a.iter().chain(b).map(|v| text(v, "id")).collect();
        for id in ids {
            changes(
                a.iter().find(|v| v["id"] == id).unwrap_or(&Value::Null),
                b.iter().find(|v| v["id"] == id).unwrap_or(&Value::Null),
                &format!("{path}[{id}]"),
                output,
            );
        }
        return;
    }
    output.push(json!({"path":path,"before":before,"after":after}));
}
async fn review(
    c: &mut PgConnection,
    operation: &str,
    input: &Value,
    actor: &str,
    secret: &[u8],
) -> Result<Value> {
    let create = operation == "create";
    let mut plans = vec![];
    let mut baselines = vec![];
    if create {
        let mut patch = validate("workDocument", serde_json::from_str(text(input, "json"))?)?;
        if patch.get("id").is_some() {
            return Err(invalid("New work must not supply an ID"));
        }
        patch["id"] = uuid(c).await?;
        structure(c, &mut patch, &json!({})).await?;
        plans.push(json!({"id":patch["id"],"create":true,"revision":"","patch":patch}));
        baselines.push(Value::Null);
    } else {
        let projection = validate("projection", serde_json::from_str(text(input, "json"))?)?;
        let originals = array(&input["originals"]);
        let records = array(&projection["records"]);
        let fields = array(&projection["fields"]);
        unique(fields.iter().map(Value::to_string))?;
        unique(originals.iter().map(|r| r["id"].to_string()))?;
        unique(records.iter().map(|r| r["id"].to_string()))?;
        if records.len() > 5000
            || records
                .iter()
                .any(|r| !originals.iter().any(|o| o["id"] == r["id"]))
        {
            return Err(invalid("Work outside original selection"));
        }
        for raw in records {
            let before = export(c, text(raw, "id")).await?;
            let original = originals
                .iter()
                .find(|o| o["id"] == raw["id"])
                .expect("membership checked");
            if original["revision"] != fingerprint(&before) {
                return Err(Error::Conflict(
                    "تغيّر العمل منذ تحميله. احتفظ بالمسودة وأعد تحميل النسخة الحالية.".into(),
                ));
            }
            let object = raw
                .as_object()
                .ok_or_else(|| invalid("Invalid work object"))?;
            if object
                .keys()
                .any(|key| key != "id" && !fields.contains(&json!(key)))
            {
                return Err(invalid("Field outside selected editing scope"));
            }
            let mut patch = json!({"id":raw["id"],"canonicalTitle":before["canonicalTitle"],"sortTitle":before["sortTitle"]});
            for (key, value) in object {
                if key != "id" && before[key] != *value {
                    patch[key] = if key == "installments" {
                        preserve(&before[key], value)
                    } else {
                        value.clone()
                    };
                }
            }
            if patch["canonicalTitle"] != before["canonicalTitle"] && raw.get("sortTitle").is_none()
            {
                patch.as_object_mut().expect("patch").remove("sortTitle");
            }
            // Validate completed required identity without replacing omitted lists.
            patch = validate("workDocument", patch)?;
            structure(c, &mut patch, &before).await?;
            // Keep award ownership tied to the original installment when its position changes.
            if let Some(awards) = patch.get_mut("awards").and_then(Value::as_array_mut) {
                for award in awards {
                    if let Some(old) = array(&before["awards"])
                        .iter()
                        .find(|old| old["id"] == award["id"])
                        && old["installment"] == award["installment"]
                        && award["installment"].is_number()
                        && let Some(part) = array(&before["installments"])
                            .iter()
                            .find(|p| p["position"] == award["installment"])
                    {
                        award["installment"] = part["id"].clone();
                    }
                }
            }
            plans.push(json!({"id":patch["id"],"create":false,"revision":fingerprint(&before),"patch":patch}));
            baselines.push(before);
        }
    }
    sqlx::query("savepoint work_review")
        .execute(&mut *c)
        .await?;
    let rehearsal=async{
        for plan in &plans{apply(c,&plan["patch"],plan["create"]==true).await?;}
        let mut reviewed=vec![];
        for(plan,before)in plans.iter_mut().zip(&baselines){
            let after=export(c,text(plan,"id")).await?;let mut diff=vec![];changes(before,&after,"",&mut diff);
            plan["after"]=json!(fingerprint(&after));
            if !diff.is_empty(){reviewed.push(json!({"id":plan["id"],"name":after["titleAr"].as_str().filter(|s|!s.is_empty()).unwrap_or(text(&after,"canonicalTitle")),"changes":diff}));}
        }
        plans.retain(|plan|plan["after"]!=plan["revision"]);
        if plans.is_empty(){return Err(invalid("لا توجد تغييرات لمراجعتها."));}
        let(ticket,expires)=tickets::sign(json!({"purpose":"work-v2","records":plans}),actor,secret)?;
        Ok(json!({"ticket":ticket,"expiresAt":expires,"records":reviewed}))
    }.await;
    // Always undo the rehearsal, including failed statements which abort the savepoint.
    sqlx::query("rollback to savepoint work_review")
        .execute(&mut *c)
        .await?;
    sqlx::query("release savepoint work_review")
        .execute(&mut *c)
        .await?;
    rehearsal
}
pub(super) async fn execute(
    c: &mut PgConnection,
    operation: &str,
    input: &Value,
    actor: &str,
    secret: &[u8],
) -> Result<Value> {
    match operation {
        "parse" => validate("workDocument", serde_json::from_str(text(input, "json"))?),
        "read" => {
            let mut snapshots = vec![];
            let mut bytes = 0;
            for id in array(&input["ids"]) {
                let doc = export(c, id.as_str().ok_or_else(|| invalid("Invalid work ID"))?).await?;
                bytes += serde_json::to_vec(&doc)?.len();
                if bytes > 32 * 1024 * 1024 {
                    return Err(invalid("Work selection exceeds the editor response limit"));
                }
                snapshots.push(json!({"revision":fingerprint(&doc),"document":doc}));
            }
            Ok(json!(snapshots))
        }
        "review" | "create" => review(c, operation, input, actor, secret).await,
        "links" => {
            one(c,"select to_jsonb(e.id) from episodes e join installments i on i.id=e.installment_id where e.id=($1->>'episodeId')::uuid and i.title_id=($1->>'workId')::uuid",input.clone()).await?;
            links(c, text(input, "episodeId")).await
        }
        "save" => {
            let plan = tickets::read(text(input, "ticket"), "work-v2", actor, secret)?;
            let records = array(&plan["records"]);
            let ids: Vec<_> = records.iter().map(|r| r["id"].clone()).collect();
            rows(c,"select to_jsonb(id) from titles where id in(select value::uuid from jsonb_array_elements_text($1->'ids')) order by id for update",json!({"ids":ids})).await?;
            for record in records {
                if record["create"] == true {
                    if !rows(
                        c,
                        "select to_jsonb(id) from titles where id=($1->>'id')::uuid",
                        record.clone(),
                    )
                    .await?
                    .is_empty()
                    {
                        return Err(Error::Conflict("Work already saved".into()));
                    }
                } else if fingerprint(&export(c, text(record, "id")).await?) != record["revision"] {
                    return Err(Error::Conflict(
                        "تغيّر أحد الأعمال بعد المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.".into(),
                    ));
                }
            }
            for record in records {
                apply(c, &record["patch"], record["create"] == true).await?;
            }
            for record in records {
                let after = export(c, text(record, "id")).await?;
                if fingerprint(&after) != record["after"] {
                    return Err(Error::Conflict(
                        "نتيجة الحفظ تختلف عن المراجعة. لم تُحفظ أي تغييرات؛ أعد المراجعة.".into(),
                    ));
                }
                let p = json!({"actor":actor,"id":record["id"],"snapshot":after,"action":if record["create"]==true{"create"}else{"update"}});
                exec(c,"insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select ($1->>'actor')::uuid,'work_documents',$1->>'id',coalesce(max(revision),0)+1,$1->>'action','Complete work editor',$1->'snapshot',jsonb_build_object('after',$1->'snapshot') from editorial_revisions where entity_type='work_documents' and entity_id=$1->>'id'",p.clone()).await?;
                exec(c,"insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(($1->>'actor')::uuid,'admin.work.'||($1->>'action'),'titles',$1->>'id','Complete work editor',jsonb_build_object('after',$1->'snapshot'))",p).await?;
            }
            Ok(
                json!({"saved":records.len(),"createdId":records.iter().find(|r|r["create"]==true).map(|r|r["id"].clone())}),
            )
        }
        _ => Err(invalid("Unknown work operation")),
    }
}
/// Local operator import. Unlike the HTTP projection editor, merge imports retain omitted
/// list members. No missing vocabulary or people are created implicitly.
pub async fn apply_document(
    c: &mut PgConnection,
    document: Value,
    replace: bool,
    create_only: bool,
) -> Result<Value> {
    let mut patch = validate("workDocument", document)?;
    let existing = if let Some(id) = patch["id"].as_str() {
        rows(
            c,
            "select to_jsonb(id) from titles where id=($1->>'id')::uuid",
            json!({"id":id}),
        )
        .await?
    } else {
        rows(c,"select to_jsonb(id) from titles where lower(btrim(canonical_title))=lower(btrim($1->>'canonicalTitle')) limit 2",patch.clone()).await?
    };
    if existing.len() > 1 {
        return Err(invalid("Work name is ambiguous; supply its ID"));
    }
    if create_only && !existing.is_empty() {
        return Err(invalid("Work already exists"));
    }
    if existing.is_empty() {
        if patch.get("id").is_none() {
            patch["id"] = uuid(c).await?;
        }
        structure(c, &mut patch, &json!({})).await?;
        apply(c, &patch, true).await?;
        return Ok(json!({"titleId":patch["id"],"created":true}));
    }
    let id = existing[0].as_str().expect("UUID");
    patch["id"] = json!(id);
    let before = export(c, id).await?;
    // Match unspecified child IDs by their established position, as the import format does.
    if let Some(parts) = patch.get_mut("installments").and_then(Value::as_array_mut) {
        for (index, part) in parts.iter_mut().enumerate() {
            let position = part.get("position").cloned().unwrap_or(json!(index + 1));
            let original = array(&before["installments"]).iter().find(|old| {
                if part["id"].is_string() {
                    old["id"] == part["id"]
                } else {
                    old["position"] == position
                }
            });
            if let Some(original) = original {
                part["id"] = original["id"].clone();
                if let Some(episodes) = part.get_mut("episodes").and_then(Value::as_array_mut) {
                    for (index, episode) in episodes.iter_mut().enumerate() {
                        if episode.get("id").is_none() {
                            let position =
                                episode.get("position").cloned().unwrap_or(json!(index + 1));
                            if let Some(old) = array(&original["episodes"])
                                .iter()
                                .find(|e| e["position"] == position)
                            {
                                episode["id"] = old["id"].clone();
                            }
                        }
                    }
                }
            }
        }
    }
    fn key(value: &Value, field: &str) -> String {
        match field {
            "installments" | "episodes" | "awards" | "trailers" if value["id"].is_string() => {
                value["id"].to_string()
            }
            "credits" => format!("{}:{}", value["entity"], value["role"]),
            "externalIds" => format!("{}:{}", value["provider"], value["externalId"]),
            "relations" => format!("{}:{}", value["target"], value["kind"]),
            _ => value.to_string(),
        }
    }
    fn merge_lists(current: &Value, patch: &mut Value) {
        if let (Some(before), Some(after)) = (current.as_object(), patch.as_object_mut()) {
            for (field, next) in after {
                let Some(old) = before.get(field) else {
                    continue;
                };
                if let (Some(old_items), Some(new_items)) = (old.as_array(), next.as_array_mut()) {
                    if field == "planets" {
                        continue;
                    }
                    for item in new_items.iter_mut() {
                        if let Some(prior) = old_items
                            .iter()
                            .find(|prior| key(prior, field) == key(item, field))
                        {
                            merge_lists(prior, item);
                        }
                    }
                    let keys: std::collections::BTreeSet<_> =
                        new_items.iter().map(|v| key(v, field)).collect();
                    new_items.extend(
                        old_items
                            .iter()
                            .filter(|v| !keys.contains(&key(v, field)))
                            .cloned(),
                    );
                } else {
                    merge_lists(old, next);
                }
            }
        }
    }
    if !replace {
        merge_lists(&before, &mut patch);
    }
    if patch.get("installments").is_some() {
        patch["installments"] = preserve(&before["installments"], &patch["installments"]);
    }
    structure(c, &mut patch, &before).await?;
    apply(c, &patch, false).await?;
    Ok(json!({"titleId":id,"created":false}))
}
pub fn document_schema() -> Result<Value> {
    let all: Value = serde_json::from_str(include_str!("contracts.json"))?;
    Ok(all["workDocument"].clone())
}
