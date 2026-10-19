use super::*;

#[test]
fn non_video_payload_cannot_be_selected_read_or_exported() {
    for path in [
        "movie.mkv.exe",
        "movie.desktop",
        "playlist.m3u8",
        "movie.zip",
        "readme.txt",
        "movie.url",
        "../movie.mp4",
        "movie\n.mp4",
    ] {
        assert!(!is_video(path), "{path}");
    }
    assert!(is_video("فيلم/حلقة.MKV"));
    let state = tempfile::tempdir().unwrap();
    let payload = tempfile::tempdir().unwrap();
    let fixture = tempfile::tempdir().unwrap();
    let input = fixture.path().join("fixture");
    std::fs::create_dir(&input).unwrap();
    std::fs::write(input.join("movie.mp4"), [7_u8; 32768]).unwrap();
    std::fs::write(input.join("readme.txt"), [0_u8; 32]).unwrap();
    let engine =
        Engine::open_with_network(state.path(), payload.path(), NetworkPolicy::LoopbackOnly)
            .unwrap();
    let id = engine
        .import_torrent(ffi::fixture(fixture.path().to_str().unwrap(), 1).unwrap())
        .unwrap();
    let file = engine
        .files(&id)
        .unwrap()
        .into_iter()
        .find(|file| file.path.ends_with(".txt"))
        .unwrap();
    assert!(engine.select_download(&id, vec![file.index]).is_err());
    assert!(engine.keep_file(&id, file.index).is_err());
    assert!(engine.playback_lease(&id, vec![file.index]).is_err());
    assert!(
        engine
            .keep_export(&id, file.index, payload.path(), "fixture")
            .is_err()
    );
    assert!(
        engine
            .read_range(
                &id,
                file.index,
                0,
                1,
                Duration::from_millis(1),
                &Cancellation::default()
            )
            .is_err()
    );
    assert!(engine.jobs().unwrap()[0].selected.is_empty());
    drop(engine);
    let db = Connection::open(state.path().join("jobs.sqlite3")).unwrap();
    assert_eq!(
        db.query_row("select count(*) from exports", [], |row| row
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn paths_and_ranges() {
    for path in ["../a", "/a", "a/../b", "a\\b", "C:a", "a//b", "a/./b"] {
        assert!(validate_path(path).is_err());
    }
    assert!(validate_path("فيلم/episode.mkv").is_ok());
    assert!(validate_range(10, 8, 2).is_ok());
    assert!(validate_range(10, 8, 3).is_err());
    assert!(validate_range(u64::MAX, u64::MAX, 1).is_err());
}

#[test]
fn store_reopens_and_rejects_future_and_corrupt() {
    let root = tempfile::tempdir().unwrap();
    let open = || {
        Engine::open_with_network(
            root.path(),
            root.path().join("media"),
            NetworkPolicy::LoopbackOnly,
        )
    };
    let engine = open().unwrap();
    assert!(engine.jobs().unwrap().is_empty());
    assert!(
        open().is_err(),
        "a second owner must not access the same job store"
    );
    drop(engine);
    drop(open().unwrap());
    let db = Connection::open(root.path().join("jobs.sqlite3")).unwrap();
    db.pragma_update(None, "user_version", 999).unwrap();
    drop(db);
    assert!(open().is_err());
    let corrupt = tempfile::tempdir().unwrap();
    std::fs::write(corrupt.path().join("jobs.sqlite3"), b"not sqlite").unwrap();
    assert!(
        Engine::open_with_network(
            corrupt.path(),
            corrupt.path().join("media"),
            NetworkPolicy::LoopbackOnly
        )
        .is_err()
    );
}

#[test]
fn legacy_v2_jobs_keep_their_payload_location() {
    let state = tempfile::tempdir().unwrap();
    let videos = tempfile::tempdir().unwrap();
    let fixture = tempfile::tempdir().unwrap();
    std::fs::create_dir(fixture.path().join("fixture")).unwrap();
    std::fs::write(fixture.path().join("fixture/movie.mp4"), [7_u8; 32768]).unwrap();
    std::fs::write(fixture.path().join("fixture/readme.txt"), [0_u8; 32]).unwrap();
    let meta = ffi::fixture(fixture.path().to_str().unwrap(), 1).unwrap();
    let engine =
        Engine::open_with_network(state.path(), videos.path(), NetworkPolicy::LoopbackOnly)
            .unwrap();
    let id = engine.import_torrent(meta).unwrap();
    drop(engine);
    let db = Connection::open(state.path().join("jobs.sqlite3")).unwrap();
    db.execute_batch(
        "DROP TABLE exports; ALTER TABLE jobs DROP COLUMN payload_root; PRAGMA user_version=2;",
    )
    .unwrap();
    drop(db);
    let private = state.path().join("payloads");
    let restored = Engine::open_roots(
        state.path(),
        videos.path(),
        Some(private.clone()),
        NetworkPolicy::LoopbackOnly,
    )
    .unwrap();
    assert_eq!(restored.jobs().unwrap()[0].id.0, id.0);
    assert!(restored.jobs().unwrap()[0].recovery_error.is_none());
    assert!(videos.path().join(&id.0).exists());
    assert!(!private.join(&id.0).exists());
    assert_eq!(
        restored.delete_cache().unwrap().skipped,
        1,
        "legacy Videos directories must not be deleted"
    );
    std::fs::write(fixture.path().join("fixture/movie.mp4"), [8_u8; 32768]).unwrap();
    let new = restored
        .import_torrent(ffi::fixture(fixture.path().to_str().unwrap(), 1).unwrap())
        .unwrap();
    assert!(private.join(&new.0).exists());
    assert!(!videos.path().join(&new.0).exists());
}

#[test]
fn private_cache_cleanup_preserves_unfinished_downloads_and_rejects_symlinks() {
    let state = tempfile::tempdir().unwrap();
    let videos = tempfile::tempdir().unwrap();
    let fixture = tempfile::tempdir().unwrap();
    let fixture_dir = fixture.path().join("fixture");
    std::fs::create_dir(&fixture_dir).unwrap();
    std::fs::write(fixture_dir.join("movie.mp4"), [7_u8; 32768]).unwrap();
    std::fs::write(fixture_dir.join("readme.txt"), [0_u8; 32]).unwrap();
    let payloads = state.path().join("payloads");
    let engine = Engine::open_roots(
        state.path(),
        videos.path(),
        Some(payloads.clone()),
        NetworkPolicy::LoopbackOnly,
    )
    .unwrap();
    let meta = ffi::fixture(fixture.path().to_str().unwrap(), 1).unwrap();
    let id = engine.import_torrent(meta.clone()).unwrap();
    let movie = engine
        .files(&id)
        .unwrap()
        .into_iter()
        .find(|file| file.path.ends_with(".mp4"))
        .unwrap();
    engine
        .keep_export(&id, movie.index, videos.path(), "Test work")
        .unwrap();
    assert_eq!(engine.delete_cache().unwrap().skipped, 1);
    assert!(payloads.join(&id.0).exists());
    engine.remove_download(&id).unwrap();
    // Removing interest alone must not discard an unfinished durable export.
    assert_eq!(engine.delete_cache().unwrap().skipped, 1);
    let fresh_state = tempfile::tempdir().unwrap();
    let fresh_payloads = fresh_state.path().join("payloads");
    let fresh = Engine::open_roots(
        fresh_state.path(),
        videos.path(),
        Some(fresh_payloads.clone()),
        NetworkPolicy::LoopbackOnly,
    )
    .unwrap();
    let fresh_id = fresh.import_torrent(meta).unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("keep.txt"), b"keep").unwrap();
    let link = fresh_payloads.join(&fresh_id.0).join("unsafe-link");
    std::os::unix::fs::symlink(outside.path(), &link).unwrap();
    assert!(fresh.delete_cache().is_err());
    assert_eq!(
        std::fs::read(outside.path().join("keep.txt")).unwrap(),
        b"keep"
    );
    std::fs::remove_file(link).unwrap();
    assert_eq!(fresh.delete_cache().unwrap().removed, 1);
    assert!(!fresh_payloads.join(&fresh_id.0).exists());
}

fn wait_complete(engine: &Engine, id: &TorrentId) {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        let status = engine.status(id).unwrap();
        assert!(status.error.is_none(), "{status:?}");
        if status.complete {
            break;
        }
        assert!(Instant::now() < deadline, "completion timeout: {status:?}");
        thread::sleep(Duration::from_millis(50));
    }
}

#[test]
fn controlled_loopback_formats_selection_promotion_and_restart() {
    for version in [1, 2, 3] {
        let fixture_root = tempfile::tempdir().unwrap();
        let data: Vec<u8> = (0..65536).map(|i| (i % 251) as u8).collect();
        let fixture_dir = fixture_root.path().join("fixture");
        std::fs::create_dir(&fixture_dir).unwrap();
        std::fs::write(fixture_dir.join("movie.mp4"), &data).unwrap();
        std::fs::write(fixture_dir.join("readme.txt"), [b'x'; 32]).unwrap();
        let meta = ffi::fixture(fixture_root.path().to_str().unwrap(), version).unwrap();
        let seed_state = tempfile::tempdir().unwrap();
        let seed_media = tempfile::tempdir().unwrap();
        let seed = Engine::open_with_network(
            seed_state.path(),
            seed_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        let id = seed.import_torrent(meta.clone()).unwrap();
        let storage = seed_media.path().join(&id.0).join("fixture");
        std::fs::create_dir_all(&storage).unwrap();
        std::fs::copy(fixture_dir.join("movie.mp4"), storage.join("movie.mp4")).unwrap();
        std::fs::copy(fixture_dir.join("readme.txt"), storage.join("readme.txt")).unwrap();
        // Storage hashing must start after fixture bytes are staged. Importing first and
        // copying into a live checking handle races the initial asynchronous recheck.
        drop(seed);
        let seed = Engine::open_with_network(
            seed_state.path(),
            seed_media.path(),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        let seed_files = seed.files(&id).unwrap();
        seed.select_download(
            &id,
            seed_files
                .iter()
                .filter(|file| is_video(&file.path))
                .map(|f| f.index)
                .collect(),
        )
        .unwrap();
        seed.start(&id).unwrap();
        wait_complete(&seed, &id);
        let target_state = tempfile::tempdir().unwrap();
        let target_media = tempfile::tempdir().unwrap();
        let private_payloads = target_state.path().join("payloads");
        let target = Engine::open_roots(
            target_state.path(),
            target_media.path(),
            Some(private_payloads.clone()),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        let target_id = target.import_torrent(meta.clone()).unwrap();
        assert_eq!(id.0, target_id.0);
        assert_eq!(target.import_torrent(meta).unwrap().0, id.0);
        assert_eq!(target.jobs().unwrap().len(), 1);
        let movie = target
            .files(&id)
            .unwrap()
            .into_iter()
            .find(|f| f.path.ends_with(".mp4"))
            .unwrap();
        assert_eq!(
            std::fs::read_dir(target_media.path()).unwrap().count(),
            0,
            "watching must not create a torrent directory in Videos"
        );
        assert!(private_payloads.join(&id.0).exists());
        let lease = target.playback_lease(&id, vec![movie.index]).unwrap();
        assert!(target.status(&id).unwrap().paused);
        let cleanup = target.delete_cache().unwrap();
        assert_eq!(cleanup.removed, 0);
        assert_eq!(
            cleanup.skipped, 1,
            "active playback must survive cache cleanup"
        );
        target.start(&id).unwrap();
        target
            .connect_loopback_peer(&id, seed.listen_port().unwrap())
            .unwrap();
        let actual = target
            .read_range(
                &id,
                movie.index,
                8193,
                32768,
                Duration::from_secs(20),
                &Cancellation::default(),
            )
            .unwrap();
        assert_eq!(actual, data[8193..8193 + 32768]);
        target
            .keep_export(
                &id,
                movie.index,
                target_media.path(),
                "Frieren Beyond Journey's End",
            )
            .unwrap();
        drop(lease);
        wait_complete(&target, &id);
        target.set_export_target(&id, movie.index, "{\"workId\":\"00000000-0000-4000-8000-000000000001\",\"installmentId\":\"00000000-0000-4000-8000-000000000002\",\"episodeId\":null}".into()).unwrap();
        target.export_completed().unwrap();
        assert!(target.saved_files().unwrap()[0].available);
        let exported = target_media
            .path()
            .join("Frieren Beyond Journey's End/movie.mp4");
        assert_eq!(std::fs::read(&exported).unwrap(), data);
        target.export_completed().unwrap();
        assert!(
            target
                .keep_export(&id, movie.index, target_media.path(), "another work")
                .is_err()
        );
        target.pause(&id).unwrap();
        target.checkpoint().unwrap();
        drop(target);
        let restored = Engine::open_roots(
            target_state.path(),
            target_media.path(),
            Some(private_payloads.clone()),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        assert_eq!(restored.jobs().unwrap()[0].selected, vec![movie.index]);
        assert!(restored.status(&id).unwrap().paused);
        restored.start(&id).unwrap();
        wait_complete(&restored, &id);
        assert_eq!(
            restored
                .read_range(
                    &id,
                    movie.index,
                    0,
                    data.len(),
                    Duration::from_secs(5),
                    &Cancellation::default()
                )
                .unwrap(),
            data
        );
        let cancel = Cancellation::default();
        cancel.cancel();
        assert!(matches!(
            restored.read_range(&id, movie.index, 0, 1, Duration::from_secs(1), &cancel),
            Err(Error::Cancelled)
        ));
        drop(restored);
        drop(seed);
        std::fs::write(
            private_payloads.join(&id.0).join(&movie.path),
            vec![0u8; data.len()],
        )
        .unwrap();
        let damaged = Engine::open_roots(
            target_state.path(),
            target_media.path(),
            Some(private_payloads.clone()),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        damaged.start(&id).unwrap();
        assert!(matches!(
            damaged.read_range(
                &id,
                movie.index,
                0,
                1024,
                Duration::from_millis(500),
                &Cancellation::default()
            ),
            Err(Error::Timeout)
        ));
        assert!(!damaged.status(&id).unwrap().complete);
        let cleanup = damaged.delete_cache().unwrap();
        assert_eq!(cleanup.removed, 1);
        assert!(!private_payloads.join(&id.0).exists());
        assert!(damaged.jobs().unwrap().is_empty());
        assert_eq!(std::fs::read(&exported).unwrap(), data);
        assert!(damaged.saved_files().unwrap()[0].available);
        drop(damaged);
        let cleaned = Engine::open_roots(
            target_state.path(),
            target_media.path(),
            Some(private_payloads),
            NetworkPolicy::LoopbackOnly,
        )
        .unwrap();
        assert!(cleaned.jobs().unwrap().is_empty());
        assert!(cleaned.saved_files().unwrap()[0].available);
        std::fs::remove_file(&exported).unwrap();
        assert!(
            !cleaned.saved_files().unwrap()[0].available,
            "missing saved files must not be reported as downloaded"
        );
    }
}
