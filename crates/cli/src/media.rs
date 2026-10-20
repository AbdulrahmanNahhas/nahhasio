use super::*;
use nahhasio_catalog::editor;
async fn resolve(c: &mut PgConnection, resource: &str, value: &str) -> Result<String> {
    let (name, scope) = schema::resource(resource);
    let tables = schema::load(c).await?;
    let table = tables
        .iter()
        .find(|t| t.name == name)
        .ok_or_else(|| invalid("missing media resource"))?;
    records::resolve(c, table, value, scope.map(|(k, v)| (k.into(), v.into()))).await
}
pub async fn run(c: &mut PgConnection, args: &ArgMatches) -> Result<Value> {
    if !args.get_flag("write") && !args.get_flag("dry-run") {
        return Err(invalid("Media mutations require --write or --dry-run"));
    }
    let actor = audit_actor(c, false).await?;
    let action = text(args, "action").unwrap_or("");
    if action == "purge" {
        if !args.get_flag("yes") && !args.get_flag("dry-run") {
            return Err(invalid(
                "media purge requires --yes after reviewing --dry-run",
            ));
        }
        let assets=records::sql(c,"select id,sha256 from media_assets a where not exists(select 1 from media_asset_assignments x where x.asset_id=a.id) order by id").await?;
        let mut removed = 0;
        let mut retained = vec![];
        for asset in assets.as_array().expect("SQL rows") {
            sqlx::query("savepoint media_purge")
                .execute(&mut *c)
                .await?;
            match editor::execute(
                c,
                "assetDelete",
                json!({"id":asset["id"],"expectedSha256":asset["sha256"]}),
                &actor,
                &[],
            )
            .await
            {
                Ok(_) => {
                    removed += 1;
                    sqlx::query("release savepoint media_purge")
                        .execute(&mut *c)
                        .await?;
                }
                Err(Error::Invalid(_) | Error::Conflict(_)) => {
                    sqlx::query("rollback to savepoint media_purge")
                        .execute(&mut *c)
                        .await?;
                    sqlx::query("release savepoint media_purge")
                        .execute(&mut *c)
                        .await?;
                    retained.push(asset["id"].clone());
                }
                Err(error) => return Err(error),
            }
        }
        return Ok(json!({"deleted":removed,"retained":retained,"fileRetained":true}));
    }
    let role = text(args, "role").unwrap_or("poster");
    if !["poster", "banner", "logo", "profile", "still"].contains(&role) {
        return Err(invalid("Invalid artwork role"));
    }
    let owners: [(&str, &str); 4] = [
        ("title", "title"),
        ("installment", "installment"),
        ("episode", "episode"),
        ("entity", "entity"),
    ];
    let supplied: Vec<_> = owners
        .into_iter()
        .filter_map(|(flag, kind)| text(args, flag).map(|value| (kind, value)))
        .collect();
    if supplied.len() > 1 || action == "assign" && supplied.len() != 1 {
        return Err(invalid("Choose exactly one artwork owner"));
    }
    let reference = text(args, "reference")
        .ok_or_else(|| invalid("media requires an image file, provider URL or asset reference"))?;
    let asset = match action {
        "ingest" => {
            if reference.starts_with("https://") {
                editor::execute(c,"ingest",json!({"url":reference,"role":role,"ownerName":text(args,"name").unwrap_or("image")}),&actor,&[]).await?
            } else {
                editor::upload_file(
                    c,
                    std::path::Path::new(reference),
                    role,
                    text(args, "name")
                        .or_else(|| supplied.first().map(|(_, v)| *v))
                        .unwrap_or("image"),
                    &actor,
                )
                .await?
            }
        }
        "assign" => json!({"id":resolve(c,"media-asset",reference).await?}),
        _ => return Err(invalid("Media actions: ingest, assign, purge")),
    };
    if let Some((kind, value)) = supplied.first() {
        let owner_id = resolve(c, kind, value).await?;
        let column = format!("{kind}_id");
        let primary=sqlx::query_scalar::<_,sqlx::types::Json<Value>>(sqlx::AssertSqlSafe(format!("select to_jsonb(x) from media_asset_assignments x where {column}=$1::uuid and role::text=$2 and is_primary"))).bind(&owner_id).bind(role).fetch_optional(&mut *c).await?.map(|row|row.0).unwrap_or(Value::Null);
        editor::execute(c,"assetAssign",json!({"assetId":asset["id"],"ownerKind":kind,"ownerId":owner_id,"role":role,"expectedPrimaryId":primary["id"],"expectedPrimaryAssetId":primary["asset_id"]}),&actor,&[]).await?;
    }
    Ok(asset)
}
