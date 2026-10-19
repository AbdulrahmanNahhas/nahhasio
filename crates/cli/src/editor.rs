use super::*;
use nahhasio_catalog::editor;
fn input(args: &ArgMatches) -> Result<Value> {
    let path = text(args, "file")
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
        if !editor::handles(action) {
            return Err(invalid("Unknown editor operation"));
        }
        if editor::writes(action) {
            write_guard(args)?;
        }
        let actor = env::var("NAHHASIO_CLI_ACTOR")
            .map_err(|_| invalid("Editor commands require NAHHASIO_CLI_ACTOR"))?;
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
            "template" => {
                return Ok(Some(
                    json!({"canonicalTitle":"Example Work","titleAr":"عنوان العمل","format":"animated","workflowStatus":"draft","playbackPolicy":"torrents-allowed","installments":[{"kind":"season","position":1,"title":"الموسم الأول","episodes":[]}]}),
                ));
            }
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
