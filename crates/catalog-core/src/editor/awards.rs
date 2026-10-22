//! Award definitions share the authenticated editor transaction; recognitions remain work-owned.
use super::*;

fn definition(table: &str) -> Result<(&'static str, &'static [&'static str])> {
    match table {
        "award_organizations" => Ok((
            "awardOrganizationDraft",
            &[
                "slug",
                "name_ar",
                "name_en",
                "description",
                "website_url",
                "logo_path",
                "is_active",
            ],
        )),
        "award_categories" => Ok((
            "awardCategoryDraft",
            &[
                "organization_id",
                "slug",
                "name_ar",
                "name_en",
                "description",
                "is_active",
            ],
        )),
        "award_ceremonies" => Ok((
            "awardCeremonyDraft",
            &[
                "organization_id",
                "year",
                "edition",
                "label",
                "held_on",
                "source_url",
            ],
        )),
        _ => Err(invalid("Unknown award definition")),
    }
}
pub(super) async fn execute(
    c: &mut PgConnection,
    op: &str,
    input: &Value,
    actor: &str,
) -> Result<Value> {
    let table = text(input, "table");
    if op == "awardList" {
        if ![
            "award_organizations",
            "award_categories",
            "award_ceremonies",
            "award_recognitions",
        ]
        .contains(&table)
        {
            return Err(invalid("Unknown award table"));
        }
        let scope = if table == "award_organizations" {
            "true"
        } else {
            "($1->>'organization' is null or t.organization_id=($1->>'organization')::uuid)"
        };
        let extra = if table == "award_recognitions" {
            "||jsonb_build_object('work_name',(select coalesce(nullif(w.title_ar,''),w.canonical_title) from titles w where w.id=t.title_id),'work_english_name',(select w.canonical_title from titles w where w.id=t.title_id),'work_year',(select w.release_year from titles w where w.id=t.title_id),'poster_id',(select a.asset_id from media_asset_assignments a where a.title_id=t.title_id and a.role='poster' order by a.is_primary desc,a.id limit 1),'installment_name',(select i.title from installments i where i.id=t.installment_id))"
        } else {
            ""
        };
        let outcome = if table == "award_recognitions" {
            "($1->>'result'='all' or t.result::text=$1->>'result')"
        } else {
            "true"
        };
        let facets = if table == "award_recognitions" {
            "($1->>'category' is null or t.category_id=($1->>'category')::uuid) and ($1->>'ceremony' is null or t.ceremony_id=($1->>'ceremony')::uuid) and ($1->>'year' is null or t.year=($1->>'year')::integer) and (not ($1->>'featured')::boolean or t.is_featured) and ($1->>'source'='all' or ($1->>'source'='missing')=(nullif(btrim(t.source_url),'') is null))"
        } else {
            "true"
        };
        let filter = format!(
            "{scope} and {outcome} and {facets} and ($1->>'q'='' or strpos(lower((to_jsonb(t){extra})::text),lower($1->>'q'))>0)"
        );
        let order = match (table, text(input, "sort")) {
            ("award_recognitions", "work") => {
                "(select coalesce(nullif(w.title_ar,''),w.canonical_title) from titles w where w.id=t.title_id),t.year desc nulls last,t.id"
            }
            ("award_recognitions" | "award_ceremonies", "oldest") => "t.year asc nulls last,t.id",
            ("award_organizations" | "award_categories", _) => "t.name_ar,t.id",
            _ => "t.year desc nulls last,t.id",
        };
        let records = rows(c, &format!("select to_jsonb(t){extra} from public.{table} t where {filter} order by {order} limit 25 offset (($1->>'page')::integer-1)*25"), input.clone()).await?;
        let total = one(
            c,
            &format!("select to_jsonb(count(*)) from public.{table} t where {filter}"),
            input.clone(),
        )
        .await?;
        let mut counts = serde_json::Map::new();
        for name in [
            "award_organizations",
            "award_categories",
            "award_ceremonies",
            "award_recognitions",
        ] {
            let scope = if name == "award_organizations" {
                "true"
            } else {
                "($1->>'organization' is null or t.organization_id=($1->>'organization')::uuid)"
            };
            counts.insert(
                name.into(),
                one(
                    c,
                    &format!("select to_jsonb(count(*)) from public.{name} t where {scope}"),
                    input.clone(),
                )
                .await?,
            );
        }
        let mut records = records;
        if table != "award_recognitions" {
            let key = match table {
                "award_organizations" => "organization_id",
                "award_categories" => "category_id",
                _ => "ceremony_id",
            };
            for record in &mut records {
                let stats = one(c, &format!("select jsonb_build_object('recognition_count',count(*),'winner_count',count(*) filter(where result='winner'),'work_count',count(distinct title_id)) from award_recognitions where {key}=($1->>'id')::uuid"), json!({"id":record["id"]})).await?;
                record
                    .as_object_mut()
                    .expect("record object")
                    .extend(stats.as_object().expect("statistics object").clone());
            }
        }
        return Ok(json!({"rows":records,"total":total,"counts":counts}));
    }
    let (schema, fields) = definition(table)?;
    let id = text(input, "id");
    let before = if id.is_empty() {
        Value::Null
    } else {
        one(
            c,
            &format!(
                "select to_jsonb(t) from public.{table} t where id=($1->>'id')::uuid{}",
                if op == "awardDetail" {
                    ""
                } else {
                    " for update"
                }
            ),
            input.clone(),
        )
        .await?
    };
    if op == "awardDetail" {
        return Ok(
            json!({"revision":fingerprint(&before),"row":before,"links":dependencies(c,table,id,&[]).await?}),
        );
    }
    if !id.is_empty() && fingerprint(&before) != text(input, "revision") {
        return Err(crate::Error::Conflict(
            "تغيّر السجل؛ أغلق المحرر وأعد فتحه قبل الحفظ.".into(),
        ));
    }
    let after = if op == "awardDelete" {
        let expected = if table == "award_ceremonies" {
            before["year"].to_string()
        } else {
            text(&before, "slug").to_owned()
        };
        if text(input, "confirmation") != expected {
            return Err(invalid("اكتب رمز السجل أو سنة الدورة لتأكيد الحذف."));
        }
        if !array(&dependencies(c, table, id, &[]).await?).is_empty() {
            return Err(invalid(
                "السجل مرتبط ببيانات أخرى؛ انقل الارتباطات أو عطّل السجل بدلاً من حذفه.",
            ));
        }
        exec(
            c,
            &format!("delete from public.{table} where id=($1->>'id')::uuid"),
            input.clone(),
        )
        .await?;
        Value::Null
    } else {
        let draft = validate(schema, input["draft"].clone())?;
        if id.is_empty() && !input["revision"].is_null() {
            return Err(invalid("New record cannot have a revision"));
        }
        let params = json!({"id":input["id"],"draft":draft});
        let columns = fields.join(",");
        let query = if id.is_empty() {
            format!(
                "insert into public.{table}({columns}) select {columns} from jsonb_populate_record(null::public.{table},$1->'draft') returning to_jsonb({table})"
            )
        } else {
            let updates = fields
                .iter()
                .map(|f| format!("{f}=r.{f}"))
                .collect::<Vec<_>>()
                .join(",");
            format!(
                "update public.{table} t set {updates},updated_at=now() from jsonb_populate_record(null::public.{table},$1->'draft') r where t.id=($1->>'id')::uuid returning to_jsonb(t)"
            )
        };
        one(c, &query, params).await?
    };
    let saved_id = if id.is_empty() {
        text(&after, "id")
    } else {
        id
    };
    let action = if op == "awardDelete" {
        "delete"
    } else if id.is_empty() {
        "create"
    } else {
        "update"
    };
    let params = json!({"actor":actor,"table":table,"id":saved_id,"action":action,"before":before,"after":after});
    exec(c,"insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(($1->>'actor')::uuid,'admin.awards.'||($1->>'action'),$1->>'table',$1->>'id','Award editor',jsonb_build_object('before',$1->'before','after',$1->'after'))",params.clone()).await?;
    exec(c,"insert into editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) select ($1->>'actor')::uuid,$1->>'table',$1->>'id',coalesce(max(revision),0)+1,$1->>'action','Award editor',coalesce(nullif($1->'after','null'::jsonb),$1->'before'),jsonb_build_object('before',$1->'before','after',$1->'after') from editorial_revisions where entity_type=$1->>'table' and entity_id=$1->>'id'",params).await?;
    Ok(if op == "awardDelete" {
        json!({"removed":true})
    } else {
        json!({"id":saved_id,"created":id.is_empty()})
    })
}
