use super::*;
use crate::Error;

const SUMMARY: &str = "jsonb_build_object('id',e.id,'kind',e.kind::text,'name',e.name,'sortName',e.sort_name,'description',e.description,'updatedAt',e.updated_at,'artworkId',(select a.asset_id from media_asset_assignments a where a.entity_id=e.id order by a.is_primary desc,case a.role when 'profile' then 0 when 'logo' then 1 else 2 end,a.id limit 1),'workCount',(select count(distinct c.title_id) from contributions c where c.entity_id=e.id),'roles',coalesce((select jsonb_agg(label order by label) from (select distinct coalesce(nullif(r.label_ar,''),r.label_en) label from contributions c join roles r on r.id=c.role_id where c.entity_id=e.id)s),'[]'::jsonb))";
const FILTER: &str = "e.kind::text=$1->>'kind' and (coalesce($1->>'q','')='' or strpos(lower(concat_ws(' ',e.name,e.sort_name)),lower($1->>'q'))>0 or exists(select 1 from entity_aliases a where a.entity_id=e.id and strpos(lower(a.alias),lower($1->>'q'))>0)) and (coalesce($1->>'image','all')='all' or ($1->>'image'='with')=exists(select 1 from media_asset_assignments a where a.entity_id=e.id)) and (coalesce($1->>'usage','all')='all' or ($1->>'usage'='linked' and exists(select 1 from contributions c where c.entity_id=e.id)) or ($1->>'usage'='unlinked' and not exists(select 1 from contributions c where c.entity_id=e.id)) or ($1->>'usage'='one' and (select count(distinct c.title_id) from contributions c where c.entity_id=e.id)=1)) and ((coalesce($1->>'role','')='' and coalesce($1->>'language','')='') or exists(select 1 from contributions c join roles r on r.id=c.role_id where c.entity_id=e.id and (coalesce($1->>'role','')='' or r.slug=$1->>'role') and (coalesce($1->>'language','')='' or $1->>'language'=any(c.languages))))";

async fn snapshot(c: &mut PgConnection, id: &str, kind: &str) -> Result<Value> {
    let p = json!({"id":id,"kind":kind});
    let entity = one(c,&format!("select {SUMMARY} from entities e where e.id=($1->>'id')::uuid and e.kind::text=$1->>'kind'"),p.clone()).await?;
    let aliases = rows(c,"select jsonb_build_object('id',id,'alias',alias,'language',language) from entity_aliases where entity_id=($1->>'id')::uuid order by id",p.clone()).await?;
    let images = rows(c,"select jsonb_build_object('id',id,'asset_id',asset_id,'role',role::text,'is_primary',is_primary) from media_asset_assignments where entity_id=($1->>'id')::uuid order by id",p.clone()).await?;
    let credits = rows(c,"select jsonb_build_object('workId',c.title_id,'workTitle',t.canonical_title,'roleId',c.role_id,'roleName',r.label_en,'roleLabel',coalesce(nullif(r.label_ar,''),r.label_en),'position',c.position,'isPrimary',c.is_primary,'languages',c.languages) from contributions c join titles t on t.id=c.title_id join roles r on r.id=c.role_id where c.entity_id=($1->>'id')::uuid order by c.position,t.sort_title,c.title_id,c.role_id",p.clone()).await?;
    let urls = one(
        c,
        "select urls from entities where id=($1->>'id')::uuid",
        p.clone(),
    )
    .await?;
    let relations = rows(c,"select jsonb_build_object('id',r.id,'entityId',e.id,'entityName',e.name,'direction',case when r.source_id=($1->>'id')::uuid then 'outgoing' else 'incoming' end,'relationType',r.relation_type,'occurredOn',r.occurred_on::text,'description',r.description) from organization_relations r join entities e on e.id=case when r.source_id=($1->>'id')::uuid then r.target_id else r.source_id end where r.source_id=($1->>'id')::uuid or r.target_id=($1->>'id')::uuid order by r.id",p).await?;
    let role = if kind == "person" { "profile" } else { "logo" };
    let profile = images
        .iter()
        .find(|image| image["role"] == role && image["is_primary"] == true)
        .map(|image| image["asset_id"].clone())
        .unwrap_or(Value::Null);
    let draft = json!({"name":entity["name"],"sortName":entity["sortName"],"description":entity["description"],"urls":urls,"relations":relations,"aliases":aliases,"credits":credits,"profileAssetId":profile});
    let revision =
        fingerprint(&json!({"draft":draft,"images":images,"updatedAt":entity["updatedAt"]}));
    Ok(json!({"entity":entity,"draft":draft,"images":images,"revision":revision}))
}
async fn dependencies(c: &mut PgConnection, id: &str) -> Result<Value> {
    let mut links = super::dependencies(
        c,
        "entities",
        id,
        &["entity_aliases", "media_asset_assignments"],
    )
    .await?;
    let count=one(c,"select to_jsonb(count(*)) from source_evidence where entity_id=$1->>'id' and entity_type in('entity','person','people','organization','studios')",json!({"id":id})).await?;
    if count.as_u64().unwrap_or(0) > 0 {
        links
            .as_array_mut()
            .expect("dependency list")
            .push(json!({"table":"source_evidence","count":count}));
    }
    Ok(links)
}
async fn detail(c: &mut PgConnection, id: &str, kind: &str) -> Result<Value> {
    let mut result = snapshot(c, id, kind).await?;
    result["links"] = dependencies(c, id).await?;
    result["imageCount"] = json!(array(&result["images"]).len());
    result.as_object_mut().expect("snapshot").remove("images");
    Ok(result)
}
async fn lock_graph(c: &mut PgConnection, records: &[Value]) -> Result<()> {
    let ids: Vec<_> = records.iter().filter_map(|r| r["id"].as_str()).collect();
    let works: Vec<_> = records
        .iter()
        .flat_map(|r| array(&r["draft"]["credits"]))
        .filter_map(|r| r["workId"].as_str())
        .collect();
    let p = json!({"ids":ids,"works":works});
    rows(c,"select to_jsonb(id) from titles where id in (select title_id from contributions where entity_id in(select value::uuid from jsonb_array_elements_text($1->'ids'))) or id in(select value::uuid from jsonb_array_elements_text($1->'works')) order by id for update",p.clone()).await?;
    rows(c,"select to_jsonb(id) from entities where id in(select value::uuid from jsonb_array_elements_text($1->'ids')) order by id for update",p).await?;
    Ok(())
}
fn validate_draft(draft: &mut Value) -> Result<()> {
    for key in ["name", "sortName"] {
        let trimmed = text(draft, key).trim().to_owned();
        if trimmed.is_empty() {
            return Err(invalid("لا يمكن ترك الاسم فارغاً."));
        }
        draft[key] = json!(trimmed);
    }
    if let Some(aliases) = draft.get_mut("aliases").and_then(Value::as_array_mut) {
        for alias in aliases {
            alias["alias"] = json!(text(alias, "alias").trim());
            if text(alias, "alias").is_empty() {
                return Err(invalid("لا يمكن ترك الاسم البديل فارغاً."));
            }
        }
    }
    unique(array(&draft["aliases"]).iter().map(|a| {
        format!(
            "{}\0{}",
            text(a, "alias").to_lowercase(),
            text(a, "language")
        )
    }))?;
    unique(
        array(&draft["aliases"])
            .iter()
            .filter_map(|a| a["id"].as_str().map(str::to_owned)),
    )?;
    unique(
        array(&draft["credits"])
            .iter()
            .map(|a| format!("{}:{}", text(a, "workId"), text(a, "roleId"))),
    )?;
    for credit in array(&draft["credits"]) {
        unique(array(&credit["languages"]).iter().map(Value::to_string))?;
    }
    unique(
        array(&draft["urls"])
            .iter()
            .map(|u| text(u, "url").to_owned()),
    )?;
    for link in array(&draft["urls"]) {
        let url =
            reqwest::Url::parse(text(link, "url")).map_err(|_| invalid("رابط المرجع غير صالح."))?;
        if !matches!(url.scheme(), "http" | "https")
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err(invalid("رابط المرجع غير صالح."));
        }
    }
    unique(
        array(&draft["relations"])
            .iter()
            .filter_map(|r| r["id"].as_str().map(str::to_owned)),
    )?;
    unique(array(&draft["relations"]).iter().map(|r| {
        format!(
            "{}:{}:{}",
            text(r, "direction"),
            text(r, "entityId"),
            text(r, "relationType")
        )
    }))?;
    Ok(())
}
async fn apply(c: &mut PgConnection, input: &Value, actor: &str) -> Result<Value> {
    let kind = text(input, "kind");
    if input["id"].is_null() != input["revision"].is_null() {
        return Err(invalid("Invalid original revision"));
    }
    let mut draft = input["draft"].clone();
    validate_draft(&mut draft)?;
    let existing = input["id"].as_str();
    let id = if let Some(id) = existing {
        id.to_owned()
    } else {
        one(c, "select to_jsonb(gen_random_uuid())", Value::Null)
            .await?
            .as_str()
            .expect("UUID")
            .to_owned()
    };
    let before = if existing.is_some() {
        snapshot(c, &id, kind).await?
    } else {
        Value::Null
    };
    if existing.is_some() && before["revision"] != input["revision"] {
        return Err(Error::Conflict(
            "تغيّر السجل أو أعماله؛ أعد تحميله ومراجعة المسودة.".into(),
        ));
    }
    for alias in array(&draft["aliases"]) {
        if !alias["id"].is_null()
            && !array(&before["draft"]["aliases"])
                .iter()
                .any(|a| a["id"] == alias["id"])
        {
            return Err(invalid("اسم بديل لا ينتمي إلى هذا السجل."));
        }
    }
    for credit in array(&draft["credits"]) {
        let reference=one(c,"select jsonb_build_object('name',t.canonical_title,'role',r.label_en,'active',r.is_active,'kind',r.entity_kind::text) from titles t cross join roles r where t.id=($1->>'workId')::uuid and r.id=($1->>'roleId')::uuid",credit.clone()).await?;
        if reference["kind"] != kind
            || reference["name"] != credit["workTitle"]
            || reference["role"] != credit["roleName"]
        {
            return Err(invalid(
                "تغيّر اسم العمل أو الدور؛ أعد اختيارهما من القائمة.",
            ));
        }
        if reference["active"] != true
            && !array(&before["draft"]["credits"])
                .iter()
                .any(|old| old["workId"] == credit["workId"] && old["roleId"] == credit["roleId"])
        {
            return Err(invalid("هذا الدور غير نشط؛ اختر دوراً متاحاً."));
        }
    }
    if !draft["profileAssetId"].is_null() {
        one(c,"select to_jsonb(id) from media_assets where id=($1->>'profileAssetId')::uuid for share",draft.clone()).await?;
    }
    let p = json!({"id":id,"kind":kind,"draft":draft});
    if existing.is_none() {
        exec(c,"insert into entities(id,kind,name,sort_name,description) values(($1->>'id')::uuid,($1->>'kind')::entity_kind,$1->'draft'->>'name',$1->'draft'->>'sortName',$1->'draft'->>'description')",p.clone()).await?;
    } else {
        exec(c,"update entities set name=$1->'draft'->>'name',sort_name=$1->'draft'->>'sortName',description=$1->'draft'->>'description',updated_at=now() where id=($1->>'id')::uuid",p.clone()).await?;
    }
    exec(c,"delete from entity_aliases where entity_id=($1->>'id')::uuid and id not in(select (a->>'id')::uuid from jsonb_array_elements($1->'draft'->'aliases')a where a->>'id' is not null)",p.clone()).await?;
    for alias in array(&draft["aliases"]) {
        let p = json!({"id":id,"alias":alias});
        if alias["id"].is_null() {
            exec(c,"insert into entity_aliases(entity_id,alias,language) values(($1->>'id')::uuid,$1->'alias'->>'alias',nullif($1->'alias'->>'language',''))",p).await?;
        } else {
            exec(c,"update entity_aliases set alias=$1->'alias'->>'alias',language=nullif($1->'alias'->>'language','') where id=($1->'alias'->>'id')::uuid and entity_id=($1->>'id')::uuid",p).await?;
        }
    }
    exec(c,"delete from contributions where entity_id=($1->>'id')::uuid and not exists(select 1 from jsonb_array_elements($1->'draft'->'credits')a where (a->>'workId')::uuid=title_id and (a->>'roleId')::uuid=role_id)",p.clone()).await?;
    for credit in array(&draft["credits"]) {
        exec(c,"insert into contributions(title_id,entity_id,role_id,position,is_primary,languages) values(($1->'credit'->>'workId')::uuid,($1->>'id')::uuid,($1->'credit'->>'roleId')::uuid,($1->'credit'->>'position')::integer,($1->'credit'->>'isPrimary')::boolean,array(select jsonb_array_elements_text(coalesce($1->'credit'->'languages','[]')))) on conflict(title_id,entity_id,role_id) do update set position=excluded.position,is_primary=excluded.is_primary,languages=case when ($1->'credit')?'languages' then excluded.languages else contributions.languages end",json!({"id":id,"credit":credit})).await?;
    }
    let role = if kind == "person" { "profile" } else { "logo" };
    let p = json!({"id":id,"role":role,"asset":draft["profileAssetId"]});
    exec(c,"update media_asset_assignments set is_primary=false,updated_at=now() where entity_id=($1->>'id')::uuid and role::text=$1->>'role' and is_primary",p.clone()).await?;
    if !draft["profileAssetId"].is_null() {
        let matches=rows(c,"select to_jsonb(id) from media_asset_assignments where entity_id=($1->>'id')::uuid and role::text=$1->>'role' and asset_id=($1->>'asset')::uuid order by id limit 1 for update",p.clone()).await?;
        if let Some(assignment) = matches.first() {
            exec(c,"update media_asset_assignments set is_primary=true,updated_at=now() where id=($1->>'id')::uuid",json!({"id":assignment})).await?;
        } else {
            exec(c,"insert into media_asset_assignments(entity_id,asset_id,role,is_primary) values(($1->>'id')::uuid,($1->>'asset')::uuid,($1->>'role')::media_asset_role,true)",p).await?;
        }
    }
    references(c, &id, kind, &draft, &before["draft"]).await?;
    let after = snapshot(c, &id, kind).await?;
    revision(
        c,
        actor,
        &id,
        if existing.is_some() {
            "update"
        } else {
            "create"
        },
        before,
        after,
    )
    .await?;
    Ok(json!({"id":id,"created":existing.is_none()}))
}
async fn references(
    c: &mut PgConnection,
    id: &str,
    kind: &str,
    draft: &Value,
    before: &Value,
) -> Result<()> {
    if draft.get("urls").is_some() {
        exec(
            c,
            "update entities set urls=$1->'urls' where id=($1->>'id')::uuid",
            json!({"id":id,"urls":draft["urls"]}),
        )
        .await?;
    }
    if draft.get("relations").is_none() {
        return Ok(());
    }
    if kind != "organization" && !array(&draft["relations"]).is_empty() {
        return Err(invalid("العلاقات تخص الجهات فقط."));
    }
    for relation in array(&draft["relations"]) {
        if relation["entityId"] == id
            || (!relation["id"].is_null()
                && !array(&before["relations"])
                    .iter()
                    .any(|old| old["id"] == relation["id"]))
        {
            return Err(invalid(
                "العلاقة لا تنتمي إلى هذا السجل أو تربط الجهة بنفسها.",
            ));
        }
        let other=one(c,"select to_jsonb(name) from entities where id=($1->>'entityId')::uuid and kind='organization'",relation.clone()).await?;
        if other != relation["entityName"] {
            return Err(invalid("تغيّرت الجهة المرتبطة؛ أعد اختيارها."));
        }
    }
    exec(c,"delete from organization_relations where (source_id=($1->>'id')::uuid or target_id=($1->>'id')::uuid) and id not in(select (r->>'id')::uuid from jsonb_array_elements($1->'relations')r where r->>'id' is not null)",json!({"id":id,"relations":draft["relations"]})).await?;
    for r in array(&draft["relations"]) {
        let (source, target) = if r["direction"] == "outgoing" {
            (json!(id), r["entityId"].clone())
        } else {
            (r["entityId"].clone(), json!(id))
        };
        let p = json!({"id":r["id"],"source":source,"target":target,"type":r["relationType"],"date":r["occurredOn"],"description":r["description"]});
        if r["id"].is_null() {
            exec(c,"insert into organization_relations(source_id,target_id,relation_type,occurred_on,description) values(($1->>'source')::uuid,($1->>'target')::uuid,$1->>'type',($1->>'date')::date,$1->>'description')",p).await?;
        } else {
            exec(c,"update organization_relations set source_id=($1->>'source')::uuid,target_id=($1->>'target')::uuid,relation_type=$1->>'type',occurred_on=($1->>'date')::date,description=$1->>'description' where id=($1->>'id')::uuid",p).await?;
        }
    }
    Ok(())
}
async fn human(c: &mut PgConnection, snapshot: &Value) -> Result<Value> {
    let mut draft = snapshot["draft"].clone();
    draft["id"] = snapshot["entity"]["id"].clone();
    draft["profileImage"] = if draft["profileAssetId"].is_null() {
        Value::Null
    } else {
        one(
            c,
            "select to_jsonb(path) from media_assets where id=($1->>'profileAssetId')::uuid",
            draft.clone(),
        )
        .await?
    };
    draft
        .as_object_mut()
        .expect("draft")
        .remove("profileAssetId");
    draft["credits"]=json!(array(&draft["credits"]).iter().map(|r|json!({"work":r["workTitle"],"role":r["roleName"],"position":r["position"],"isPrimary":r["isPrimary"],"languages":r["languages"]})).collect::<Vec<_>>());
    Ok(draft)
}
async fn resolve_human(c: &mut PgConnection, record: &Value, kind: &str) -> Result<Value> {
    let mut draft = record.clone();
    let mut credits = vec![];
    for credit in array(&record["credits"]) {
        let works=rows(c,"select jsonb_build_object('id',id,'name',canonical_title) from titles where lower(canonical_title)=lower($1->>'work') limit 2",credit.clone()).await?;
        let roles=rows(c,"select jsonb_build_object('id',id,'name',label_en,'label',coalesce(nullif(label_ar,''),label_en)) from roles where entity_kind::text=$1->>'kind' and lower(label_en)=lower($1->>'role') limit 2",json!({"kind":kind,"role":credit["role"]})).await?;
        if works.len() != 1 || roles.len() != 1 {
            return Err(invalid(
                "اسم العمل أو الدور غير موجود أو غامض؛ استخدم اسماً مطابقاً فريداً.",
            ));
        }
        credits.push(json!({"workId":works[0]["id"],"workTitle":works[0]["name"],"roleId":roles[0]["id"],"roleName":roles[0]["name"],"roleLabel":roles[0]["label"],"position":credit["position"],"isPrimary":credit["isPrimary"],"languages":credit.get("languages").cloned().unwrap_or(json!([]))}));
    }
    draft["credits"] = json!(credits);
    draft["profileAssetId"] = if record["profileImage"].is_null() {
        Value::Null
    } else {
        one(c,"select to_jsonb(a.id) from media_assets a where a.path=$1->>'profileImage' or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=$1->>'profileImage') order by (a.path=$1->>'profileImage') desc limit 1",record.clone()).await?
    };
    let object = draft.as_object_mut().expect("record");
    object.remove("id");
    object.remove("profileImage");
    validate_draft(&mut draft)?;
    Ok(draft)
}
pub(super) async fn execute(
    c: &mut PgConnection,
    operation: &str,
    input: &Value,
    actor: &str,
    secret: &[u8],
) -> Result<Value> {
    let kind = text(input, "kind");
    match operation {
        "entityList" | "entitySelection" => {
            let order = match text(input, "sort") {
                "name" => "e.sort_name,e.name,e.id",
                "updated" => "e.updated_at desc,e.id",
                _ => {
                    "(select count(distinct c.title_id) from contributions c where c.entity_id=e.id) desc,e.sort_name,e.id"
                }
            };
            if operation == "entitySelection" {
                let selected=rows(c,&format!("select jsonb_build_object('id',e.id,'name',e.name) from entities e where {FILTER} order by e.id limit 10001"),input.clone()).await?;
                if selected.len() > 10000 {
                    return Err(invalid(
                        "Selection exceeds 10000 records; narrow the filters",
                    ));
                }
                return Ok(json!(selected));
            }
            let items=rows(c,&format!("select {SUMMARY} from entities e where {FILTER} order by {order} limit 24 offset ((($1->>'page')::integer-1)*24)"),input.clone()).await?;
            let total = one(
                c,
                &format!("select to_jsonb(count(*)) from entities e where {FILTER}"),
                input.clone(),
            )
            .await?;
            Ok(json!({"items":items,"total":total}))
        }
        "entityDetail" => detail(c, text(input, "id"), kind).await,
        "entitySave" => {
            lock_graph(c, std::slice::from_ref(input)).await?;
            apply(c, input, actor).await
        }
        "entityOptions" => {
            let works=rows(c,"select jsonb_build_object('id',t.id,'title',t.canonical_title,'titleAr',t.title_ar,'year',t.release_year,'score',(select (floor(avg(s.story*0.25+s.characters*0.2+s.depth*0.15+s.world_building*0.1+s.originality*0.1+s.craft*0.2)*10+0.5)/10)::double precision from installments i join installment_scores s on s.installment_id=i.id where i.title_id=t.id),'posterId',(select a.asset_id from media_asset_assignments a where a.title_id=t.id and a.role='poster' order by a.is_primary desc,a.id limit 1),'aliases',coalesce((select jsonb_agg(a.title order by a.id) from title_aliases a where a.title_id=t.id),'[]')) from titles t where $1::jsonb is not null order by coalesce(nullif(t.title_ar,''),t.sort_title),t.id limit 5001",input.clone()).await?;
            if works.len() > 5000 {
                return Err(invalid("Reference list exceeds 5000 works"));
            }
            let roles=rows(c,"select jsonb_build_object('id',id,'name',label_en,'label',coalesce(nullif(label_ar,''),label_en),'slug',slug,'active',is_active) from roles where entity_kind::text=$1->>'kind' order by position,label_en,id",input.clone()).await?;
            Ok(json!({"works":works,"roles":roles}))
        }
        "entityRoleCreate" => {
            exec(
                c,
                "select pg_advisory_xact_lock(23103,711) where $1::jsonb is not null",
                input.clone(),
            )
            .await?;
            if !rows(c,"select to_jsonb(id) from roles where slug=$1->>'slug' or (entity_kind::text=$1->>'kind' and lower(label_en)=lower($1->>'name'))",input.clone()).await?.is_empty(){return Err(invalid("الدور موجود بالفعل؛ اختره من القائمة أو استخدم اسماً ورمزاً مختلفين."));}
            let role=one(c,"insert into roles(slug,label_en,label_ar,entity_kind,position,is_active) select $1->>'slug',$1->>'name',coalesce(nullif($1->>'label',''),$1->>'name'),($1->>'kind')::entity_kind,coalesce(max(position),0)+1,true from roles returning jsonb_build_object('id',id)",input.clone()).await?;
            exec(c,"insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(($1->>'actor')::uuid,'admin.role.create','roles',$1->>'id','Entity role creation',$1->'input')",json!({"actor":actor,"id":role["id"],"input":input})).await?;
            Ok(role)
        }
        "entityDeletePreview" | "entityJsonRead" => {
            let ids = array(&input["ids"]);
            unique(ids.iter().map(Value::to_string))?;
            if ids.len() > 5000 {
                return Err(invalid("Selection exceeds 5000 records"));
            }
            let mut records = vec![];
            let mut originals = vec![];
            let mut previews = vec![];
            for id in ids {
                let id = id.as_str().ok_or_else(|| invalid("Invalid record ID"))?;
                if operation == "entityDeletePreview" {
                    records.push(detail(c, id, kind).await?);
                } else {
                    let value = snapshot(c, id, kind).await?;
                    records.push(human(c, &value).await?);
                    originals.push(json!({"id":id,"revision":value["revision"]}));
                    previews.push(value["entity"].clone());
                }
            }
            if operation == "entityDeletePreview" {
                Ok(json!(records))
            } else {
                Ok(
                    json!({"document":{"schemaVersion":1,"target":if kind=="person"{"people"}else{"studios"},"records":records},"originals":originals,"previews":previews}),
                )
            }
        }
        "entityBulkDelete" => {
            let records = array(&input["records"]);
            unique(records.iter().map(|r| text(r, "id").to_owned()))?;
            lock_graph(c, records).await?;
            let mut candidates = vec![];
            let mut removed = 0;
            for record in records {
                let before = snapshot(c, text(record, "id"), kind).await?;
                if before["revision"] != record["revision"] {
                    return Err(Error::Conflict(
                        "تغيّر سجل أو مساهماته؛ أعد مراجعة الحذف.".into(),
                    ));
                }
                if array(&dependencies(c, text(record, "id")).await?)
                    .iter()
                    .any(|r| r["table"] != "contributions")
                {
                    return Err(invalid(
                        "لا يمكن حذف السجل: توجد سياسات أو مراجع أو علاقات محفوظة.",
                    ));
                }
                let count = array(&before["draft"]["credits"]).len();
                if count > 0 && input["removeCredits"] != true {
                    return Err(invalid(
                        "أكد إزالة مساهمات الأعمال قبل الحذف؛ لن تحذف الأعمال نفسها.",
                    ));
                }
                removed += count;
                candidates.push(before);
            }
            for before in &candidates {
                let id = text(&before["entity"], "id");
                revision(c, actor, id, "delete", before.clone(), Value::Null).await?;
                for table in ["contributions", "media_asset_assignments", "entity_aliases"] {
                    exec(
                        c,
                        &format!("delete from {table} where entity_id=($1->>'id')::uuid"),
                        json!({"id":id}),
                    )
                    .await?;
                }
                exec(
                    c,
                    "delete from entities where id=($1->>'id')::uuid",
                    json!({"id":id}),
                )
                .await?;
            }
            Ok(json!({"deleted":candidates.len(),"removedCredits":removed}))
        }
        "entityJsonReview" => {
            let document = validate("entityDocument", serde_json::from_str(text(input, "json"))?)?;
            let originals = array(&input["originals"]);
            let records = array(&document["records"]);
            unique(originals.iter().map(|r| text(r, "id").to_owned()))?;
            unique(records.iter().map(|r| text(r, "id").to_owned()))?;
            if originals.len() != records.len()
                || records.len() > 5000
                || records
                    .iter()
                    .any(|r| !originals.iter().any(|o| o["id"] == r["id"]))
            {
                return Err(invalid(
                    "Record IDs must stay within the original selection",
                ));
            }
            let kind = if document["target"] == "people" {
                "person"
            } else {
                "organization"
            };
            let mut plans = vec![];
            let mut changes = vec![];
            for record in records {
                let original = originals
                    .iter()
                    .find(|o| o["id"] == record["id"])
                    .expect("membership checked");
                let before = snapshot(c, text(record, "id"), kind).await?;
                if before["revision"] != original["revision"] {
                    return Err(Error::Conflict(
                        "تغيّر سجل أو مساهماته على الخادم؛ أعد تحميله قبل المراجعة.".into(),
                    ));
                }
                let baseline = human(c, &before).await?;
                let draft = resolve_human(c, record, kind).await?;
                let changed: Vec<_> = [
                    "name",
                    "sortName",
                    "description",
                    "aliases",
                    "urls",
                    "relations",
                    "profileImage",
                    "credits",
                ]
                .iter()
                .filter(|key| record.get(**key).is_some() && baseline[**key] != record[**key])
                .map(|key| json!({"path":key,"before":baseline[*key],"after":record[*key]}))
                .collect();
                if !changed.is_empty() {
                    plans.push(
                        json!({"id":record["id"],"revision":original["revision"],"draft":draft}),
                    );
                    changes
                        .push(json!({"id":record["id"],"name":record["name"],"changes":changed}));
                }
            }
            if plans.is_empty() {
                return Err(invalid("لا توجد تغييرات لمراجعتها."));
            }
            sqlx::query("savepoint entity_review")
                .execute(&mut *c)
                .await?;
            let rehearsal = async {
                lock_graph(c, &plans).await?;
                for plan in &plans {
                    let mut request = plan.clone();
                    request["kind"] = json!(kind);
                    apply(c, &request, actor).await?;
                }
                Ok::<(), crate::Error>(())
            }
            .await;
            sqlx::query("rollback to savepoint entity_review")
                .execute(&mut *c)
                .await?;
            sqlx::query("release savepoint entity_review")
                .execute(&mut *c)
                .await?;
            rehearsal?;
            let (ticket, expires) = tickets::sign(
                json!({"purpose":"entity-json-v2","kind":kind,"records":plans}),
                actor,
                secret,
            )?;
            Ok(json!({"ticket":ticket,"expiresAt":expires,"records":changes}))
        }
        "entityJsonSave" => {
            let plan = tickets::read(text(input, "ticket"), "entity-json-v2", actor, secret)?;
            let records = array(&plan["records"]);
            lock_graph(c, records).await?;
            for record in records {
                let mut request = record.clone();
                request["kind"] = plan["kind"].clone();
                let request = validate("entitySave", request)?;
                apply(c, &request, actor).await?;
            }
            Ok(json!({"saved":records.len()}))
        }
        _ => Err(invalid("Unknown entity operation")),
    }
}
