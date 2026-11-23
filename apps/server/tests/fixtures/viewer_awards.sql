-- Additional synthetic data for the isolated awards scenario.
insert into titles (canonical_title, sort_title, is_private) values ('Private winner', 'Private winner', true);
insert into award_organizations (slug, name_ar) values ('fixture-award', 'جائزة الاختبار');
insert into award_categories (organization_id, slug, name_ar)
select id, 'animation', 'أفضل رسوم متحركة' from award_organizations where slug = 'fixture-award';
insert into award_ceremonies (organization_id, year)
select id, 2025 from award_organizations where slug = 'fixture-award';
insert into award_recognitions (title_id, installment_id, organization_slug, organization_name, organization_id, category, category_id, ceremony_id, year, result)
select i.title_id, i.id, o.slug, 'Legacy name', o.id, 'Animation', c.id, e.id, null, 'winner'
from installments i
join award_organizations o on o.slug = 'fixture-award'
join award_categories c on c.organization_id = o.id
join award_ceremonies e on e.organization_id = o.id
where i.title = 'Completed season';
insert into award_recognitions (title_id, organization_slug, organization_name, category, year, result)
select id, 'fixture-award', 'Legacy name', 'Earlier category', 2020, 'winner'::award_result
from titles where canonical_title = 'Viewer mixed fixture'
union all
select id, 'fixture-award', 'Legacy name', 'Other category', 2025, 'nominee'::award_result
from titles where canonical_title = 'Viewer empty fixture'
union all
select id, 'fixture-award', 'Legacy name', 'Undated category', null, 'nominee'::award_result
from titles where canonical_title = 'Viewer unknown fixture'
union all
select id, 'private-only-award', 'Private award', 'Hidden category', 2030, 'winner'::award_result
from titles where canonical_title = 'Private winner';
