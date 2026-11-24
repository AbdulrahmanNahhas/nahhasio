---
name: nahhasio-cataloging
description: Add or review stored Nahhasio editorial fields. Use for installment scores, audience and risk classification, Arabic content warnings and analysis, or the editorial metadata of a new work.
---

# Catalog a work

- Read the [editorial rubric](references/editorial-rubric.md) for classification, theology,
  Arabic prose, and the six score criteria. Read [work metadata](references/work-metadata.md)
  when changing structure, credits, identifiers, dubbing, trailers, or artwork.
- Use the title as the umbrella record. Place seasons, films and specials under it as
  installments. Score each installment independently. Put the overall classification, warnings
  and analysis on the title and use installment overrides where the content merits them.
- Write summaries, installment titles, warnings and analysis in Modern Standard Arabic. Preserve the original
  canonical title and stable slugs and IDs. Ground risk and scoring in the actual relevant
  installment. Keep uncertain facts or classifications explicit.
- For a new work, search titles and aliases before creating it, verify factual metadata and
  content, and start from `./bin/nahhasio work template --json`. For an edit, export the
  existing document and preserve unrelated fields and identities. Resolve vocabulary and credits
  against the target catalog.
- Apply only authorized changes through [nahhasio-db](../nahhasio-db/SKILL.md). Use
  `work apply --file document.json --dry-run` before `work apply --file document.json --write`.
  Add artwork with the correct owner and explicit write flag. Re-export and check the result
  against the rubric and the [metadata checklist](references/work-metadata.md#self-check-before-publishing).

A standalone review or tracker action has its own workflow. Set publication status only when
the user requests that change. Public draft titles are visible to family accounts.
