with recognitions as (
    select r.id, r.title_id, r.installment_id, r.result, r.position,
           coalesce(o.slug, r.organization_slug) as slug,
           coalesce(o.name_ar, r.organization_name) as name,
           coalesce(c.name_ar, r.category) as category,
           coalesce(r.category_id::text, r.category) as category_key,
           coalesce(ceremony.year, r.year) as year,
           coalesce(coalesce(ceremony.year, r.year)::text, 'undated') as year_key,
           ceremony.held_on
    from award_recognitions r
    join titles t on t.id = r.title_id
    left join award_organizations o
      on o.id = r.organization_id or (r.organization_id is null and o.slug = r.organization_slug)
    left join award_categories c on c.id = r.category_id
    left join award_ceremonies ceremony on ceremony.id = r.ceremony_id
    where not t.is_private and t.workflow_status in ('draft', 'published')
      and ($1::text is null or coalesce(o.slug, r.organization_slug) = $1)
), programs as (
    select slug, min(name) as name, count(distinct title_id) as work_count,
           jsonb_agg(distinct year_key order by year_key desc)
               filter (where year is not null) as dated_years,
           bool_or(year is null) as has_undated
    from recognitions
    group by slug
), selected as (
    select *, case
        when $1 is null then null
        when dated_years ? $2 or ($2 = 'undated' and has_undated) then $2
        else coalesce(dated_years->>0, 'undated')
    end as selected_year
    from programs
    order by work_count desc, name, slug
    limit 12 offset (case when $1 is null then ($3::bigint - 1) * 12 else 0 end)
), recent_winners as (
    select distinct on (r.slug, r.title_id) r.*
    from recognitions r join selected s using (slug)
    where $1 is null and r.result = 'winner'
    order by r.slug, r.title_id, r.year desc nulls last,
             r.held_on desc nulls last, r.position, r.id
)
select jsonb_build_object(
    'totalPrograms', (select count(*) from programs),
    'programs', coalesce(jsonb_agg(jsonb_build_object(
        'slug', s.slug, 'name', s.name, 'workCount', s.work_count,
        'years', case when $1 is null then '[]'::jsonb
                     else coalesce(s.dated_years, '[]'::jsonb)
                       || case when s.has_undated then '["undated"]'::jsonb else '[]'::jsonb end end,
        'selectedYear', s.selected_year,
        'totalEntries', case when $1 is null then jsonb_array_length(e.items)
                            else (select count(*) from recognitions r
                                  where r.slug = s.slug and r.year_key = s.selected_year) end,
        'entries', e.items
    ) order by s.work_count desc, s.name, s.slug), '[]'::jsonb)
)
from selected s
cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'workId', r.title_id, 'installmentId', r.installment_id,
        'title', coalesce(nullif(t.title_ar, ''), t.canonical_title),
        'installmentTitle', i.title, 'category', r.category, 'categoryKey', r.category_key,
        'result', r.result, 'year', r.year, 'posterId', poster.asset_id
    ) order by r.ordinal), '[]'::jsonb) as items
    from (
        select candidate.*, row_number() over (
            order by
                case when $1 is not null then candidate.category end,
                case when $1 is not null then candidate.category_key end,
                case when $1 is not null then candidate.result = 'winner' end desc,
                candidate.year desc nulls last, candidate.held_on desc nulls last,
                candidate.position, candidate.id
        ) as ordinal
        from (
            select w.* from recent_winners w where w.slug = s.slug
            union all
            select d.* from recognitions d where d.slug = s.slug and d.year_key = s.selected_year
        ) candidate
        order by ordinal
        limit (case when $1 is null then 5 else 40 end)
        offset (case when $1 is null then 0 else ($3::bigint - 1) * 40 end)
    ) r
    join titles t on t.id = r.title_id
    left join installments i on i.id = r.installment_id
    left join lateral (
        select m.asset_id from media_asset_assignments m
        where m.role = 'poster' and (m.title_id = t.id or m.installment_id = i.id)
        order by (m.installment_id is not null) desc, m.is_primary desc, m.id
        limit 1
    ) poster on true
) e
