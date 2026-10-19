use super::storage;
use super::*;
use crate::Error;
const PROJECTION: &str = "jsonb_build_object('id',a.id,'path',a.path,'fileName',a.original_filename,'mimeType',a.mime_type,'byteSize',a.byte_size,'width',a.width,'height',a.height,'sha256',a.sha256,'createdAt',a.created_at,'health',case when a.deletion_error is not null then 'deletion-error' else 'healthy' end,'assignmentCount',(select count(*) from media_asset_assignments x where x.asset_id=a.id),'roles',coalesce((select jsonb_agg(role order by role) from(select distinct role::text role from media_asset_assignments x where x.asset_id=a.id)r),'[]'))";
struct Owner {
    table: &'static str,
    column: &'static str,
    from: &'static str,
    label: &'static str,
    context: &'static str,
}
fn owner(kind: &str) -> Result<Owner> {
    Ok(match kind {
        "title" => Owner {
            table: "titles",
            column: "title_id",
            from: "titles t",
            label: "coalesce(t.title_ar,t.canonical_title)",
            context: "t.canonical_title",
        },
        "installment" => Owner {
            table: "installments",
            column: "installment_id",
            from: "installments t join titles w on w.id=t.title_id",
            label: "t.title",
            context: "coalesce(w.title_ar,w.canonical_title)",
        },
        "episode" => Owner {
            table: "episodes",
            column: "episode_id",
            from: "episodes t join installments i on i.id=t.installment_id join titles w on w.id=i.title_id",
            label: "coalesce(nullif(t.title,''),'الحلقة '||t.number::text)",
            context: "concat_ws(' / ',coalesce(w.title_ar,w.canonical_title),i.title)",
        },
        "entity" => Owner {
            table: "entities",
            column: "entity_id",
            from: "entities t",
            label: "t.name",
            context: "case t.kind::text when 'person' then 'شخص' else 'استوديو / مؤسسة' end",
        },
        _ => return Err(invalid("Invalid artwork owner")),
    })
}
async fn lock(c: &mut PgConnection, kind: &str, id: &str) -> Result<Owner> {
    let spec = owner(kind)?;
    let p = json!({"id":id});
    if matches!(kind, "installment" | "episode") {
        let from = if kind == "installment" {
            "installments i"
        } else {
            "episodes e join installments i on i.id=e.installment_id"
        };
        let column = if kind == "installment" {
            "i.id"
        } else {
            "e.id"
        };
        let root = one(
            c,
            &format!("select to_jsonb(i.title_id) from {from} where {column}=($1->>'id')::uuid"),
            p.clone(),
        )
        .await?;
        one(
            c,
            "select to_jsonb(id) from titles where id=($1->>'id')::uuid for update",
            json!({"id":root}),
        )
        .await?;
    }
    one(
        c,
        &format!(
            "select to_jsonb(id) from {} where id=($1->>'id')::uuid for update",
            spec.table
        ),
        p,
    )
    .await?;
    Ok(spec)
}
async fn asset(c: &mut PgConnection, id: &str, locked: bool) -> Result<Value> {
    one(
        c,
        &format!(
            "select {PROJECTION} from media_assets a where a.id=($1->>'id')::uuid {}",
            if locked { "for update of a" } else { "" }
        ),
        json!({"id":id}),
    )
    .await
}
async fn blocked(c: &mut PgConnection, id: &str) -> Result<Value> {
    one(c,"select coalesce(to_jsonb(case when exists(select 1 from media_asset_assignments where asset_id=($1->>'id')::uuid) then 'Artwork has assignments' when exists(select 1 from media_assets where variant_of_asset_id=($1->>'id')::uuid) then 'Artwork has derived variants' when exists(select 1 from editorial_revisions r,media_assets a where a.id=($1->>'id')::uuid and (strpos(r.snapshot::text,a.id::text)>0 or strpos(r.snapshot::text,a.path)>0 or strpos(r.changes::text,a.id::text)>0 or strpos(r.changes::text,a.path)>0 or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and (strpos(r.snapshot::text,l.changes->>'compatibilityPath')>0 or strpos(r.changes::text,l.changes->>'compatibilityPath')>0)))) then 'Artwork is needed by retained revisions' else null end),'null'::jsonb)",json!({"id":id})).await
}
async fn audit(
    c: &mut PgConnection,
    actor: &str,
    action: &str,
    table: &str,
    id: &str,
    changes: Value,
) -> Result<()> {
    exec(c,"insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(($1->>'actor')::uuid,'admin.artwork.'||($1->>'action'),$1->>'table',$1->>'id','Artwork editor',$1->'changes')",json!({"actor":actor,"action":action,"table":table,"id":id,"changes":changes})).await
}
async fn proposal(c: &mut PgConnection, asset: &Value) -> Result<Value> {
    let owners=rows(c,"select jsonb_build_object('name',concat_ws('-',coalesce(t.canonical_title,w.canonical_title,n.name),case when i.id is not null then 'installment-'||i.position::text when e.id is not null then 'installment-'||p.position::text||'-episode-'||e.number::text end),'role',x.role::text) from media_asset_assignments x left join titles t on t.id=x.title_id left join installments i on i.id=x.installment_id left join episodes e on e.id=x.episode_id left join installments p on p.id=e.installment_id left join titles w on w.id=coalesce(i.title_id,p.title_id) left join entities n on n.id=x.entity_id where x.asset_id=($1->>'id')::uuid order by x.id",json!({"id":asset["id"]})).await?;
    let names: std::collections::BTreeSet<_> = owners
        .iter()
        .map(|o| {
            format!(
                "{}-{}",
                storage::slug(text(o, "name"), false, 110),
                text(o, "role")
            )
        })
        .collect();
    let extension = match text(asset, "mimeType") {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/webp" => Some("webp"),
        _ => None,
    };
    let name = if names.len() == 1 {
        extension
            .map(|ext| {
                format!(
                    "{}-{}.{}",
                    names.first().expect("one name"),
                    &text(asset, "id")[..8],
                    ext
                )
            })
            .unwrap_or_default()
    } else {
        String::new()
    };
    let health = storage::health(asset).await;
    let reason = if owners.is_empty() {
        Some("لا توجد روابط لتحديد الاسم")
    } else if names.len() != 1 {
        Some("الصورة مرتبطة بأسماء متعددة")
    } else if extension.is_none() {
        Some("نوع الصورة غير مدعوم")
    } else if health != "healthy" {
        Some("ملف الصورة يحتاج إصلاحاً")
    } else if text(asset, "path").rsplit('/').next() == Some(name.as_str()) {
        Some("الاسم منظم بالفعل")
    } else {
        None
    };
    Ok(
        json!({"id":asset["id"],"oldPath":asset["path"],"oldFileName":asset["fileName"],"sha256":asset["sha256"],"newFileName":name,"reason":reason}),
    )
}
pub(super) async fn execute(
    c: &mut PgConnection,
    operation: &str,
    input: &Value,
    actor: &str,
) -> Result<Value> {
    match operation {
        "assets" => {
            let filter = "($1->>'q'='' or strpos(lower(concat_ws(' ',a.original_filename,a.path,a.sha256)),lower($1->>'q'))>0) and ($1->>'usage'='all' or ($1->>'usage'='assigned' and exists(select 1 from media_asset_assignments x where x.asset_id=a.id)) or ($1->>'usage'='unassigned' and not exists(select 1 from media_asset_assignments x where x.asset_id=a.id))) and ($1->>'role'='all' or exists(select 1 from media_asset_assignments x where x.asset_id=a.id and x.role::text=$1->>'role'))";
            let order = match text(input, "sort") {
                "oldest" => "a.created_at,a.id",
                "name" => "a.original_filename,a.id",
                "size" => "a.byte_size desc,a.id",
                _ => "a.created_at desc,a.id",
            };
            let total = one(
                c,
                &format!("select to_jsonb(count(*)) from media_assets a where {filter}"),
                input.clone(),
            )
            .await?;
            let scanning = input["health"] != "all";
            if scanning && total.as_u64().unwrap_or(0) > 10000 {
                return Err(invalid(
                    "Narrow the image search before scanning more than 10000 files",
                ));
            }
            let pagination = if scanning {
                "limit 10000"
            } else {
                "limit ($1->>'pageSize')::integer offset ((($1->>'page')::integer-1)*($1->>'pageSize')::integer)"
            };
            let mut assets=rows(c,&format!("select {PROJECTION} from media_assets a where {filter} order by {order} {pagination}"),input.clone()).await?;
            for asset in &mut assets {
                asset["health"] = json!(storage::health(asset).await);
            }
            let (assets, total) = if scanning {
                assets.retain(|a| {
                    if input["health"] == "problems" {
                        a["health"] != "healthy"
                    } else {
                        a["health"] == input["health"]
                    }
                });
                let total = assets.len();
                let size = input["pageSize"].as_u64().unwrap_or(24) as usize;
                let offset = (input["page"].as_u64().unwrap_or(1) as usize - 1) * size;
                (
                    assets
                        .into_iter()
                        .skip(offset)
                        .take(size)
                        .collect::<Vec<_>>(),
                    json!(total),
                )
            } else {
                (assets, total)
            };
            Ok(
                json!({"items":assets,"total":total,"page":input["page"],"pageSize":input["pageSize"]}),
            )
        }
        "assetDetail" => {
            let mut asset = asset(c, text(input, "id"), false).await?;
            asset["health"] = json!(storage::health(&asset).await);
            let assignments=rows(c,"select jsonb_build_object('id',x.id,'ownerId',coalesce(x.title_id,x.installment_id,x.episode_id,x.entity_id),'ownerKind',case when x.title_id is not null then 'title' when x.installment_id is not null then 'installment' when x.episode_id is not null then 'episode' else 'entity' end,'ownerLabel',coalesce(w.title_ar,w.canonical_title,i.title,nullif(e.title,''),case when e.id is not null then 'الحلقة '||e.number::text end,n.name),'ownerContext',concat_ws(' / ',coalesce(pw.title_ar,pw.canonical_title),coalesce(i.title,ep.title)),'workId',coalesce(w.id,i.title_id,ep.title_id),'entityKind',n.kind::text,'role',x.role::text,'isPrimary',x.is_primary) from media_asset_assignments x left join titles w on w.id=x.title_id left join installments i on i.id=x.installment_id left join episodes e on e.id=x.episode_id left join installments ep on ep.id=e.installment_id left join titles pw on pw.id=coalesce(i.title_id,ep.title_id) left join entities n on n.id=x.entity_id where x.asset_id=($1->>'id')::uuid order by x.is_primary desc,x.created_at desc,x.id",input.clone()).await?;
            Ok(
                json!({"asset":asset,"assignments":assignments,"deleteBlockedReason":blocked(c,text(input,"id")).await?}),
            )
        }
        "assetOwners" => {
            let spec = owner(text(input, "kind"))?;
            Ok(json!(rows(c,&format!("select jsonb_build_object('id',t.id,'label',{},'context',{},'primaryAssetId',p.asset_id,'primaryAssignmentId',p.id) from {} left join lateral(select id,asset_id from media_asset_assignments x where x.{}=t.id and x.role::text=$1->>'role' and x.is_primary order by x.id limit 1)p on true where ($1->>'q'='' or strpos(lower(concat_ws(' ',{},{})),lower($1->>'q'))>0) order by {},t.id limit 20",spec.label,spec.context,spec.from,spec.column,spec.label,spec.context,spec.label),input.clone()).await?))
        }
        "assetAssign" => {
            let spec = lock(c, text(input, "ownerKind"), text(input, "ownerId")).await?;
            one(
                c,
                "select to_jsonb(id) from media_assets where id=($1->>'assetId')::uuid for share",
                input.clone(),
            )
            .await?;
            let before=rows(c,&format!("select to_jsonb(x) from media_asset_assignments x where {}=($1->>'ownerId')::uuid and role::text=$1->>'role' order by id for update",spec.column),input.clone()).await?;
            let primary = before
                .iter()
                .find(|r| r["is_primary"] == true)
                .cloned()
                .unwrap_or(Value::Null);
            if primary["id"] != input["expectedPrimaryId"]
                || primary["asset_id"] != input["expectedPrimaryAssetId"]
            {
                return Err(Error::Conflict(
                    "تغيّرت الصورة الأساسية؛ أعد تحميل السجل قبل الربط.".into(),
                ));
            }
            exec(c,&format!("update media_asset_assignments set is_primary=false,updated_at=now() where {}=($1->>'ownerId')::uuid and role::text=$1->>'role' and is_primary",spec.column),input.clone()).await?;
            let assignment = if let Some(existing) =
                before.iter().find(|r| r["asset_id"] == input["assetId"])
            {
                one(c,"update media_asset_assignments set is_primary=true,updated_at=now() where id=($1->>'id')::uuid returning to_jsonb(id)",existing.clone()).await?
            } else {
                one(c,&format!("insert into media_asset_assignments({},asset_id,role,is_primary) values(($1->>'ownerId')::uuid,($1->>'assetId')::uuid,($1->>'role')::media_asset_role,true) returning to_jsonb(id)",spec.column),input.clone()).await?
            };
            audit(
                c,
                actor,
                "assign",
                "media_asset_assignments",
                assignment.as_str().expect("UUID"),
                json!({"before":before,"after":input}),
            )
            .await?;
            Ok(json!({"assignmentId":assignment}))
        }
        "assetUnlink" => {
            let query = "select to_jsonb(x) from media_asset_assignments x where id=($1->>'assignmentId')::uuid and asset_id=($1->>'assetId')::uuid";
            let candidate = one(c, query, input.clone()).await?;
            let kind = ["title", "installment", "episode", "entity"]
                .into_iter()
                .find(|kind| candidate[format!("{kind}_id")].is_string())
                .ok_or_else(|| invalid("Invalid assignment owner"))?;
            lock(
                c,
                kind,
                candidate[format!("{kind}_id")].as_str().expect("owner ID"),
            )
            .await?;
            let current = one(c, &format!("{query} for update"), input.clone()).await?;
            if current["is_primary"] != input["expectedPrimary"] {
                return Err(Error::Conflict(
                    "تغيّرت حالة الربط؛ أعد تحميل تفاصيل الصورة.".into(),
                ));
            }
            exec(
                c,
                "delete from media_asset_assignments where id=($1->>'assignmentId')::uuid",
                input.clone(),
            )
            .await?;
            audit(
                c,
                actor,
                "unlink",
                "media_asset_assignments",
                text(input, "assignmentId"),
                json!({"before":current,"after":null}),
            )
            .await?;
            Ok(json!({"removed":true}))
        }
        "assetDelete" => {
            let before = asset(c, text(input, "id"), true).await?;
            if before["sha256"] != input["expectedSha256"] {
                return Err(Error::Conflict("تغيّرت الصورة؛ أعد تحميل المكتبة.".into()));
            }
            let blocked = blocked(c, text(input, "id")).await?;
            if !blocked.is_null() {
                return Err(invalid(
                    blocked.as_str().unwrap_or("Artwork cannot be deleted"),
                ));
            }
            exec(
                c,
                "delete from media_assets where id=($1->>'id')::uuid",
                input.clone(),
            )
            .await?;
            audit(
                c,
                actor,
                "delete",
                "media_assets",
                text(input, "id"),
                json!({"before":before,"after":null,"fileRetained":true}),
            )
            .await?;
            Ok(json!({"removed":true,"fileRetained":true}))
        }
        "assetRenamePreview" | "assetRename" => {
            let rename = operation == "assetRename";
            let ids = if rename {
                array(&input["items"])
                    .iter()
                    .map(|i| i["id"].clone())
                    .collect::<Vec<_>>()
            } else {
                array(&input["ids"]).to_vec()
            };
            unique(ids.iter().map(Value::to_string))?;
            if rename {
                exec(
                    c,
                    "select pg_advisory_xact_lock(23103,710) where $1::jsonb is not null",
                    input.clone(),
                )
                .await?;
            }
            let mut sorted = ids;
            sorted.sort_by_key(Value::to_string);
            let mut plans = vec![];
            for id in sorted {
                let asset = asset(c, id.as_str().expect("validated UUID"), rename).await?;
                let proposal = proposal(c, &asset).await?;
                if rename {
                    let expected = array(&input["items"])
                        .iter()
                        .find(|i| i["id"] == id)
                        .expect("selected ID");
                    if !proposal["reason"].is_null()
                        || ["oldPath", "sha256", "newFileName"]
                            .iter()
                            .any(|key| proposal[*key] != expected[*key])
                    {
                        return Err(Error::Conflict(
                            "تغيّر اسم أو ربط صورة؛ أعد المعاينة قبل التأكيد.".into(),
                        ));
                    }
                }
                plans.push((asset, proposal));
            }
            if !rename {
                return Ok(json!(plans.into_iter().map(|(_, p)| p).collect::<Vec<_>>()));
            }
            for (asset, proposal) in &plans {
                storage::hard_link(asset, text(proposal, "newFileName")).await?;
                let (parent, _) = text(asset, "path")
                    .rsplit_once('/')
                    .ok_or_else(|| invalid("Invalid artwork path"))?;
                let new_path = format!("{parent}/{}", text(proposal, "newFileName"));
                exec(c,"update media_assets set path=$1->>'path',original_filename=$1->>'name',updated_at=now() where id=($1->>'id')::uuid",json!({"id":asset["id"],"path":new_path,"name":proposal["newFileName"]})).await?;
                audit(c,actor,"rename","media_assets",text(asset,"id"),json!({"before":{"path":asset["path"],"fileName":asset["fileName"]},"after":{"path":new_path,"fileName":proposal["newFileName"]},"compatibilityPath":asset["path"]})).await?;
            }
            Ok(json!({"renamed":plans.len(),"compatibilityLinksRetained":true}))
        }
        _ => Err(invalid("Unknown artwork operation")),
    }
}
