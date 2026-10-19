use std::{env, fs, path::PathBuf};

fn main() {
    let root = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"))
        .join("../../packages/database/drizzle");
    println!("cargo:rerun-if-changed={}", root.display());
    let mut paths = fs::read_dir(&root)
        .expect("single migration history")
        .map(|entry| entry.expect("migration directory entry").path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "sql"))
        .collect::<Vec<_>>();
    paths.sort();
    let mut output = String::from("&[\n");
    for path in paths {
        let tag = path
            .file_stem()
            .expect("SQL filename")
            .to_str()
            .expect("UTF-8 filename");
        output.push_str(&format!(
            "({tag:?},include_str!({:?})),\n",
            path.canonicalize().expect("migration source")
        ));
    }
    output.push(']');
    fs::write(
        PathBuf::from(env::var_os("OUT_DIR").expect("Cargo output directory"))
            .join("migrations.rs"),
        output,
    )
    .expect("embedded migration manifest");
}
