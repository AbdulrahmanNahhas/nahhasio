/** Constraint acceptance against a restored database only; every fixture is rolled back. */
import { randomUUID, createHash } from "node:crypto";

import postgres from "postgres";

export async function verifyFoundation(sql: postgres.Sql) {
  const [database] = await sql<{ name: string }[]>`select current_database() name`;
  if (
    !(
      database?.name.startsWith("nahhasio_schema_rehearsal_") ||
      /^nahhasio_baseline_[a-f0-9]{32}$/.test(database?.name ?? "")
    )
  )
    throw new Error("Foundation acceptance requires a disposable rehearsal database.");
  let assertions = 0;
  const check = (condition: boolean, description: string) => {
    if (!condition) throw new Error(description);
    assertions += 1;
  };
  const rollback = new Error("Foundation fixture rollback");
  try {
    await sql.begin(async (tx) => {
      const rejects = async (
        operation: (
          savepoint: postgres.TransactionSql,
        ) => PromiseLike<postgres.RowList<postgres.Row[]>>,
      ) => {
        let rejected = false;
        try {
          await tx.savepoint(async (savepoint) => {
            await operation(savepoint);
          });
        } catch (error) {
          if (!(error instanceof postgres.PostgresError) || !error.code.startsWith("23"))
            throw error;
          rejected = true;
        }
        check(rejected, "Expected a database integrity rejection.");
      };
      const work = randomUUID(),
        part = randomUUID(),
        episode = randomUUID(),
        anotherPart = randomUUID();
      const person = randomUUID(),
        organization = randomUUID(),
        role = randomUUID(),
        account = randomUUID();
      await tx`insert into titles(id,canonical_title,sort_title,dub_languages,playback_policy) values(${work},'Foundation fixture','foundation fixture',ARRAY['ar','es'],'files-only')`;
      await tx`insert into installments(id,title_id,kind,position,title) values(${part},${work},'season',0,'Fixture'),(${anotherPart},${work},'season',1,'Other fixture')`;
      await tx`insert into episodes(id,installment_id,number,position) values(${episode},${part},1,0)`;
      await tx`insert into accounts(id,kind,status,display_name) values(${account},'personal','active','Foundation fixture')`;
      await rejects((s) => s`update titles set dub_languages=ARRAY['ar','ar'] where id=${work}`);
      await rejects(
        (s) => s`update titles set dub_languages=ARRAY['not a language'] where id=${work}`,
      );
      await rejects(
        (s) => s`update titles set playback_policy='torrent-stream-on-server' where id=${work}`,
      );

      const planets = await tx<{ id: string }[]>`select id from planets order by id limit 2`;
      if (planets.length === 2) {
        await tx`insert into title_planets(title_id,planet_id) values(${work},${planets[0]!.id})`;
        await rejects(
          (s) => s`insert into title_planets(title_id,planet_id) values(${work},${planets[1]!.id})`,
        );
      }
      await tx`insert into entities(id,kind,name,sort_name) values(${person},'person','Fixture person',${person}),(${organization},'organization','Fixture organization',${organization})`;
      await tx`insert into roles(id,slug,label_en,label_ar,entity_kind) values(${role},${`fixture_${role.replaceAll("-", "")}`},'Fixture','اختبار','organization')`;
      await tx`insert into contributions(title_id,entity_id,role_id,languages) values(${work},${organization},${role},ARRAY['ar'])`;
      await rejects(
        (s) =>
          s`insert into contributions(title_id,entity_id,role_id) values(${work},${person},${role})`,
      );
      await rejects((s) => s`update roles set entity_kind='person' where id=${role}`);
      await rejects((s) => s`update entities set kind='person' where id=${organization}`);

      await tx`insert into external_identities(title_id,provider,external_id) values(${work},'Fixture','same')`;
      await rejects(
        (s) =>
          s`insert into external_identities(title_id,provider,external_id) values(${work},' fixture ','same')`,
      );
      await tx`insert into title_trailers(title_id,youtube_video_id,is_primary) values(${work},'abcdefghijk',true)`;
      await rejects(
        (s) => s`insert into title_trailers(title_id,youtube_video_id) values(${work},'invalid')`,
      );
      await rejects(
        (s) =>
          s`insert into title_trailers(title_id,youtube_video_id,is_primary) values(${work},'lmnopqrstuv',true)`,
      );
      const image = randomUUID(),
        imageHash = createHash("sha256").update(image).digest("hex");
      await tx`insert into media_assets(id,path,sha256,mime_type,byte_size,width,height,original_filename) values(${image},${`/media/fixture-${image}.avif`},${imageHash},'image/avif',1,1,1,'fixture.avif')`;
      await tx`insert into media_asset_assignments(asset_id,role,episode_id,is_primary) values(${image},'still',${episode},true)`;
      await rejects((s) => s`update media_assets set variant_of_asset_id=id where id=${image}`);
      await rejects(
        (s) => s`update media_assets set variant_of_asset_id=${randomUUID()} where id=${image}`,
      );

      const library = randomUUID(),
        file = randomUUID(),
        installation = randomUUID();
      await tx`insert into library_roots(id,name,path) values(${library},'Fixture','/fixture')`;
      await tx`insert into media_files(id,episode_id,path,library_root_id,relative_path) values(${file},${episode},'/fixture/episode.mkv',${library},'episode.mkv')`;
      await rejects(
        (s) => s`update media_files set relative_path='../escape.mkv' where id=${file}`,
      );
      await tx`insert into media_tracks(media_file_id,kind,source,relative_path,language,is_hearing_impaired) values(${file},'subtitle','external','episode.ar.srt','ar',true)`;
      await tx`insert into media_tracks(media_file_id,kind,stream_index,language) values(${file},'audio',1,'ar')`;
      await rejects(
        (s) =>
          s`insert into media_tracks(media_file_id,kind,source,relative_path) values(${file},'audio','external','audio.aac')`,
      );
      await rejects((s) => s`insert into media_tracks(media_file_id,kind) values(${file},'audio')`);
      await tx`insert into devices(installation_id) values(${installation})`;
      await rejects(
        (s) =>
          s`insert into account_downloads(account_id,installment_id,episode_id,device_id,path) values(${account},${anotherPart},${episode},${installation},'/fixture/episode.mkv')`,
      );

      await tx`insert into account_playback_states(account_id,installment_id,episode_id) values(${account},${part},${episode})`;
      await tx`update account_playback_states set position_seconds=5 where account_id=${account} and installment_id=${part}`;
      const [playback] = await tx<
        { revision: string }[]
      >`select revision from account_playback_states where account_id=${account} and installment_id=${part}`;
      check(String(playback?.revision) === "1", "Playback revision did not advance.");
      await tx`insert into title_reviews(account_id,title_id,rating) values(${account},${work},4)`;
      const [rating] = await tx<
        { personal_rating: number }[]
      >`select personal_rating from account_title_states where account_id=${account} and title_id=${work}`;
      check(rating?.personal_rating === 4, "Review did not update the canonical personal rating.");
      await tx`update account_title_states set personal_rating=null where account_id=${account} and title_id=${work}`;
      const [review] = await tx<
        { rating: number | null }[]
      >`select rating from title_reviews where account_id=${account} and title_id=${work}`;
      check(
        review?.rating === null,
        "Clearing the personal rating left a conflicting review rating.",
      );
      const parent = randomUUID();
      await tx`insert into title_comments(id,account_id,title_id,body) values(${parent},${account},${work},'Fixture')`;
      await rejects((s) => s`update title_comments set parent_id=id where id=${parent}`);
      await rejects(
        (s) => s`insert into background_jobs(type,lease_owner) values('fixture','unpaired-lease')`,
      );
      await rejects(
        (s) => s`insert into background_jobs(type,attempts,max_attempts) values('fixture',4,3)`,
      );
      const [identity] = await tx<{ n: number }[]>`select count(*)::int n from server_instance`;
      check(identity?.n === 1, "Server identity must have exactly one row.");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return assertions;
}
