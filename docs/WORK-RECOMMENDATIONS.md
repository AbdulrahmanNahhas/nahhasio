# Work recommendations, version 1

The viewer's work page requests up to ten other published, non-private works through
`GET /api/v1/catalog/recommendations?workId=…`. The current work is excluded. All eligible
candidates are ranked in PostgreSQL; the client receives only ten summaries and their explanations.
No migrations, catalog mutations, viewing-history inference or third-party recommendation service
are involved. With fewer eligible works the section shows fewer cards. Offline mode hides it.

## Match score

This is catalog similarity, not a probability of enjoyment, a popularity score or a safety decision.
The fixed signal weights total 100 when every signal is available:

| Signal                | Weight | Similarity                                                |
| --------------------- | -----: | --------------------------------------------------------- |
| Genres                |     22 | Intersection divided by union                             |
| Tags                  |     16 | Intersection divided by union                             |
| Planet                |     12 | Shared membership                                         |
| Studios/organizations |     12 | Intersection divided by union                             |
| Tone                  |     10 | Intersection divided by union                             |
| Score profile         |     10 | Mean similarity of six per-criterion installment averages |
| Contributors          |      4 | Intersection divided by union                             |
| Audience/age          |      4 | Mean of exact audience and age matches                    |
| Family classification |      4 | Mean normalized distance across the three risk levels     |
| Format                |      3 | Exact animated/live-action match                          |
| Countries             |      3 | Intersection divided by union                             |

A missing seed facet excludes that signal's weight. Candidate-side missing data contributes zero
rather than shrinking the denominator. For scores, criteria missing from the seed are excluded;
criteria present only in the seed contribute zero. Each known pair contributes
`1 - abs(seed - candidate) / 10`. Risk distance uses none=0 through high=3.

The percentage is the weighted mean multiplied by 100 and rounded once to an integer. Ties use
sort title and UUID for stable ordering. Shared values use actual Arabic vocabulary labels and
entity names. The explanation exposes every active signal, its similarity and weight, including
zero matches. Component similarities are displayed to one decimal; the total uses unrounded values.
No private bookkeeping, alternative titles or verification data is shown in the recommendation UI.

## Runtime boundary

The existing endpoint's no-work-ID personal/editorial behavior is retained, with published/private
filtering. Its related-work response adds optional `matches` and `algorithm` fields to the canonical
OpenAPI schema. Generate the client rather than editing generated TypeScript. The new fixed
`recommendations` native command validates the work ID and calls this endpoint using the existing
session; GTK and server binaries must be rebuilt and relaunched for runtime acceptance.
