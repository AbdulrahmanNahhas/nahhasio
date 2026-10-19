use serde_json::Value;

pub enum Format {
    Table,
    Ndjson,
    Csv,
}

fn cell(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        value => value.to_string(),
    }
}
fn terminal(value: &str, wide: bool) -> String {
    // Catalog text is untrusted terminal input; never emit escape/control sequences.
    let value = value
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect::<String>();
    if !wide && value.chars().count() > 60 {
        format!("{}…", value.chars().take(59).collect::<String>())
    } else {
        value
    }
}
fn csv(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.into()
    }
}
pub fn render(value: &Value, format: Format, wide: bool) -> String {
    let rows = match value {
        Value::Array(rows) => rows.iter().collect::<Vec<_>>(),
        value => vec![value],
    };
    if matches!(format, Format::Ndjson) {
        return rows
            .iter()
            .map(|value| value.to_string())
            .collect::<Vec<_>>()
            .join("\n");
    }
    let mut columns = Vec::new();
    for row in &rows {
        if let Some(row) = row.as_object() {
            for name in row.keys() {
                if !columns.contains(name) {
                    columns.push(name.clone());
                }
            }
        }
    }
    if columns.is_empty() {
        return if rows.is_empty() {
            "(no rows)".into()
        } else {
            terminal(&cell(value), wide)
        };
    }
    let body = rows
        .iter()
        .map(|row| {
            columns
                .iter()
                .map(|name| cell(&row[name]))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    if matches!(format, Format::Csv) {
        return std::iter::once(
            columns
                .iter()
                .map(|value| csv(value))
                .collect::<Vec<_>>()
                .join(","),
        )
        .chain(body.iter().map(|row| {
            row.iter()
                .map(|value| csv(value))
                .collect::<Vec<_>>()
                .join(",")
        }))
        .collect::<Vec<_>>()
        .join("\n");
    }
    let mut lines = vec![columns];
    lines.extend(body);
    let lines = lines
        .into_iter()
        .map(|line| {
            line.into_iter()
                .map(|value| terminal(&value, wide))
                .collect::<Vec<_>>()
        })
        .collect::<Vec<_>>();
    let widths = (0..lines[0].len())
        .map(|column| {
            lines
                .iter()
                .map(|line| line[column].chars().count())
                .max()
                .unwrap_or(0)
        })
        .collect::<Vec<_>>();
    lines
        .iter()
        .map(|line| {
            line.iter()
                .enumerate()
                .map(|(column, value)| {
                    format!(
                        "{value}{}",
                        " ".repeat(widths[column].saturating_sub(value.chars().count()))
                    )
                })
                .collect::<Vec<_>>()
                .join("  ")
                .trim_end()
                .to_owned()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn terminal_text_cannot_inject_escapes_and_csv_preserves_quotes() {
        let value = json!([{"title":"\u{1b}[31mفيلم, \"test\"\n"}]);
        assert!(!render(&value, Format::Table, false).contains('\u{1b}'));
        assert!(render(&value, Format::Csv, false).contains("\"\"test\"\""));
        assert!(render(&value, Format::Ndjson, false).contains("\\u001b"));
    }
}
