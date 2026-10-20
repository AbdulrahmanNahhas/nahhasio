use super::*;
use nahhasio_catalog::editor;
fn input(args: &ArgMatches) -> Result<Value> {
    if let Some(json) = text(args, "input-json") {
        return Ok(serde_json::from_str(json)?);
    }
    let path = text(args, "file")
        .or_else(|| {
            if text(args, "resource") == Some("work") && text(args, "action") == Some("apply") {
                text(args, "reference")
            } else {
                None
            }
        })
        .ok_or_else(|| invalid("This command requires --file <JSON document>"))?;
    if std::fs::metadata(path)?.len() > 16 * 1024 * 1024 {
        return Err(invalid("Document exceeds 16 MiB"));
    }
    Ok(serde_json::from_slice(&std::fs::read(path)?)?)
}
fn write_guard(args: &ArgMatches) -> Result<()> {
    if !args.get_flag("write") && !args.get_flag("dry-run") {
        return Err(invalid("Mutation requires --write or --dry-run"));
    }
    Ok(())
}
pub async fn dispatch(c: &mut PgConnection, args: &ArgMatches) -> Result<Option<Value>> {
    let resource = text(args, "resource").unwrap_or("");
    let action = text(args, "action").unwrap_or("");
    if resource == "editor" {
        let planet = if nahhasio_catalog::planets::Request::handles(action) {
            Some(
                serde_json::from_value::<nahhasio_catalog::planets::Request>(
                    json!({"operation":action,"data":input(args)?}),
                )?,
            )
        } else {
            None
        };
        if !editor::handles(action) && planet.is_none() {
            return Err(invalid("Unknown editor operation"));
        }
        if editor::writes(action)
            || planet
                .as_ref()
                .is_some_and(nahhasio_catalog::planets::Request::writes)
        {
            write_guard(args)?;
        }
        let actor = audit_actor(c, true).await?;
        if let Some(planet) = planet {
            return Ok(Some(
                nahhasio_catalog::planets::execute(c, planet, Some(&actor)).await?,
            ));
        }
        let secret = env::var("NAHHASIO_EDITOR_SECRET")
            .ok()
            .map(|v| hex::decode(v).map_err(|_| invalid("Invalid editor signing configuration")))
            .transpose()?
            .unwrap_or_default();
        return Ok(Some(
            editor::execute(c, action, input(args)?, &actor, &secret).await?,
        ));
    }
    if resource == "work" {
        match action {
            "schema" => return Ok(Some(editor::work::document_schema()?)),
            "template" => return Ok(Some(template())),
            "export" => {
                let tables = schema::load(c).await?;
                let table = tables
                    .iter()
                    .find(|t| t.name == "titles")
                    .ok_or_else(|| invalid("Missing titles table"))?;
                let id = records::resolve(
                    c,
                    table,
                    text(args, "reference")
                        .ok_or_else(|| invalid("work export requires a reference"))?,
                    None,
                )
                .await?;
                return Ok(Some(editor::work::export(c, &id).await?));
            }
            "apply" => {
                write_guard(args)?;
                let document = input(args)?;
                let result = editor::work::apply_document(
                    c,
                    document,
                    text(args, "mode") == Some("replace"),
                    args.get_flag("create-only"),
                    args.get_flag("create-missing"),
                )
                .await?;
                records::audit(
                    c,
                    "cli.work.apply",
                    "titles",
                    env::var("NAHHASIO_CLI_ACTOR").ok().as_deref(),
                    &result,
                )
                .await?;
                return Ok(Some(result));
            }
            _ => {}
        }
    }
    // Artwork and People/Studios operations share the exact HTTP contracts through `editor`.
    // This explicit command avoids another independent parser and mutation implementation.
    Ok(None)
}

pub fn template() -> Value {
    json!({"canonicalTitle":"Example Work","titleAr":"عنوان العمل","format":"animated","workflowStatus":"draft","playbackPolicy":"torrents-allowed","installments":[{"kind":"season","position":1,"title":"الموسم الأول","episodes":[]}]})
}
