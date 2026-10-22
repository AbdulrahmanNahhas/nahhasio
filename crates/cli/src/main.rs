//! Trusted local operator binary. Database credentials are environment-owned, never argv.
mod editor;
mod media;
mod output;
mod reports;
use clap::{Arg, ArgAction, ArgMatches, Command, value_parser};
use nahhasio_catalog::{
    Error, Result, migrations,
    records::{self, Mutation, Page, Selection},
    schema,
};
use serde_json::{Map, Value, json};
use sqlx::PgConnection;
use std::{
    env,
    io::{self, Write},
};

fn command() -> Command {
    Command::new("nahhasio").version(env!("CARGO_PKG_VERSION"))
        .about("Nahhasio local PostgreSQL operator tool (Rust)")
        .after_help("Examples:\n  nahhasio schema titles --json\n  nahhasio title list --search Arcane\n  nahhasio title update Arcane --set summary=... --dry-run\n  nahhasio title update Arcane --set summary=... --write\n  nahhasio sql 'select count(*) from titles' --json\n  nahhasio migrate status\n  nahhasio migrate apply --dry-run\n\nDATABASE_URL must be set explicitly. This is a trusted local operator tool, not a remote user API.\nWhole-work: work export <reference>; work apply --file document.json --dry-run or --write.\nShared services: editor <operation> --file input.json (NAHHASIO_CLI_ACTOR required).\nReports: stats coverage, scores, top, classification, vocabulary, planets, awards, people, media.\nArtwork: media ingest <file-or-provider-url>, media assign <asset>, media purge.")
        .arg(Arg::new("resource").help("health, preflight, schema, stats, sql, migrate, or a catalog resource/table"))
        .arg(Arg::new("action").help("list/get/create/update/delete; SQL text; table name; migration action"))
        .arg(Arg::new("reference").help("Record id, slug, name or alias"))
        .arg(Arg::new("by").long("by").value_delimiter(',').action(ArgAction::Append))
        .arg(Arg::new("metric").long("metric").value_delimiter(',').action(ArgAction::Append))
        .args(["role","name","title","installment","episode","entity"].map(|name|Arg::new(name).long(name)))
        .arg(Arg::new("resources").long("resources").action(ArgAction::SetTrue))
        .arg(Arg::new("input-json").long("input-json").help("Inline editor/work JSON input"))
        .arg(Arg::new("create-missing").long("create-missing").action(ArgAction::SetTrue))
        .arg(Arg::new("mode").long("mode").value_parser(["merge","replace"]).default_value("merge"))
        .arg(Arg::new("create-only").long("create-only").action(ArgAction::SetTrue))
        .arg(Arg::new("where").long("where").action(ArgAction::Append).help("AND filter: column=value, !=, >, <, >=, <=, ~, :in=, :nin="))
        .arg(Arg::new("set").long("set").action(ArgAction::Append).help("Typed column=value; UUID foreign keys also accept names"))
        .arg(Arg::new("json-set").long("json-set").action(ArgAction::Append).help("column=<JSON>, preserving literal strings and nulls"))
        .arg(Arg::new("search").long("search"))
        .arg(Arg::new("columns").long("columns").value_delimiter(','))
        .arg(Arg::new("order").long("order").help("column [asc|desc] [nulls first|last], ..."))
        .arg(Arg::new("limit").long("limit").value_parser(value_parser!(u32).range(1..=500)).default_value("50"))
        .arg(Arg::new("offset").long("offset").value_parser(value_parser!(u32)).default_value("0"))
        .arg(Arg::new("file").long("file").help("Read a single SQL statement or editor/work JSON document from a UTF-8 file"))
        .args(["write","dry-run","yes","count","enums","all-columns","wide"].map(|name|Arg::new(name).long(name).action(ArgAction::SetTrue)))
        .arg(Arg::new("json").long("json").action(ArgAction::SetTrue).conflicts_with_all(["ndjson","csv"]))
        .arg(Arg::new("ndjson").long("ndjson").action(ArgAction::SetTrue).conflicts_with("csv"))
        .arg(Arg::new("csv").long("csv").action(ArgAction::SetTrue))
}

fn invalid(message: &str) -> Error {
    Error::Invalid(message.into())
}
fn text<'a>(args: &'a ArgMatches, name: &str) -> Option<&'a str> {
    args.get_one::<String>(name).map(String::as_str)
}
fn repeated(args: &ArgMatches, name: &str) -> Vec<String> {
    args.get_many::<String>(name)
        .map(|values| values.cloned().collect())
        .unwrap_or_default()
}
fn assignment(value: &str) -> Result<(&str, &str)> {
    value
        .split_once('=')
        .ok_or_else(|| invalid("expected column=value"))
}

async fn audit_actor(c: &mut PgConnection, required: bool) -> Result<String> {
    let Ok(reference) = env::var("NAHHASIO_CLI_ACTOR") else {
        return if required {
            Err(invalid("Editor commands require NAHHASIO_CLI_ACTOR"))
        } else {
            Ok(String::new())
        };
    };
    let ids = sqlx::query_scalar::<_, String>(
        "select id::text from accounts where id::text=$1 or slug=$1 or display_name=$1 limit 2",
    )
    .bind(reference)
    .fetch_all(c)
    .await?;
    match ids.as_slice() {
        [id] => Ok(id.clone()),
        _ => Err(invalid("operator actor is unknown or ambiguous")),
    }
}

async fn dispatch(connection: &mut PgConnection, args: &ArgMatches) -> Result<Value> {
    if text(args, "resource") == Some("media") {
        return media::run(connection, args).await;
    }
    if let Some(result) = editor::dispatch(connection, args).await? {
        return Ok(result);
    }
    let resource = text(args, "resource").unwrap_or("health");
    let action = text(args, "action").unwrap_or("list");
    if resource == "health" {
        let database = sqlx::query_scalar::<_, String>("select current_database()")
            .fetch_one(connection)
            .await?;
        return Ok(
            json!({"ok":true,"product":"nahhasio","database":database,"version":env!("CARGO_PKG_VERSION")}),
        );
    }
    if resource == "preflight" {
        if args.get_flag("write") || args.get_flag("dry-run") {
            return Err(invalid(
                "preflight is read-only; omit --write and --dry-run",
            ));
        }
        let checks = nahhasio_catalog::deployment::inspect(
            connection,
            nahhasio_catalog::storage::ArtworkRoots::configured(),
            nahhasio_catalog::provider_config::root(),
        )
        .await?;
        let status = migrations::status(connection, &migrations::bundled()?).await?;
        let identity: bool =
            sqlx::query_scalar("select exists(select 1 from server_instance where singleton)")
                .fetch_one(connection)
                .await?;
        return Ok(
            json!({"ok":identity && status.pending.is_empty() && checks.iter().all(|c| c.ok),
            "readOnly":true,"checks":checks,"schema":status,"serverIdentity":identity,
            "scope":"Preliminary checks only; installation must verify writes, TLS, backups and restoration"}),
        );
    }
    if resource == "migrate" {
        let history = migrations::bundled()?;
        return match action {
            "list" | "status" => Ok(serde_json::to_value(
                migrations::status(connection, &history).await?,
            )?),
            "apply" => {
                if !args.get_flag("write") && !args.get_flag("dry-run") {
                    return Err(invalid(
                        "migration apply requires --dry-run or --write after backup/rehearsal",
                    ));
                }
                Ok(serde_json::to_value(
                    migrations::apply(connection, &history).await?,
                )?)
            }
            _ => Err(invalid("migration actions: status, manifest, apply")),
        };
    }
    if resource == "sql" {
        let statement = if let Some(path) = text(args, "file") {
            if std::fs::metadata(path)?.len() > 1024 * 1024 {
                return Err(invalid("SQL file exceeds 1 MiB"));
            }
            std::fs::read_to_string(path)?
        } else {
            text(args, "action")
                .ok_or_else(|| invalid("supply a SQL statement or --file"))?
                .to_owned()
        };
        let rows = records::sql(connection, &statement).await?;
        if args.get_flag("write") || args.get_flag("dry-run") {
            records::audit(
                connection,
                "cli.sql.write",
                "sql",
                env::var("NAHHASIO_CLI_ACTOR").ok().as_deref(),
                &json!({"resultRows":rows.as_array().map(Vec::len)}),
            )
            .await?;
        }
        return Ok(rows);
    }
    let mut tables = schema::load(connection).await?;
    for table in &mut tables {
        for column in &mut table.columns {
            if nahhasio_catalog::redaction::protected(&table.name, &column.name) {
                column.default_value = None;
            }
        }
    }
    if resource == "schema" {
        if args.get_flag("enums") {
            let enums: std::collections::BTreeMap<_, _> = tables
                .iter()
                .flat_map(|table| table.columns.iter())
                .filter(|column| !column.enum_values.is_empty())
                .map(|column| (&column.data_type, &column.enum_values))
                .collect();
            return Ok(serde_json::to_value(enums)?);
        }
        return if let Some(name) = text(args, "action") {
            let (name, _) = schema::resource(name);
            Ok(serde_json::to_value(
                tables
                    .iter()
                    .find(|table| table.name == name)
                    .ok_or_else(|| invalid("unknown table; run nahhasio schema"))?,
            )?)
        } else {
            Ok(json!(
                tables
                    .iter()
                    .map(|table| json!({"name":table.name,"columns":table.columns.len()}))
                    .collect::<Vec<_>>()
            ))
        };
    }
    if resource == "stats" {
        return reports::run(connection, args).await;
    }

    let (name, scope) = schema::resource(resource);
    let table = tables
        .iter()
        .find(|table| table.name == name)
        .ok_or_else(|| invalid("unknown resource; run nahhasio schema"))?;
    let mut selection = Selection {
        filters: repeated(args, "where"),
        search: text(args, "search").map(str::to_owned),
        scope: scope.map(|(name, value)| (name.into(), value.into())),
    };
    if let Some(reference) = text(args, "reference") {
        if !selection.filters.is_empty() {
            return Err(invalid("use either a reference or --where"));
        }
        let id = records::resolve(connection, table, reference, selection.scope.clone()).await?;
        selection
            .filters
            .push(format!("{}={id}", table.key()?.name));
    }
    match action {
        "list" | "ls" | "get" | "show" => {
            if matches!(action, "get" | "show") && text(args, "reference").is_none() {
                return Err(invalid("get requires a reference"));
            }
            let mut columns = repeated(args, "columns");
            if matches!(action, "list" | "ls")
                && columns.is_empty()
                && !args.get_flag("all-columns")
            {
                columns = table
                    .columns
                    .iter()
                    .filter(|column| {
                        column.primary
                            || table.reference_columns().contains(&column.name.as_str())
                            || [
                                "kind",
                                "status",
                                "workflow_status",
                                "release_year",
                                "position",
                            ]
                            .contains(&column.name.as_str())
                    })
                    .map(|column| column.name.clone())
                    .collect();
            }
            let page = Page {
                limit: *args.get_one::<u32>("limit").expect("default limit"),
                offset: *args.get_one::<u32>("offset").expect("default offset"),
                columns,
                order: text(args, "order").map(str::to_owned),
                count: args.get_flag("count"),
            };
            let rows = records::list(connection, table, &selection, &page).await?;
            if matches!(action, "get" | "show") && !page.count {
                rows.as_array()
                    .and_then(|rows| rows.first())
                    .cloned()
                    .ok_or_else(|| invalid("no matching record"))
            } else {
                Ok(rows)
            }
        }
        "create" | "new" | "update" | "delete" | "rm" => {
            if !args.get_flag("write") && !args.get_flag("dry-run") {
                return Err(invalid("mutations require --dry-run or --write"));
            }
            let action = match action {
                "create" | "new" => Mutation::Create,
                "update" => Mutation::Update,
                _ => Mutation::Delete,
            };
            if action == Mutation::Create
                && (text(args, "reference").is_some() || !selection.filters.is_empty())
            {
                return Err(invalid("create does not accept a reference or filters"));
            }
            let mut values = Map::new();
            for entry in repeated(args, "set") {
                let (name, raw) = assignment(&entry)?;
                let column = table.column(name)?;
                let value = if column.data_type == "uuid"
                    && !matches!(raw, "null" | "~null" | "\\N")
                    && let Some(target) = &column.references_table
                {
                    let target = tables
                        .iter()
                        .find(|table| table.name == *target)
                        .ok_or_else(|| invalid("foreign table is unavailable"))?;
                    json!(records::resolve(connection, target, raw, None).await?)
                } else {
                    records::coerce(table, name, raw)?
                };
                if values.insert(name.into(), value).is_some() {
                    return Err(invalid("duplicate assignment"));
                }
            }
            for entry in repeated(args, "json-set") {
                let (name, raw) = assignment(&entry)?;
                table.column(name)?;
                if values
                    .insert(name.into(), serde_json::from_str(raw)?)
                    .is_some()
                {
                    return Err(invalid("duplicate assignment"));
                }
            }
            if action == Mutation::Delete && !values.is_empty() {
                return Err(invalid("delete does not accept assignments"));
            }
            records::mutate(
                connection,
                table,
                &selection,
                &values,
                action,
                args.get_flag("yes") || args.get_flag("dry-run"),
                env::var("NAHHASIO_CLI_ACTOR").ok().as_deref(),
            )
            .await
        }
        _ => Err(invalid(
            "unsupported operation; use work apply/export/schema/template or editor <operation> --file input.json",
        )),
    }
}

async fn run(args: &ArgMatches) -> Result<Value> {
    if text(args, "resource") == Some("help") {
        if text(args, "action") == Some("work") {
            return nahhasio_catalog::editor::work::document_schema();
        }
        if text(args, "action") == Some("editor") {
            return nahhasio_catalog::editor::input_schema(text(args, "reference"));
        }

        return Ok(
            json!({"name":"nahhasio","version":env!("CARGO_PKG_VERSION"),"commands":["health","preflight","schema","stats","sql","migrate","work","media","editor"],"resources":schema::resources(),"flags":command().get_arguments().map(|arg|json!({"name":arg.get_id().as_str(),"long":arg.get_long(),"help":arg.get_help().map(ToString::to_string)})).collect::<Vec<_>>(),"writes":"--write or --dry-run; multi-row commits also require --yes","workInput":"--file document.json, positional file or --input-json <document>"}),
        );
    }
    if text(args, "resource") == Some("schema") && args.get_flag("resources") {
        return Ok(schema::resources());
    }
    if text(args, "resource") == Some("work") && text(args, "action") == Some("template") {
        return Ok(editor::template());
    }

    if text(args, "resource") == Some("migrate") && text(args, "action") == Some("manifest") {
        return Ok(migrations::manifest(&migrations::bundled()?));
    }
    if text(args, "resource") == Some("work") && text(args, "action") == Some("schema") {
        return nahhasio_catalog::editor::work::document_schema();
    }
    let url = env::var("DATABASE_URL").map_err(|_| {
        invalid("DATABASE_URL is required; there is no implicit production/development database")
    })?;
    let pool =
        nahhasio_catalog::database_pool(&url, 1).map_err(|_| invalid("DATABASE_URL is invalid"))?;
    let mut transaction = pool.begin().await?;
    if args.get_flag("write") || args.get_flag("dry-run") {
        sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE, READ WRITE")
            .execute(&mut *transaction)
            .await?;
    } else {
        sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            .execute(&mut *transaction)
            .await?;
    }
    let output = dispatch(&mut transaction, args).await?;
    if args.get_flag("dry-run") {
        transaction.rollback().await?;
        Ok(json!({"dryRun":true,"rolledBack":true,"result":output}))
    } else {
        transaction.commit().await?;
        Ok(output)
    }
}

#[tokio::main]
async fn main() {
    let mut argv: Vec<_> = env::args_os().collect();
    for i in 0..argv.len().saturating_sub(1) {
        if argv[i] == "--json"
            && argv[i + 1]
                .to_str()
                .is_some_and(|value| value.trim_start().starts_with('{'))
        {
            argv[i] = "--input-json".into();
        }
    }
    let args = command().get_matches_from(argv);
    if text(&args, "resource").is_none() {
        let _ = command().print_help();
        println!();
        return;
    }
    if text(&args, "resource") == Some("help") && !args.get_flag("json") {
        let _ = command().print_long_help();
        println!();
        return;
    }
    let result = run(&args).await;
    let (mut value, failed) = match result {
        Ok(value) => (value, false),
        Err(error) => (json!({"error":{"message":error.to_string()}}), true),
    };
    let rejected_preflight = text(&args, "resource") == Some("preflight") && value["ok"] == false;
    nahhasio_catalog::redaction::scrub(&mut value, 0);
    let rendered = if failed || args.get_flag("json") {
        serde_json::to_string_pretty(&value).expect("JSON value")
    } else {
        output::render(
            &value,
            if args.get_flag("csv") {
                output::Format::Csv
            } else if args.get_flag("ndjson") {
                output::Format::Ndjson
            } else {
                output::Format::Table
            },
            args.get_flag("wide"),
        )
    };
    let written = if failed {
        writeln!(io::stderr().lock(), "{rendered}")
    } else {
        writeln!(io::stdout().lock(), "{rendered}")
    };
    if failed
        || rejected_preflight
        || written.is_err_and(|error| error.kind() != io::ErrorKind::BrokenPipe)
    {
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_filters_and_rejects_unknown_or_conflicting_flags() {
        let args = command()
            .try_get_matches_from([
                "nahhasio",
                "title",
                "update",
                "Arcane",
                "--set",
                "summary=a=b",
                "--where",
                "id=1",
                "--dry-run",
            ])
            .unwrap();
        assert_eq!(
            assignment(&repeated(&args, "set")[0]).unwrap(),
            ("summary", "a=b")
        );
        assert!(args.get_flag("dry-run"));
        assert!(
            command()
                .try_get_matches_from(["nahhasio", "title", "list", "--limit", "501"])
                .is_err()
        );
        assert!(
            command()
                .try_get_matches_from(["nahhasio", "--json", "--csv"])
                .is_err()
        );
        assert!(
            command()
                .try_get_matches_from(["nahhasio", "--writ"])
                .is_err()
        );
    }
}
