//! Canonical watched units and released-unit rollups, shared by browse and viewer state.
//! Arguments below are fixed server-owned SQL expressions, never request input.
pub(crate) fn units(work: &str, installment: &str) -> String {
    format!(
        r#"select x.id installment_id,e.id episode_id,x.position installment_position,e.position episode_position,
(e.release_date<=current_date or (e.release_date is null and x.status='completed')) is_released
from installments x join episodes e on e.installment_id=x.id
where x.title_id={work} and x.kind='season' and ({installment} is null or x.id={installment})
union all
select x.id,null::uuid,x.position,0,
(x.release_date<=current_date or (x.release_date is null and x.status='completed'))
from installments x where x.title_id={work} and x.kind in ('movie','special')
and ({installment} is null or x.id={installment})"#
    )
}

pub(crate) const COUNTS: &str = "count(*) catalog_total,count(*) filter(where is_released) total,count(*) filter(where is_released and is_played) played,coalesce(bool_or(position_seconds>0 or is_played),false) started";
pub(crate) const WATCH_STATE: &str = "case when tracking.total>0 and tracking.played=tracking.total then 'watched' when tracking.started then 'in-progress' else 'unwatched' end";
pub(crate) fn summary() -> String {
    format!(
        "jsonb_build_object('catalogUnits',tracking.catalog_total,'releasedUnits',tracking.total,'watchedReleasedUnits',tracking.played,'isFullyWatched',tracking.total>0 and tracking.played=tracking.total,'watchState',{WATCH_STATE})"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn units_distinguish_season_episodes_from_movie_rows() {
        let sql = units("$1::uuid", "$2::uuid");
        assert!(sql.contains("x.kind='season'"));
        assert!(sql.contains("x.kind in ('movie','special')"));
        assert!(sql.contains("e.release_date is null and x.status='completed'"));
        assert!(sql.contains("x.release_date is null and x.status='completed'"));
        // Bulk targets use this same query without a release predicate.
        assert!(!sql.contains("where is_released"));
    }

    #[test]
    fn empty_and_future_units_never_imply_fully_watched() {
        assert!(WATCH_STATE.contains("tracking.total>0"));
        assert!(COUNTS.contains("filter(where is_released and is_played)"));
        assert!(COUNTS.contains("bool_or(position_seconds>0 or is_played)"));
    }
}
