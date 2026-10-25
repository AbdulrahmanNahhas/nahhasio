# Schema service ownership

The schema/API/CLI transition is implemented in the shared Rust catalog services. Historical
phase plans and test receipts are retained in Git. The sole active schema history is the
[current baseline](BASELINE.md) plus future additive migrations; this is not another migration plan.
See [DATABASE](DATABASE.md) for data ownership and [DEVELOPMENT](DEVELOPMENT.md) for current tools.

Folder scanning/linking, video-derived stills and stored-media playback remain separate features.
Their tables do not imply working services. Installed Fedora/Flatpak acceptance is still pending.

## Complete database coverage boundary

Every table must have a documented service owner. A basic read view is not an implemented mutation,
job executor, recovery operation or family feature. Internal tables need real backend use, not public
record dumps. Counts/schema/status can be shown where rows would expose credentials or private data.

| Tables                                                                                                                                                                                                   | Owner and intended exposure                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `titles`, `installments`, `episodes`, `installment_scores`                                                                                                                                               | Catalog/editor; authorized viewer projections and admin editors.                                                             |
| `title_aliases`, `title_trivia`, `title_relations`, `external_identities`, `source_evidence`                                                                                                             | Catalog references/relations; admin inspection and selected viewer fields.                                                   |
| `genres`, `tones`, `tags`, `countries`, `vocabulary_labels`, `title_genres`, `title_tones`, `title_tags`, `title_countries`                                                                              | Vocabulary/editor/filter services.                                                                                           |
| `entities`, `entity_aliases`, `roles`, `contributions`, `organization_relations`                                                                                                                         | People/studios and credits; whole-work credits only.                                                                         |
| `planets`, `title_planets`                                                                                                                                                                               | Planet definitions and single-planet membership.                                                                             |
| `award_organizations`, `award_categories`, `award_ceremonies`, `award_recognitions`                                                                                                                      | Awards service; basic admin reads before the full editor.                                                                    |
| `media_assets`, `media_asset_assignments`                                                                                                                                                                | Server image library, including episode stills and generated variants.                                                       |
| `media_files`, `media_tracks`, `library_roots`, `jellyfin_servers`, `jellyfin_items`                                                                                                                     | Server media service; admin path/configuration reads, authorized viewer playback projections.                                |
| `title_trailers`                                                                                                                                                                                         | Work trailers; validated YouTube IDs, language, primary choice and ordering.                                                 |
| `server_instance`, `devices`, `account_downloads`                                                                                                                                                        | Server/device ownership; own-device operations and bounded admin views.                                                      |
| `accounts`, `account_preferences`, `account_title_states`, `account_playback_states`, `account_view_history`                                                                                             | Account/personal services; own-account reads and mutations. View history means catalog visits, not a new playback-event log. |
| `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications`, `account_invites`                                                                                                                  | Authentication/invitations; public/admin projections omit passwords, tokens, hashes and secret verification material.        |
| `account_capabilities`, `account_content_policies`, `account_admin_restrictions`, `account_title_blocks`, `account_tag_blocks`, `account_genre_blocks`, `account_entity_blocks`, `account_planet_blocks` | Authorization; enforced services and redacted admin policy inspection. Unsupported policies remain fail-closed.              |
| `title_reviews`, `title_comments`, `review_reactions`, `comment_reactions`, `notifications`                                                                                                              | Family discussion/inbox; private or published projections, never unrestricted cross-account dumps.                           |
| `collections`, `collection_contributors`, `collection_items`, `saved_views`, `title_follows`                                                                                                             | Account/family library organization and follows.                                                                             |
| `family_recommendations`, `family_events`, `family_event_candidates`, `family_event_votes`                                                                                                               | Family recommendations/events; keep the existing schema and start with authorized basic reads.                               |
| `background_jobs`, `audit_logs`, `editorial_revisions`                                                                                                                                                   | Administration and recovery; bounded, redacted admin views. A visible job row does not imply its worker exists.              |

Do not add editions, alternate episode lists, extra availability-label UI, chat/household/friendship
tables, additional client platforms or a shipped website. Preserve the reviewed desktop design.
