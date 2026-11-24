# Editorial rubric

[Cataloging workflow](../SKILL.md)

## Classification

Five fields on the title:

| Field            | Values                                       |
| ---------------- | -------------------------------------------- |
| `audience`       | `general` · `teen` · `young-adult` · `adult` |
| `age`            | `all` · `7+` · `10+` · `13+` · `16+` · `18+` |
| `sexualityRisk`  | `none` · `low` · `medium` · `high`           |
| `behavioralRisk` | `none` · `low` · `medium` · `high`           |
| `theologyRisk`   | `none` · `low` · `medium` · `high`           |

Preserve the existing age classification unless Aqua requests a change. Inspect current
classification statistics rather than relying on historical counts.

`audience` is the overall maturity of the work. `general` is the default and the largest group;
`adult` is rare and reserved for works like Arcane.

**`sexualityRisk`** — romance, intimacy, fanservice, nudity, explicit relationships.
**`behavioralRisk`** — violence, gore, cruelty, crime, drugs, suicide, bullying, foul language;
anything a child might imitate or be disturbed by. Verify the current distribution with
`stats classification`; historical counts are not editorial rules.
**`theologyRisk`** — see below. This is the dimension that most distinguishes this archive.

Verify against neighbours before committing to a level:

```bash
./bin/nahhasio stats classification
./bin/nahhasio title list --where "behavioral_risk=high" --columns canonical_title,audience --limit 15
```

## Theology risk — the creedal (عقدي) judgement

The question is **not** "does magic appear?" It is: _does the work advance a metaphysical claim
that collides with Islamic ʿaqīdah, and how central is it?_

**Magic on its own is never the problem.** Spells, superpowers, and invented fantasy systems are
storytelling devices; the catalog rates plenty of them `none`. What raises the level is a claim
about the unseen (الغيب) — souls and the afterlife, spirits, fate and qadar, reincarnation,
divination, worship — especially when it mirrors a belief system people actually hold. Arcane's
Hextech and One-Punch Man's superpowers are `none`; Weathering with You's Shinto weather-spirits
are `high`. Judge the metaphysics, not the vocabulary.

**`none`** — no creedal problem. Powers are framed as fantasy or technology with no metaphysical
system behind them.

> Ratatouille: `لا توجد مشكلة عقدية.`
> One-Punch Man: `لا توجد مشكلة عقدية؛ القوى الخارقة فانتازيا كوميدية ساخرة دون عبادات.`
> Arcane: `لا توجد مشكلة عقدية جوهرية؛ السحر والتقنية (Hextech) فانتازيا صناعية دون منظومة عقدية.`

**`low`** — a real religion appears as cultural background, or a speculative premise (time
travel) carries no metaphysical claim. Present but peripheral, or non-doctrinal.

> Anne Shirley: `خلفية مسيحية ثقافية (كنيسة وصلاة) دون طرح لاهوتي مركزي.`
> Trapp Family Story: `القصة مرتبطة مباشرة بالكاثوليكية؛ ماريا راهبة متدربة، وتظهر الأديرة والصلوات والمعتقدات المسيحية بصورة إيجابية ومحورية في الأحداث.`
> Remake Our Life!: `السفر الزمني فرضية خيالية بلا طرح غيبي؛ لا إشكال عقدي.`

**`medium`** — fantasy metaphysics (souls, demons, spirits, an afterlife) used as story
machinery. Central enough to warrant caution, but not a call to a real belief.

> Frieren: `يتضمن السحر والشياطين وتصورات فانتازية عن الجنة والروح كأدوات قصصية دون دعوة لعقيدة واقعية؛ إشكال عقدي بحاجة حذر.`
> Attack on Titan: `توجد طائفة دينية ('عبدة الأسوار') وأسطورة تأسيسية للعمالقة (يمير)، وهي عناصر دينية خيالية داخل العالم دون دعوة صريحة لعقيدة حقيقية؛ إشكال عقدي متوسط رغم حضورها.`
> The Imaginary: `يفترض أن الكائنات المتخيلة تكتسب وجوداً مستقلاً بعد نسيان أصحابها، وهو تصور ميتافيزيقي عن مصير 'الأرواح' مخالف للتصور الإسلامي، محوري في الفرضية.`

**`high`** — a real-world or systematic unseen (غيب) framework sits at the centre of the work and
directly contradicts Islamic creed: Shinto/animist spirit systems, reincarnation, control over
fate/qadar, witch cults.

> Weathering with You: `يقوم على فكرة 'فتاة الطقس' والصلة بأرواح السماء وفق المعتقدات الشنتوية اليابانية حول التحكم بالطقس؛ تصور غيبي محوري.`
> Re:Zero: `يقوم على قدرة 'الرجوع بالموت' للتحكم بالقدر وطائفة عبادة الساحرة، وهو تصادم مع الإيمان بالقدر والغيب في العقيدة الإسلامية.`
> Toilet-bound Hanako-kun: `يقوم بالكامل على خرافات المدارس السبع والأرواح والأشباح والحدود بين عالم الأحياء والأموات في الفولكلور الشنتوي الياباني، وهو طرح غيبي محوري مخالف للعقيدة الإسلامية.`

The deciding axes are **centrality** (background detail vs. the premise) and **reality**
(invented in-world mythology vs. a belief system people actually hold).

## analysisNotes — always written

**Every work should have `analysisNotes`, including works with `theologyRisk: none`.**
Never leave it empty. It is the justification for the theology level — so it must name the
creedal element specifically, not gesture at "fantasy content". Remember that magic by itself
is not that element.

One or two Arabic sentences. Name the specific element, then give the verdict. When there is no
issue, say so plainly — `لا توجد مشكلة عقدية.` — optionally with a clause explaining why the
apparent problem is not one.

For an unreleased work, mark the judgement provisional:
`تقييم مبدئي حتى العرض الكامل.` / `تقييم مبدئي حتى صدور العمل.`

## contentWarnings — always written

**Every title has `contentWarnings` too.** One Arabic sentence: comma-separated noun phrases,
most severe first, ending in a full stop. Concrete, not euphemistic. Cover violence and gore,
death and grief, romance and intimacy, drugs, foul language, LGBT content, horror, and
psychological distress.

> Arcane: `عنف دموي شديد، قتل واغتيالات، تعاطي وتجارة مخدرات (شيمر)، علاقة شاذة صريحة بين شخصيتين رئيسيتين، رومانسية ولقطات حميمية ضمنية، ألفاظ نابية.`
> 86 EIGHTY-SIX: `عنف حربي دموي شديد، موت متكرر وتشويه أشلاء، إبادة واضطهاد عنصري، انتحار، صدمات نفسية حادة، إجبار قاصرين على القتال.`
> Spider-Verse: `عنف أبطال خارقين ومطاردات وخطر أكشن متصاعد عبر الأجزاء، وفاة أقارب وشخصيات رئيسية وحزن عائلي، نوبة قلق/هلع مصوَّرة بواقعية، توتر أسري بين الآباء والأبناء، ورومانسية مراهقين خفيفة بين الجزأين الثاني والثالث.`

Note the register: it names exactly what happens ("نوبة قلق/هلع مصوَّرة بواقعية") rather than a
generic label. Where a warning applies to only part of a franchise, say which part. For
unreleased works append `التفاصيل النهائية غير مؤكدة قبل العرض.`

The warnings must be consistent with the risk levels — an explicit sexual relationship in the
warnings and `sexualityRisk: none` is a contradiction.

## Scoring

Six criteria, **0–10, half-point steps**, on each installment:

| Criterion       | Weight | Catalog average |
| --------------- | ------ | --------------- |
| `story`         | 0.25   | 7.5             |
| `characters`    | 0.20   | 7.9             |
| `craft`         | 0.20   | 8.5             |
| `depth`         | 0.15   | 7.2             |
| `worldBuilding` | 0.10   | 7.8             |
| `originality`   | 0.10   | 7.4             |

Rating = the weighted sum. A title's rating is the **mean of its fully-scored installments**.

**Score all six or none.** An installment with any criterion left null is excluded from its
title's rating entirely — a partial score is worse than no score.

### What the numbers mean

Historical examples below are calibration references, not current catalog statistics.
Use `./bin/nahhasio stats scores` for the current distribution; the legal scale remains 0–10.

| Band    | Meaning                                       | Reference                                           |
| ------- | --------------------------------------------- | --------------------------------------------------- |
| 4.5–5.5 | Weak. Thin plotting, filler, flat characters. | Cookin' Idol 4.45 · Don Chuck 4.83 · Cocotama 4.85  |
| 6.0–6.5 | Below average. Watchable, unremarkable.       | The Promised Neverland S2 5.13 (a collapse from S1) |
| 7.0–7.5 | Solid and competent.                          | —                                                   |
| 8.0–8.5 | Strong. The healthy middle of this catalog.   | —                                                   |
| 9.0–9.5 | Excellent.                                    | Monster 9.50 · FMAB 9.55 · Spider-Verse ATSV 9.58   |
| 9.5+    | The very top; used sparingly.                 | Attack on Titan final 9.90 · Avatar Book 3 9.83     |

A 10 on a single criterion is exceptional; calibrate against current comparable works.

### Reading each criterion

- **story** — plot construction, pacing, payoff. The heaviest weight; be deliberate.
- **characters** — depth, arcs, relationships. Runs slightly high; this catalog favours
  character-driven work.
- **craft** — animation, direction, music, sound. **Systematically the highest** (8.5 average).
  A modern well-funded production rarely drops below 7 here even when the writing is poor, so
  craft alone does not rescue a score.
- **depth** — themes, moral and philosophical substance. **The lowest average and the real
  discriminator.** Most children's shows sit at 3.5–5 here regardless of how polished they are.
  This is where a work earns or loses its place near the top.
- **worldBuilding** — coherence and texture of the setting. For a work with little world to
  build, score the coherence of what exists rather than punishing its scale.
- **originality** — freshness against its genre. Competent genre execution is a 7, not a 5.

Calibrate against neighbours before writing:

```bash
./bin/nahhasio stats top
./bin/nahhasio stats scores
./bin/nahhasio sql "select t.canonical_title, i.title, s.* from installment_scores s
  join installments i on i.id=s.installment_id join titles t on t.id=i.title_id
  where t.canonical_title ilike '%<similar work>%'"
```
