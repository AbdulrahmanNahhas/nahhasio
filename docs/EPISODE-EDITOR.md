# Episode workspace checkpoint

The Linux work editor presents compact episode rows with stills, titles, dates, duration and a
summary excerpt. Search and missing-image/metadata filters operate over the complete selected
installment; pages show ten results. Episode metadata opens in a draft dialog. Duplicate episode
numbers are rejected, fractional positive numbers are preserved, and image updates preserve IDs
and unrelated metadata. Deletion retains the existing dependency check and save review.

## Image workflow

The selected installment owns a temporary TMDB season selection for individual searches.
It starts with the installment's position among seasons, excluding movies; specials start at zero.
The small season input remains editable to correct provider differences.
This selection belongs to the current editing session, is reset when leaving the installment and
is not a new database field. The batch dialog additionally lets the administrator confirm the
TMDB series ID. Local episode numbers are matched exactly; fractional episodes require manual
image selection/upload. When the standard season is missing, a unique season-based TMDB episode
group supplies the provider coordinates. An optional episode-group URL resolves ambiguity or selects
a specific group. The preview shows the source group and episode coordinates; local episode numbers
and IDs stay unchanged. This is temporary artwork lookup, not a stored alternate episode listing.

The batch action covers the complete selected installment, regardless of search or page. It defaults
to episodes with no image, including legacy poster/banner fallback. An explicit replacement mode
reviews all eligible episodes. The season response supplies proposed stills; alternative images are
loaded on demand through TMDB's per-episode image endpoint, with no language filter. Candidate
URLs/dimensions are validated at the provider boundary, and the gallery is bounded to 60 options.
Downloads use TMDB original-resolution URLs; only gallery previews use smaller images. Existing
imports retain their files unless the administrator explicitly chooses replacement.

Selections are previewed before importing. At most two imports run concurrently; successful paths
remain in the dialog while failures can be retried. Stop finishes current requests and starts no new
ones. Applying successful imports is a separate explicit action; work review/save performs the actual
assignment. Closing without applying retains imported, unassigned files in the image library. No
existing assets are purged or overwritten. Stale episode identities/numbers/images reject the batch
without overwriting the current draft; newer metadata edits and unrelated artwork fields survive.

Single-episode TMDB selection uses the same gallery. Image removal clears only the displayed
artwork role, preserving other retained fields. Upload/library choices remain available.

## Checks

Focused tests use mocked TMDB responses and pure draft fixtures, with no live catalog mutations:

- `pnpm --filter @arcadia/api exec vitest run src/integrations/tmdb-episode-images.test.ts`
- `pnpm --filter @nahhasio/linux-ui exec vitest run src/features/editor/artwork/episode-images-model.test.ts`

The canonical editor contract includes `episodeImages`; regenerate via the existing editor API
script and `pnpm client:generate`. The Rust API allowlist must be rebuilt/restarted for this new
operation. The native bridge remains generic and does not require a new command. Real-provider
credentials/outcomes, hands-on GTK interaction and AppImage packaging remain separate acceptance
boundaries. The source build does not update an existing AppImage.
