---
name: frontend-design
description: Design or review new Nahhasio surfaces and approved redesigns. Decide the user journey, content hierarchy, Arabic RTL layout, and interaction states before styling. Preserve reviewed visuals during technical migrations.
license: Complete terms in LICENSE.txt
---

# Frontend Design

Adapted from [Anthropic's frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design).
Use the upstream guide for general design guidance within the approved scope.

## Design for Nahhasio

1. Read [Design and composition](../../../docs/desktop/design-rules.md) and the affected section
   of [Client behavior](../../../docs/desktop/behavior.md). Inspect the nearest implemented surface
   and reviewed screenshots. Preserve the existing visual language during technical changes.
2. Identify the principal action and the information needed before taking it. Set the whole page's
   reading order before refining individual cards. Consider how someone arrives, what they see
   first, and how they return.
3. Compare data cases that change the layout. For Work, check a single film, a collection, and a
   series, plus unfinished, resumed, watched, and upcoming states. Include missing artwork,
   long titles, partial metadata, and a short phone. A single film needs useful context without
   duplicating hero controls. A completed work can reclaim the space used for ongoing progress.
4. Use media artwork, restrained surfaces, and the established Arabic type scale. Group related
   facts and remove repeated status, buttons, or headings. Use real catalog data or representative
   fixtures to judge density.
5. Implement through [nahhasio-desktop-ui](../nahhasio-desktop-ui/SKILL.md). Read the
   [UI SDK skill](../ui-sdk/SKILL.md) and installed React docs before choosing interaction
   behavior. Reuse the reviewed navigation, overlay, and press-feedback patterns.
6. Review what appears in the first viewport, what comes next, and what actually scrolls.
   Verify Arabic RTL, mobile order, short drawer heights, focus restoration, and empty states.
   Report browser and native GTK evidence separately.
