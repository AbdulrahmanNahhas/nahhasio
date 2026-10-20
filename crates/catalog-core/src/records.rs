//! Schema-checked operator operations. HTTP callers must add their own authorization.
use crate::{
    Result, invalid,
    schema::{self, Table},
};
use serde_json::{Map, Value, json};
use sqlx::{AssertSqlSafe, PgConnection, types::Json};

#[derive(Default)]
pub struct Selection {
    pub filters: Vec<String>,
    pub search: Option<String>,
    pub scope: Option<(String, String)>,
}

#[derive(Default)]
struct Predicate {
    sql: Vec<String>,
    values: Vec<Value>,
}
impl Predicate {
    fn bind(&mut self, value: Value) -> String {
        self.values.push(value);
        format!("${}::jsonb", self.values.len())
    }
    fn comparison(
        &mut self,
        table: &Table,
        name: &str,
        value: Value,
        operator: &str,
    ) -> Result<String> {
        table.column(name)?;
        let column = schema::quote(name)?;
        let bound = self.bind(value);
        Ok(format!(
            "t.{column} {operator} (jsonb_populate_record(null::{},jsonb_build_object('{name}',{bound}))).{column}",
            table.source()?
        ))
    }
    fn clause(&self) -> String {
        if self.sql.is_empty() {
            "true".into()
        } else {
            self.sql.join(" and ")
        }
    }
}

/// The type conversion is deliberately small: PostgreSQL validates dates, UUIDs and enum
/// constraints through jsonb_populate_record. Numeric strings retain decimal precision.
pub fn coerce(table: &Table, name: &str, raw: &str) -> Result<Value> {
    let column = table.column(name)?;
    if matches!(raw, "null" | "~null" | "\\N") {
        return Ok(Value::Null);
    }
    match column.data_type.as_str() {
        "bool" => match raw {
            "true" | "yes" | "1" | "on" => Ok(Value::Bool(true)),
            "false" | "no" | "0" | "off" => Ok(Value::Bool(false)),
            _ => Err(invalid("boolean values must be true or false")),
        },
        "json" | "jsonb" => Ok(serde_json::from_str(raw)?),
        name if name.starts_with('_') => {
            if raw.starts_with('[') {
                let value: Value = serde_json::from_str(raw)?;
                if !value.is_array() {
                    return Err(invalid("expected an array"));
                }
                Ok(value)
            } else {
                Ok(json!(
                    raw.split(',')
                        .map(str::trim)
                        .filter(|v| !v.is_empty())
                        .collect::<Vec<_>>()
                ))
            }
        }
        _ => Ok(Value::String(raw.to_owned())),
    }
}

fn predicate(table: &Table, selection: &Selection) -> Result<Predicate> {
    let mut output = Predicate::default();
    if let Some((column, value)) = &selection.scope {
        let condition = output.comparison(table, column, json!(value), "=")?;
        output.sql.push(condition);
    }
    for filter in &selection.filters {
        // Identify the operator at the first separator; '=' inside a value is data.
        let offset = filter
            .find([':', '!', '>', '<', '=', '~'])
            .ok_or_else(|| invalid("expected --where column=value"))?;
        let name = filter[..offset].trim();
        table.column(name)?;
        let rest = &filter[offset..];
        let (token, operator) = [
            (":nin=", "not in"),
            (":in=", "in"),
            ("!=", "<>"),
            (">=", ">="),
            ("<=", "<="),
            ("=", "="),
            (">", ">"),
            ("<", "<"),
            ("~", "ilike"),
        ]
        .into_iter()
        .find(|(token, _)| rest.starts_with(token))
        .ok_or_else(|| invalid("unsupported filter operator"))?;
        let raw = &rest[token.len()..];
        let reference = format!("t.{}", schema::quote(name)?);
        let condition = if matches!(operator, "=" | "<>") && matches!(raw, "null" | "~null" | "\\N")
        {
            format!(
                "{reference} is {}null",
                if operator == "<>" { "not " } else { "" }
            )
        } else if operator == "ilike" {
            let pattern = format!(
                "%{}%",
                raw.replace('\\', "\\\\")
                    .replace('%', "\\%")
                    .replace('_', "\\_")
            );
            let bound = output.bind(json!(pattern));
            format!("{reference}::text ilike ({bound} #>> '{{}}')")
        } else if matches!(operator, "in" | "not in") {
            let mut members = Vec::new();
            for value in raw.split(',').map(str::trim).filter(|v| !v.is_empty()) {
                let comparison =
                    output.comparison(table, name, coerce(table, name, value)?, "=")?;
                members.push(comparison);
            }
            if members.is_empty() {
                return Err(invalid("an IN filter needs at least one value"));
            }
            format!(
                "{}({})",
                if operator == "not in" { "not " } else { "" },
                members.join(" or ")
            )
        } else {
            output.comparison(table, name, coerce(table, name, raw)?, operator)?
        };
        output.sql.push(condition);
    }
    if let Some(search) = &selection.search {
        let pattern = output.bind(json!(search));
        let columns = table.reference_columns();
        if columns.is_empty() {
            return Err(invalid("use --where on a table without searchable names"));
        }
        let mut terms = columns
            .iter()
            .map(|column| {
                Ok(format!(
                    "strpos(lower(t.{}::text),lower({pattern} #>> '{{}}'))>0",
                    schema::quote(column)?
                ))
            })
            .collect::<Result<Vec<_>>>()?;
        if let Some((alias, owner, column)) = aliases(&table.name) {
            terms.push(format!("exists(select 1 from public.{alias} a where a.{owner}=t.id and strpos(lower(a.{column}),lower({pattern} #>> '{{}}'))>0)"));
        }
        output.sql.push(format!("({})", terms.join(" or ")));
    }
    Ok(output)
}

fn aliases(table: &str) -> Option<(&str, &str, &str)> {
    match table {
        "titles" => Some(("title_aliases", "title_id", "title")),
        "entities" => Some(("entity_aliases", "entity_id", "alias")),
        _ => None,
    }
}

pub async fn resolve(
    connection: &mut PgConnection,
    table: &Table,
    reference: &str,
    scope: Option<(String, String)>,
) -> Result<String> {
    let key = table.key()?;
    let names = table.reference_columns();
    let mut filter = predicate(
        table,
        &Selection {
            scope,
            ..Default::default()
        },
    )?;
    let bound = filter.bind(json!(reference));
    let source = table.source()?;
    let column = schema::quote(&key.name)?;
    let key_match = format!("t.{column}::text=({bound} #>> '{{}}')");
    let scope_sql = filter.clause();
    // Exact id, exact names/aliases, prefix, then substring. Every pass retains the scope.
    for pass in 0..4 {
        let mut terms = if pass == 0 {
            vec![key_match.clone()]
        } else {
            Vec::new()
        };
        if pass > 0 {
            for name in &names {
                let name = format!("lower(btrim(t.{}::text))", schema::quote(name)?);
                terms.push(reference_match(&name, &bound, pass));
            }
            if let Some((alias, owner, name)) = aliases(&table.name) {
                let comparison = reference_match(&format!("lower(btrim(a.{name}))"), &bound, pass);
                terms.push(format!(
                    "exists(select 1 from public.{alias} a where a.{owner}=t.id and {comparison})"
                ));
            }
        }
        if terms.is_empty() {
            continue;
        }
        let query = format!(
            "select t.{column}::text from {source} t where ({}) and ({scope_sql}) limit 2",
            terms.join(" or ")
        );
        let mut statement = sqlx::query_scalar::<_, String>(AssertSqlSafe(query));
        for value in &filter.values {
            statement = statement.bind(Json(value));
        }
        let rows = statement.fetch_all(&mut *connection).await?;
        match rows.as_slice() {
            [id] => return Ok(id.clone()),
            [] => (),
            _ => return Err(invalid("ambiguous reference; use an exact primary key")),
        }
    }
    Err(invalid("no matching record"))
}

fn reference_match(name: &str, bound: &str, pass: u8) -> String {
    let reference = format!("lower(btrim({bound} #>> '{{}}'))");
    match pass {
        1 => format!("{name}={reference}"),
        2 => format!("starts_with({name},{reference})"),
        _ => format!("strpos({name},{reference})>0"),
    }
}

pub struct Page {
    pub limit: u32,
    pub offset: u32,
    pub columns: Vec<String>,
    pub order: Option<String>,
    pub count: bool,
}
impl Default for Page {
    fn default() -> Self {
        Self {
            limit: 50,
            offset: 0,
            columns: vec![],
            order: None,
            count: false,
        }
    }
}

fn ordering(table: &Table, input: Option<&str>) -> Result<String> {
    let default = table
        .columns
        .iter()
        .filter(|column| column.primary)
        .map(|column| column.name.as_str())
        .collect::<Vec<_>>()
        .join(",");
    let input = input.unwrap_or(&default);
    if input.is_empty() {
        return Ok("to_jsonb(t)::text".into());
    }
    let mut output = Vec::new();
    for segment in input.split(',') {
        let words: Vec<_> = segment.split_whitespace().collect();
        let [name, tail @ ..] = words.as_slice() else {
            return Err(invalid("invalid sort order"));
        };
        table.column(name)?;
        let mut index = 0;
        let mut clause = format!("t.{}", schema::quote(name)?);
        if tail
            .first()
            .is_some_and(|value| matches!(*value, "asc" | "desc"))
        {
            clause.push(' ');
            clause.push_str(tail[0]);
            index += 1;
        }
        if tail.get(index) == Some(&"nulls")
            && tail
                .get(index + 1)
                .is_some_and(|value| matches!(*value, "first" | "last"))
        {
            clause.push_str(" nulls ");
            clause.push_str(tail[index + 1]);
            index += 2;
        }
        if index != tail.len() {
            return Err(invalid("invalid sort order"));
        }
        output.push(clause);
    }
    Ok(output.join(","))
}

pub async fn list(
    connection: &mut PgConnection,
    table: &Table,
    selection: &Selection,
    page: &Page,
) -> Result<Value> {
    if !(1..=500).contains(&page.limit) {
        return Err(invalid("--limit must be between 1 and 500"));
    }
    let filter = predicate(table, selection)?;
    let source = table.source()?;
    let clause = filter.clause();
    let projection = if page.columns.is_empty() {
        "to_jsonb(t)".into()
    } else {
        let mut fields = Vec::new();
        for column in &page.columns {
            table.column(column)?;
            fields.push(format!("'{column}',t.{}", schema::quote(column)?));
        }
        format!("jsonb_build_object({})", fields.join(","))
    };
    let query = if page.count {
        format!("select jsonb_build_object('count',count(*)) from {source} t where {clause}")
    } else {
        format!(
            "select {projection} from {source} t where {clause} order by {} limit {} offset {}",
            ordering(table, page.order.as_deref())?,
            page.limit,
            page.offset
        )
    };
    let mut statement = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query));
    for value in &filter.values {
        statement = statement.bind(Json(value));
    }
    let rows = statement.fetch_all(connection).await?;
    let rows: Vec<_> = rows
        .into_iter()
        .map(|row| crate::redaction::record(&table.name, row.0))
        .collect();
    if page.count {
        Ok(rows.into_iter().next().unwrap_or(json!({"count":0})))
    } else {
        Ok(json!(rows))
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Mutation {
    Create,
    Update,
    Delete,
}

/// Caller owns a SERIALIZABLE transaction: authorization, commit and rollback stay explicit.
pub async fn mutate(
    connection: &mut PgConnection,
    table: &Table,
    selection: &Selection,
    values: &Map<String, Value>,
    action: Mutation,
    confirm_many: bool,
    actor: Option<&str>,
) -> Result<Value> {
    if table.name.starts_with("auth_")
        || matches!(table.name.as_str(), "audit_logs" | "editorial_revisions")
    {
        return Err(invalid(
            "authentication and audit tables require a dedicated operation",
        ));
    }
    if action != Mutation::Create && selection.filters.is_empty() {
        return Err(invalid(
            "update/delete require a reference or --where; scope and search alone are insufficient",
        ));
    }
    if action != Mutation::Delete && values.is_empty() {
        return Err(invalid("no values supplied"));
    }
    for name in values.keys() {
        let column = table.column(name)?;
        if crate::redaction::protected(&table.name, name) {
            return Err(invalid(
                "secret fields require a dedicated credential operation",
            ));
        }
        if column.generated || (action == Mutation::Update && column.primary) {
            return Err(invalid(
                "generated columns and existing primary keys cannot be changed",
            ));
        }
    }
    if let Some((name, scope)) = &selection.scope
        && values
            .get(name)
            .is_some_and(|value| value.as_str() != Some(scope))
    {
        return Err(invalid("cannot change a scoped resource's kind"));
    }
    let mut filter = predicate(table, selection)?;
    let source = table.source()?;
    let clause = filter.clause();
    let before = if action == Mutation::Create {
        vec![]
    } else {
        let mut statement = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(format!(
            "select to_jsonb(t) from {source} t where {clause} order by {} limit 501 for update",
            ordering(table, None)?
        )));
        for value in &filter.values {
            statement = statement.bind(Json(value));
        }
        statement
            .fetch_all(&mut *connection)
            .await?
            .into_iter()
            .map(|row| row.0)
            .collect::<Vec<_>>()
    };
    if before.len() > 500 {
        return Err(invalid(
            "a mutation may affect at most 500 rows; use a smaller scope",
        ));
    }
    if before.len() > 1 && !confirm_many {
        return Err(invalid(
            "multiple rows match; review --dry-run then supply --yes",
        ));
    }
    let mut values = values.clone();
    if action == Mutation::Create
        && let Some((name, value)) = &selection.scope
    {
        values.insert(name.clone(), json!(value));
    }
    let bound = filter.bind(json!(values));
    let names = values
        .keys()
        .map(|name| schema::quote(name))
        .collect::<Result<Vec<_>>>()?;
    let query = match action {
        Mutation::Create => format!(
            "insert into {source} as t ({}) select {} from jsonb_populate_record(null::{source},{bound}) returning to_jsonb(t)",
            names.join(","),
            names.join(",")
        ),
        Mutation::Update => {
            let mut assignments = names
                .iter()
                .map(|name| format!("{name}=v.{name}"))
                .collect::<Vec<_>>();
            if table
                .columns
                .iter()
                .any(|column| column.name == "updated_at")
                && !values.contains_key("updated_at")
            {
                assignments.push("updated_at=clock_timestamp()".into());
            }
            format!(
                "update {source} t set {} from jsonb_populate_record(null::{source},{bound}) v where {clause} returning to_jsonb(t)",
                assignments.join(",")
            )
        }
        Mutation::Delete => {
            filter.values.pop();
            format!("delete from {source} t where {clause} returning to_jsonb(t)")
        }
    };
    let mut statement = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query));
    for value in &filter.values {
        statement = statement.bind(Json(value));
    }
    let rows = statement
        .fetch_all(&mut *connection)
        .await?
        .into_iter()
        .map(|row| row.0)
        .collect::<Vec<_>>();
    let verb = match action {
        Mutation::Create => "create",
        Mutation::Update => "update",
        Mutation::Delete => "delete",
    };
    let redacted_before: Vec<_> = before
        .into_iter()
        .map(|row| crate::redaction::record(&table.name, row))
        .collect();
    let rows: Vec<_> = rows
        .into_iter()
        .map(|row| crate::redaction::record(&table.name, row))
        .collect();
    if !rows.is_empty() {
        audit(
            connection,
            &format!("cli.{}.{}", table.name, verb),
            &table.name,
            actor,
            &json!({"before":redacted_before,"after":rows}),
        )
        .await?;
    }
    Ok(json!({"affected":rows.len(),"rows":rows}))
}

pub async fn audit(
    connection: &mut PgConnection,
    action: &str,
    target: &str,
    actor: Option<&str>,
    changes: &Value,
) -> Result<()> {
    let actor_id = if let Some(reference) = actor {
        let ids = sqlx::query_scalar::<_, String>(
            "select id::text from accounts where id::text=$1 or slug=$1 or display_name=$1 limit 2",
        )
        .bind(reference)
        .fetch_all(&mut *connection)
        .await?;
        match ids.as_slice() {
            [id] => Some(id.clone()),
            _ => return Err(invalid("operator actor is unknown or ambiguous")),
        }
    } else {
        None
    };
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,summary,changes) values($1::uuid,$2,$3,'Rust operator CLI',$4)")
        .bind(actor_id).bind(action).bind(target).bind(Json(changes)).execute(connection).await?;
    Ok(())
}

/// A single result-producing SQL statement. The CTE wrapper rejects transaction commands,
/// multi-statements and DDL, so none can escape the caller's rollback boundary.
pub async fn sql(connection: &mut PgConnection, statement: &str) -> Result<Value> {
    let statement = statement.trim().trim_end_matches(';').trim();
    if statement.is_empty() {
        return Err(invalid("empty SQL statement"));
    }
    let query = format!(
        "with nahhasio_result as ({statement}) select to_jsonb(r) from nahhasio_result r limit 501"
    );
    let rows = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query))
        .fetch_all(connection)
        .await?;
    if rows.len() > 500 {
        return Err(invalid("SQL results exceed 500 rows; add pagination"));
    }
    Ok(json!(rows.into_iter().map(|row| row.0).collect::<Vec<_>>()))
}

/// Bounded SQL aggregation using the same typed filters and scope as ordinary reads.
pub async fn aggregate(
    connection: &mut PgConnection,
    table: &Table,
    selection: &Selection,
    groups: &[String],
    metrics: &[String],
    order: Option<&str>,
    limit: u32,
) -> Result<Value> {
    let filter = predicate(table, selection)?;
    let mut selected = vec![];
    let mut aliases = std::collections::BTreeSet::new();
    for group in groups {
        table.column(group)?;
        if crate::redaction::protected(&table.name, group) {
            return Err(invalid("protected aggregation field"));
        }
        selected.push(format!("t.{}", schema::quote(group)?));
        aliases.insert(group.clone());
    }
    let metrics = if metrics.is_empty() {
        vec!["count".to_owned()]
    } else {
        metrics.to_vec()
    };
    for metric in metrics {
        let (kind, column) = metric.split_once(':').unwrap_or((&metric, ""));
        let (expression, alias) = if kind == "count" && column.is_empty() {
            ("count(*)".into(), "count".into())
        } else {
            if !["count-distinct", "avg", "sum", "min", "max"].contains(&kind) {
                return Err(invalid("unsupported aggregation metric"));
            }
            table.column(column)?;
            if crate::redaction::protected(&table.name, column) {
                return Err(invalid("protected aggregation field"));
            }
            let col = format!("t.{}", schema::quote(column)?);
            let alias = format!(
                "{}_{}",
                if kind == "count-distinct" {
                    "distinct"
                } else {
                    kind
                },
                column
            );
            let expression = match kind {
                "count-distinct" => format!("count(distinct {col})"),
                "avg" => format!("round(avg({col})::numeric,2)"),
                _ => format!("{kind}({col})"),
            };
            (expression, alias)
        };
        if !aliases.insert(alias.clone()) {
            return Err(invalid("duplicate aggregation output"));
        }
        selected.push(format!("{expression} as {}", schema::quote(&alias)?));
    }
    let ordering = if let Some(order) = order {
        let words: Vec<_> = order.split_whitespace().collect();
        let name = words
            .first()
            .ok_or_else(|| invalid("empty aggregate order"))?
            .trim_matches('"');
        if !aliases.contains(name) {
            return Err(invalid("order must name a selected group or metric"));
        }
        let suffix = words[1..].join(" ").to_lowercase();
        if ![
            "",
            "asc",
            "desc",
            "asc nulls first",
            "asc nulls last",
            "desc nulls first",
            "desc nulls last",
            "nulls first",
            "nulls last",
        ]
        .contains(&suffix.as_str())
        {
            return Err(invalid("invalid aggregate ordering"));
        }
        format!("{} {suffix}", schema::quote(name)?)
    } else {
        format!("{} desc nulls last", groups.len() + 1)
    };
    let group = if groups.is_empty() {
        String::new()
    } else {
        format!(
            "group by {}",
            (1..=groups.len())
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join(",")
        )
    };
    let query = format!(
        "select to_jsonb(result) from(select {} from {} t where {} {group} order by {ordering} limit {})result",
        selected.join(","),
        table.source()?,
        filter.clause(),
        limit.clamp(1, 500)
    );
    let mut statement = sqlx::query_scalar::<_, Json<Value>>(AssertSqlSafe(query));
    for value in filter.values {
        statement = statement.bind(Json(value));
    }
    Ok(json!(
        statement
            .fetch_all(connection)
            .await?
            .into_iter()
            .map(|v| v.0)
            .collect::<Vec<_>>()
    ))
}

/// Fixed catalog reports; the local CLI supplies no SQL through this registry.
pub fn report_presets() -> Result<Value> {
    Ok(serde_json::from_str(include_str!("reports.json"))?)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn table() -> Table {
        serde_json::from_value(json!({"name":"titles","columns":[{"name":"id","dataType":"uuid","nullable":false,"generated":false,"primary":true,"defaultValue":null,"referencesTable":null,"referencesColumn":null,"enumValues":[]},{"name":"canonical_title","dataType":"text","nullable":false,"generated":false,"primary":false,"defaultValue":null,"referencesTable":null,"referencesColumn":null,"enumValues":[]}]})).unwrap()
    }
    #[test]
    fn filters_bind_values_and_do_not_parse_operators_inside_values() {
        let filter = predicate(
            &table(),
            &Selection {
                filters: vec!["canonical_title=hello!=world".into()],
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(filter.values, vec![json!("hello!=world")]);
        assert!(!filter.clause().contains("world"));
        assert!(
            predicate(
                &table(),
                &Selection {
                    filters: vec!["id);delete=x".into()],
                    ..Default::default()
                }
            )
            .is_err()
        );
    }
    #[test]
    fn order_only_accepts_columns_directions_and_null_placement() {
        for value in [
            "id;delete",
            "id desc limit 1",
            "id nulls",
            "missing",
            "id asc desc",
        ] {
            assert!(ordering(&table(), Some(value)).is_err());
        }
        assert_eq!(
            ordering(&table(), Some("id desc nulls last")).unwrap(),
            "t.\"id\" desc nulls last"
        );
    }
}
