with work_stats as (
 select t.*, $WORK_STATUS as release_status,
 exists(select 1 from installments i where i.title_id=t.id and i.kind='season') is_series
 from titles t
), missing_episodes as (
 select e.id,e.number::float8 number,t.id work_id,coalesce(nullif(t.title_ar,''),t.canonical_title) work_name,t.tmdb_id,i.position season,i.kind::text kind
 from episodes e join installments i on i.id=e.installment_id join titles t on t.id=i.title_id
 where not exists(select 1 from media_asset_assignments m where m.episode_id=e.id and m.role in ('still','poster','banner'))
), eligible as (
 select * from missing_episodes where kind='season' and tmdb_id is not null and number>0 and number=trunc(number)
 order by work_name,season,number,id limit 48
)
select jsonb_build_object(
 'formats',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]') from (select format::text key,count(*) value from work_stats group by format order by count(*) desc)x),
 'workflow',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]') from (select workflow_status::text key,count(*) value from work_stats group by workflow_status order by count(*) desc)x),
 'statuses',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]') from (select release_status key,count(*) value from work_stats group by release_status order by count(*) desc)x),
 'languages',jsonb_build_array(jsonb_build_object('key','ar','value',(select count(*) from work_stats where 'ar'=any(dub_languages))),jsonb_build_object('key','en','value',(select count(*) from work_stats where not 'ar'=any(dub_languages)))),
 'additions',(select jsonb_agg(jsonb_build_object('key',to_char(month,'YYYY-MM'),'value',(select count(*) from titles where created_at>=month and created_at<month+interval '1 month')) order by month) from generate_series(date_trunc('month',current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month') month),
 'artworkRoles',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]') from (select role::text key,count(distinct asset_id) value from media_asset_assignments group by role order by count(distinct asset_id) desc)x),
 'genres',(select coalesce(jsonb_agg(jsonb_build_object('key',key,'value',value)),'[]') from (select coalesce(nullif(g.label_ar,''),g.label_en) key,count(*) value from title_genres x join genres g on g.id=x.value_id group by g.id order by count(*) desc,g.slug limit 8)x),
 'missing',jsonb_build_array(
 jsonb_build_object('key','poster','value',(select count(*) from titles t where not exists(select 1 from media_asset_assignments m where m.title_id=t.id and m.role='poster'))),
 jsonb_build_object('key','banner','value',(select count(*) from titles t where not exists(select 1 from media_asset_assignments m where m.title_id=t.id and m.role='banner'))),
 jsonb_build_object('key','logo','value',(select count(*) from titles t where not exists(select 1 from media_asset_assignments m where m.title_id=t.id and m.role='logo'))),
 jsonb_build_object('key','summary','value',(select count(*) from titles where trim(summary)='')),
 jsonb_build_object('key','genres','value',(select count(*) from titles t where not exists(select 1 from title_genres g where g.title_id=t.id))),
 jsonb_build_object('key','credits','value',(select count(*) from titles t where not exists(select 1 from contributions c where c.title_id=t.id)))),
 'unattachedImages',(select count(*) from media_assets a where not exists(select 1 from media_asset_assignments m where m.asset_id=a.id)),
 'episodesMissing',(select count(*) from missing_episodes),
 'episodesEligible',(select count(*) from missing_episodes where kind='season' and tmdb_id is not null and number>0 and number=trunc(number)),
 'people',(select count(*) from entities where kind='person'),
 'studios',(select count(*) from entities where kind='organization'),
 'episodeTargets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'number',number,'workId',work_id,'workName',work_name,'tmdbId',tmdb_id,'season',season) order by work_name,season,number,id),'[]') from eligible),
 'recentActivity',(select coalesce(jsonb_agg(jsonb_build_object('key',id::text,'action',action,'summary',summary,'createdAt',created_at) order by created_at desc,id),'[]') from (select id,action,summary,created_at from audit_logs order by created_at desc,id limit 8)x)
)
