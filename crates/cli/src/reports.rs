use super::*;
pub async fn run(c: &mut PgConnection, args: &ArgMatches) -> Result<Value> {
    let name = text(args, "action").unwrap_or("overview");
    let presets: Value = records::report_presets()?;
    let groups = repeated(args, "by");
    let metrics = repeated(args, "metric");
    if groups.is_empty()
        && metrics.is_empty()
        && let Some(query) = presets[name].as_str()
    {
        if !repeated(args, "where").is_empty() || text(args, "search").is_some() {
            return Err(invalid(
                "preset reports do not accept filters; select a resource for filtered statistics",
            ));
        }
        let result = records::sql(c, query).await?;
        return Ok(if name == "overview" {
            result[0].clone()
        } else {
            result
        });
    }
    let (name, scope) = schema::resource(name);
    let tables = schema::load(c).await?;
    let table = tables
        .iter()
        .find(|t| t.name == name)
        .ok_or_else(|| invalid("unknown statistics resource"))?;
    records::aggregate(
        c,
        table,
        &Selection {
            filters: repeated(args, "where"),
            search: text(args, "search").map(str::to_owned),
            scope: scope.map(|(k, v)| (k.into(), v.into())),
        },
        &groups,
        &metrics,
        text(args, "order"),
        *args.get_one::<u32>("limit").expect("default limit"),
    )
    .await
}
