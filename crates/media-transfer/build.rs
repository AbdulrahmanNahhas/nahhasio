fn main() {
    let lib = pkg_config::Config::new()
        .atleast_version("2.0.12")
        .probe("libtorrent-rasterbar")
        .expect("libtorrent-rasterbar 2.0.12 development files are required");
    let mut bridge = cxx_build::bridge("src/bridge.rs");
    let mut build = cc::Build::new();
    let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
    build
        .cpp(true)
        .file("native/engine.cc")
        .include(out.join("cxxbridge/include"))
        .include(out.join("cxxbridge/crate"));
    for compiler in [&mut bridge, &mut build] {
        compiler.include(".").std("c++17").opt_level(1);
        for path in &lib.include_paths {
            compiler.include(path);
        }
        for (name, value) in &lib.defines {
            compiler.define(name, value.as_deref());
        }
    }
    if bridge.get_compiler().is_like_gnu() {
        // CXX declares Vec's initializing Rust shim with a const pointer. GCC
        // mistakes it for a read; the shim only ptr::write's a new RustVec.
        // Limit this workaround to generated code; engine.cc keeps the warning.
        bridge.flag("-Wno-maybe-uninitialized");
    }
    bridge.compile("media-transfer-bridge");
    // clangd needs the same Nix compiler flags and generated CXX include paths as Cargo.
    let compiler = build.get_compiler();
    let manifest = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let directory = manifest.join("../../target/media-transfer-clangd");
    std::fs::create_dir_all(&directory).expect("create clangd database directory");
    let file = manifest.join("native/engine.cc");
    let mut arguments = vec![compiler.path().to_string_lossy().into_owned()];
    arguments.extend(
        compiler
            .args()
            .iter()
            .map(|argument| argument.to_string_lossy().into_owned()),
    );
    arguments.extend(["-c".into(), file.to_string_lossy().into_owned()]);
    let database =
        serde_json::json!([{ "directory": manifest, "file": file, "arguments": arguments }]);
    std::fs::write(
        directory.join("compile_commands.json"),
        database.to_string(),
    )
    .expect("write clangd compilation database");
    build.compile("media-transfer-native");
    println!("cargo:rerun-if-changed=src/bridge.rs");
    println!("cargo:rerun-if-changed=native/engine.h");
    println!("cargo:rerun-if-changed=native/engine.cc");
}
