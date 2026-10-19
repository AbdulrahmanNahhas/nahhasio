//! Explicit diagnostic feature: real loopback-only peers and native gateway, no catalog writes.
use crate::{
    media::ResolvedTarget, media_gateway::Gateway, player::Player, player_protocol::Command,
    torrentio,
};
use media_transfer::{Engine, File, NetworkPolicy, TorrentId};
use std::{
    rc::Rc,
    sync::Arc,
    time::{Duration, Instant},
};

pub struct Fixture {
    _directories: Vec<tempfile::TempDir>,
    _seed: Engine,
}

pub async fn install(
    player: &Rc<Player>,
    runtime: Arc<tokio::runtime::Runtime>,
) -> Result<Fixture, String> {
    let path = std::env::var_os("NAHHASIO_PLAY_FILE").ok_or("A generated fixture is required")?;
    let (fixture, target_engine, id, file) = runtime
        .spawn_blocking(move || prepare(std::path::Path::new(&path)))
        .await
        .map_err(|_| "Torrent fixture task failed")??;
    let title = "Native torrent diagnostic".to_owned();
    player
        .execute(Command::Preview {
            title: title.clone(),
        })
        .await
        .map_err(|error| error.message)?;
    let session = player
        .snapshot()
        .session_id
        .ok_or("Missing diagnostic player session")?;
    let engine = target_engine.clone();
    let lease_id = id.clone();
    let index = file.index;
    let lease = runtime
        .spawn_blocking(move || engine.playback_lease(&lease_id, vec![index]))
        .await
        .map_err(|_| "Could not create diagnostic playback lease")?
        .map_err(|_| "Could not select diagnostic media")?;
    let gateway = runtime
        .spawn(async move { Gateway::start(target_engine, id, file, lease).await })
        .await
        .map_err(|_| "Could not start diagnostic gateway")?
        .map_err(|_| "Could not bind diagnostic gateway")?;
    player
        .play_torrent(
            &session,
            ResolvedTarget {
                poster_id: None,
                work_id: "00000000-0000-4000-8000-000000000000".into(),
                installment_id: "00000000-0000-4000-8000-000000000001".into(),
                episode_id: None,
                work_title: title.clone(),
                title,
                search: torrentio::Search {
                    imdb_id: "tt0000000".into(),
                    kind: torrentio::Kind::Movie,
                    season: None,
                    episode: None,
                },
            },
            gateway,
        )
        .map_err(|error| error.message)?;
    Ok(fixture)
}

fn prepare(path: &std::path::Path) -> Result<(Fixture, Engine, TorrentId, File), String> {
    let directories: Vec<tempfile::TempDir> = (0..5)
        .map(|_| tempfile::tempdir())
        .collect::<Result<_, _>>()
        .map_err(|_| "Could not create private fixture directories")?;
    let input = directories[0].path().join("fixture");
    std::fs::create_dir(&input).map_err(|_| "Fixture directory is unavailable")?;
    std::fs::copy(path, input.join("movie.mp4")).map_err(|_| "Generated fixture is unavailable")?;
    std::fs::write(input.join("readme.txt"), [b'x'; 32])
        .map_err(|_| "Fixture sidecar is unavailable")?;
    let meta = media_transfer::fixture_metainfo(directories[0].path(), 3)
        .map_err(|_| "Could not encode hybrid fixture")?;
    let seed = Engine::open_with_network(
        directories[1].path(),
        directories[2].path(),
        NetworkPolicy::LoopbackOnly,
    )
    .map_err(|_| "Could not start loopback seeder")?;
    let id = seed
        .import_torrent(meta.clone())
        .map_err(|_| "Could not import fixture")?;
    let payload = directories[2].path().join(&id.0).join("fixture");
    std::fs::create_dir_all(&payload).map_err(|_| "Seeder storage is unavailable")?;
    std::fs::copy(input.join("movie.mp4"), payload.join("movie.mp4"))
        .map_err(|_| "Could not stage seeder media")?;
    std::fs::copy(input.join("readme.txt"), payload.join("readme.txt"))
        .map_err(|_| "Could not stage seeder sidecar")?;
    // Restore only after staging so the engine's asynchronous storage check sees all bytes.
    drop(seed);
    let seed = Engine::open_with_network(
        directories[1].path(),
        directories[2].path(),
        NetworkPolicy::LoopbackOnly,
    )
    .map_err(|_| "Could not restore loopback seeder")?;
    let files = seed
        .files(&id)
        .map_err(|_| "Could not validate fixture files")?;
    seed.select_download(
        &id,
        files
            .iter()
            .filter(|file| media_transfer::is_video(&file.path))
            .map(|file| file.index)
            .collect(),
    )
    .map_err(|_| "Could not select fixture")?;
    seed.start(&id)
        .map_err(|_| "Could not start fixture verification")?;
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        if seed
            .status(&id)
            .map_err(|_| "Could not inspect fixture")?
            .complete
        {
            break;
        }
        if Instant::now() >= deadline {
            return Err("Seeder hash verification timed out".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let engine = Engine::open_with_network(
        directories[3].path(),
        directories[4].path(),
        NetworkPolicy::LoopbackOnly,
    )
    .map_err(|_| "Could not start loopback leecher")?;
    let target_id = engine
        .import_torrent(meta)
        .map_err(|_| "Could not import leecher fixture")?;
    let file = engine
        .files(&target_id)
        .map_err(|_| "Could not inspect leecher files")?
        .into_iter()
        .find(|file| file.path.ends_with("movie.mp4"))
        .ok_or("Fixture has no video")?;
    engine
        .start(&target_id)
        .map_err(|_| "Could not start loopback transfer")?;
    engine
        .connect_loopback_peer(
            &target_id,
            seed.listen_port()
                .map_err(|_| "Seeder port is unavailable")?,
        )
        .map_err(|_| "Could not connect controlled peers")?;
    Ok((
        Fixture {
            _directories: directories,
            _seed: seed,
        },
        engine,
        target_id,
        file,
    ))
}
