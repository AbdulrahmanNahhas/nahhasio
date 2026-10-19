use super::*;
use crate::schema;
const TABLES: &[&str] = &[
    "genres",
    "tones",
    "tags",
    "countries",
    "planets",
    "entities",
    "roles",
    "titles",
    "award_organizations",
    "award_categories",
    "award_ceremonies",
    "media_assets",
];
pub(super) async fn execute(c: &mut PgConnection, operation: &str, input: &Value) -> Result<Value> {
    if operation == "media" {
        return one(c,"select jsonb_build_object('id',a.id) from media_assets a where a.path=$1->>'path' or exists(select 1 from audit_logs l where l.action='admin.artwork.rename' and l.target_type='media_assets' and l.target_id=a.id::text and l.changes->>'compatibilityPath'=$1->>'path') order by (a.path=$1->>'path') desc limit 1",input.clone()).await;
    }
    let metadata = schema::load(c).await?;
    if operation == "schema" {
        return Ok(json!(metadata.iter().filter(|t|TABLES.contains(&t.name.as_str())||["installments","title_relations","award_recognitions"].contains(&t.name.as_str())).map(|table|json!({"name":table.name,"writable":false,"columns":table.columns.iter().map(|col|json!({"name":col.name,"data_type":col.data_type,"nullable":col.nullable,"primary":col.primary,"generated":col.generated,"default_value":col.default_value,"enum_values":col.enum_values})).collect::<Vec<_>>()})).collect::<Vec<_>>()));
    }
    if operation == "vocabulary" {
        let mut result = vec![];
        for name in array(&input["tables"]) {
            let name = name.as_str().ok_or_else(|| invalid("Invalid vocabulary"))?;
            let table = metadata
                .iter()
                .find(|t| t.name == name)
                .ok_or_else(|| invalid("Missing vocabulary"))?;
            let label = if name == "planets" {
                "coalesce(name_ar,name_en,slug)"
            } else {
                "coalesce(nullif(label_ar,''),label_en,slug)"
            };
            let options=rows(c,&format!("select jsonb_build_object('value',slug,'label',{label}) from {} where $1::jsonb is not null order by slug limit 2000",table.source()?),input.clone()).await?;
            result.push(json!({"table":name,"options":options}));
        }
        return Ok(json!(result));
    }
    let name = text(input, "table");
    if !TABLES.contains(&name) {
        return Err(invalid("Unknown editor reference table"));
    }
    let table = metadata
        .iter()
        .find(|t| t.name == name)
        .ok_or_else(|| invalid("Unknown table"))?;
    let mut filters = vec![
        "($1->>'search'='' or strpos(lower(to_jsonb(t)::text),lower($1->>'search'))>0)".to_owned(),
    ];
    let owners = "media_asset_assignments m left join installments i on i.id=m.installment_id left join episodes e on e.id=m.episode_id left join installments ei on ei.id=e.installment_id left join titles w on w.id=coalesce(m.title_id,i.title_id,ei.title_id) left join entities n on n.id=m.entity_id";
    if name == "media_assets" {
        filters[0] = format!(
            "($1->>'search'='' or strpos(lower(to_jsonb(t)::text),lower($1->>'search'))>0 or exists(select 1 from {owners} where m.asset_id=t.id and (strpos(lower(concat_ws(' ',w.canonical_title,w.title_ar,n.name,i.title,e.title)),lower($1->>'search'))>0 or exists(select 1 from title_aliases a where a.title_id=w.id and strpos(lower(a.title),lower($1->>'search'))>0))))"
        );
    }
    for (key, value) in input["filters"].as_object().into_iter().flatten() {
        if key == "related_work" && name == "media_assets" {
            if !value.is_string() {
                return Err(invalid("Invalid related work"));
            }
            filters.push("exists(select 1 from media_asset_assignments x left join installments i on i.id=x.installment_id left join episodes e on e.id=x.episode_id left join installments p on p.id=e.installment_id where x.asset_id=t.id and coalesce(x.title_id,i.title_id,p.title_id)=($1->'filters'->>'related_work')::uuid)".into());
            continue;
        }
        if key == "image_role" && name == "media_assets" {
            let role = value
                .as_str()
                .ok_or_else(|| invalid("Invalid artwork role"))?;
            if !["poster", "banner", "logo", "profile", "still"].contains(&role) {
                return Err(invalid("Invalid artwork role"));
            }
            let folder = if role == "profile" {
                "profiles".to_owned()
            } else {
                format!("{role}s")
            };
            filters.push(format!("(exists(select 1 from media_asset_assignments x where x.asset_id=t.id and (x.role::text='{role}' or ('{role}'='still' and x.episode_id is not null))) or t.path like '/media/uploads/{folder}/%')"));
            continue;
        }
        if ![
            "kind",
            "entity_kind",
            "organization_id",
            "id",
            "slug",
            "name",
            "canonical_title",
        ]
        .contains(&key.as_str())
            || !matches!(value, Value::String(_) | Value::Number(_) | Value::Bool(_))
        {
            return Err(invalid("Unsupported reference filter"));
        }
        table.column(key)?;
        filters.push(format!(
            "t.{}::text=$1->'filters'->>'{key}'",
            schema::quote(key)?
        ));
    }
    let where_clause = filters.join(" and ");
    let order = match text(input, "sort") {
        "newest" | "oldest" if table.columns.iter().any(|c| c.name == "created_at") => format!(
            "t.created_at {},t.id",
            if input["sort"] == "newest" {
                "desc"
            } else {
                "asc"
            }
        ),
        _ => "t.id".into(),
    };
    let extra = if name == "entities" {
        "||jsonb_build_object('artwork_path',(select a.path from media_asset_assignments x join media_assets a on a.id=x.asset_id where x.entity_id=t.id order by x.is_primary desc,case x.role when 'profile' then 0 when 'logo' then 1 else 2 end,x.id limit 1))"
    } else if name == "media_assets" {
        "||jsonb_build_object('owner_label',(select string_agg(distinct coalesce(nullif(w.title_ar,''),w.canonical_title,n.name),' · ') from media_asset_assignments m left join installments i on i.id=m.installment_id left join episodes e on e.id=m.episode_id left join installments ei on ei.id=e.installment_id left join titles w on w.id=coalesce(m.title_id,i.title_id,ei.title_id) left join entities n on n.id=m.entity_id where m.asset_id=t.id))"
    } else {
        ""
    };
    let result=rows(c,&format!("select to_jsonb(t){extra} from {} t where {where_clause} order by {order} limit 50 offset ($1->>'offset')::integer",table.source()?),input.clone()).await?;
    let total = one(
        c,
        &format!(
            "select to_jsonb(count(*)) from {} t where {where_clause}",
            table.source()?
        ),
        input.clone(),
    )
    .await?;
    Ok(json!({"rows":result,"total":total,"offset":input["offset"]}))
}
