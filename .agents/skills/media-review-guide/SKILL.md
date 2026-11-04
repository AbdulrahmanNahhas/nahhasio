---
name: media-review
description: Write Arabic-first, spoiler-safe reviews of films, TV, anime, manga/comics, novels, and games, separating artistic quality from personal suitability. Use for requests to review, rate, critique, evaluate, or decide whether to watch/read/play a work, including Arabic requests such as قيّم، مراجعة، تقييم، هل يستحق المشاهدة, and follow-ups about analysis, comparisons, content concerns, or viewing order. Adapts cards, badges, ratings, and follow-up actions to the current host. Excludes plain plot summaries and trivia without evaluation.
---

# Media Review — Portable Single-File Edition

Version 2.8 · 2026-11-02. This file is the complete skill: copy or share it alone. No companion references, provider-specific package, or local assets are required.

Produce trustworthy, well-written, Arabic-first reviews with the clarity and visual discipline of a polished editorial interface. Default language is Modern Standard Arabic (العربية الفصحى) unless the user asks for another language.

A review must answer five questions: What is this work? What does it do well or badly? What makes it distinctive? Is it personally suitable for this user? What comparisons or deeper questions follow?

## Non-negotiables

These rules hold in every review, whatever the medium or layout.

- **Two separate judgments.** The *editorial score* measures artistic and technical quality. The *personal recommendation* measures fit for this user. An excellent work can correctly get «لا أنصحك به». Never lower the editorial score because of a personal boundary, and never average suitability into criticism.
- **Candor.** Use the whole 0–10 scale. Criticize real flaws even in beloved works. Never invent weaknesses to reach a count or padding praise to look balanced.
- **Spoiler-safe by default.** Respect the exact episode, season, chapter, volume, act, quest, or ending the user has reached. Do not hint at unreached twists, including in button labels and follow-up titles.
- **Grounded facts.** Keep verified information, editorial interpretation, and uncertainty distinct. Never invent sources, scores, covers, dub availability, credits, content warnings, dates, URLs, or tracker statuses. Never infer "none" from silence.
- **Stable essentials.** The fixed scoring axes for each medium, exactly three suitability categories, one consistent overall score, and the independent final recommendation do not change with design variations.
- **Clarity with visual polish.** Strong hierarchy, comfortable spacing, accessible contrast, authentic artwork, and purposeful cards and badges. Preserve the host's visual identity rather than imposing one component library or CSS theme.

## Arabic-first rule

Every Arabic-language review, and every Arabic follow-up response, **must begin with one natural, complete Arabic sentence as the very first visible line**, before any heading, poster, image, English title, score, citation, card, or UI element. This is a deliberate right-to-left presentation workaround and applies even when RTL layout support exists. Use RTL support in addition to it, never instead of it.

- The sentence carries real substance about the work, not a greeting. Example: «يقدّم هذا العمل تجربةً دراميةً تقوم على صراع الهوية والاختيار.» Adapt it to the work, without spoilers.
- Do not put English, an icon, a badge, or an empty heading before it.
- After it, use Arabic headings, labels, link captions, and alt text, with coherent RTL reading order.
- Prefer a real Arabic translation of the work's title: an established Arabic release title first, otherwise a faithful, natural Arabic rendering. Never present your own translation as official; clarify it briefly when ambiguity matters. Use transliteration for proper names or titles whose meaning cannot be translated responsibly. Put the recognizable international title in smaller text for identification; Japanese script is not required. Keep studio, platform, and database names accurate and use one spelling throughout. See the **Localization, studio identity, links, and evidence** section below.
- Write polished, natural فصحى: analytical, concise, not slangy, grandiose, or promotional. Keep scores as `8.7/10` and avoid awkward mixed LTR/RTL sequences.
- If the user explicitly asks for a non-Arabic answer, answer in that language and drop this rule.

## Workflow

Before writing, settle these points, using web search, page fetches, and image search when they are available:

0. **Choose the supported presentation.** Discover available rendering components and whether actions can send a user message, draft one, or only change local content. Read the **Visual presentation across hosts** section below for rich output. Do not assume a capability from the platform's name or invent an API.
1. **Identify** the exact title, medium, version, edition, platform, and the user's progress (this sets the spoiler boundary and the evaluated scope). If progress is unknown, keep the review premise-level and avoid later developments; ask only when an ambiguity materially changes the review.
2. **Verify** release year, creators, the *animation* studio (not a committee, licensor, or distributor), official artwork, and dub or Arabic-language availability.
3. **Check sensitive content independently** from age classifications and detailed content guides. Do not treat a synopsis that is silent as evidence of absence.
4. **Read credible criticism**, then form an independent judgment. Never copy an outside score or average outside ratings.
5. **Choose three comparable works** and find real cover art for them.

Evidence rules and source preferences are in the **Localization, studio identity, links, and evidence** section below. Degrade only the unavailable feature: missing chat actions need not remove cards, and a missing poster need not force text-only output. Keep meaningful uncertainty visible and omit unsupported claims. Follow the user's source/tool limits.

## Review structure

Use this order by default. Interior layout may adapt; the Arabic opening, scoring profiles, three suitability categories, and final recommendation may not.

1. **Arabic opening line** (see above).
2. **Compact hero**: one authentic, preferably official portrait cover (roughly 120–160 px on desktop), translated Arabic title with the recognizable international title smaller, year, essential format and credits, the studio name shown plainly, a one-line dub or Arabic-support fact, 2–4 neutral genre badges, the clearly labeled editorial score, and a separate personal recommendation badge. Details in the **Visual presentation across hosts** section below.
3. **Editorial takeaway**: 2–3 sentences on the main achievement, the main limitation, and the decisive fit issue.
4. **Spoiler-safe overview**: about 70–130 Arabic words for narratives (premise, relevant characters, initiating conflict, central aim; no outcomes). For non-narrative works, describe goals, core systems, and experience.
5. **«التقييم التفصيلي»**: exactly the fixed 6 or 8 axes for the medium, as borderless two-column bars. Axes and scale in the **Scoring policy and fixed medium profiles** section below.
6. **Strengths and weaknesses**: same icon-and-text style. Usually 3–5 strengths and 1–4 weaknesses, up to 6 of either when justified. Writing rules in the **Analytical writing and the depth-sensitive section** section below.
7. **Distinctive section**: substantial philosophical questions only for genuinely deep works; otherwise a fitting craft or theme lens; otherwise omit.
8. **Suitability**: exactly three categories in fixed order with four severity labels. Full rules in the **Content suitability: exactly three categories** section below.
9. **Three related works** with small authentic covers, one similarity and one distinction each. Fewer is better than filler.
10. **Final verdict**: the same `x.x/10` as the hero, a separate recommendation badge, and 2–4 grounded sentences covering artistic merit, the key drawback, and why this user should or should not engage.
11. **Five follow-up buttons** when chat actions are supported: concise labels send fuller contextual messages. Draft/copy/text fallbacks must describe their actual behavior. Details in the **Related works, verdict, and follow-up exploration** section below.
12. **Recognizable database links**, styled as compact secondary/outline link-buttons where supported, plus discreet claim-level citations. An optional remote-image gallery may appear after the overview or near related works when it adds value.

**Editorial economy:** do not repeat the plot, scoring method, spoiler policy, citation strategy, or the same praise and cautions across sections. Do not print internal verification or scope commentary such as «النطاق: القصة كاملة دون حرق». Show a short scope marker («الموسم الأول»، «حتى الحلقة 10») only when the evaluated portion changes the meaning of the review.

## Final recommendation labels

Positive: **أنصح به بشدة / أنصح به**. Qualified: **بشروط / بتحفظ**. Negative: **لا أنصحك به / غير موصى به لك**. Colors are green, amber, red, and every color carries a readable label. Do not change an anime or media tracker status unless explicitly asked.

## Rendering

Use this file as a portable editorial contract, not an application tied to one provider. Prefer supported native cards, badges, links, and chat actions; use HTML/artifacts when useful and available; use Markdown when rich output is unavailable. Follow the host's component, theme, security, and tool instructions. Do not install a framework, launch a server, or require another skill merely to display a review.

In rich output, use purposeful bordered or surfaced cards, spaced badges, compact borderless score rows, and real follow-up actions. These are design intentions, not identical markup across ChatGPT, T3 Code, Claude, or future hosts. In Markdown, preserve the same content with a compact two-column score table, normal links, and numbered follow-up prompts. Never print unsupported component syntax or disguise local UI changes as a sent message. Full rules are in the **Visual presentation across hosts** section below and the **Related works, verdict, and follow-up exploration** section below.

## Scoring policy and fixed medium profiles


### Policy

- Publish **one editorial overall score** out of 10, normally with one decimal. It is your independent critical judgment, not a copied IMDb/AniList/Goodreads score and not an average of outside ratings.
- **Exactly 8 axes** for TV/anime series and for both game profiles. **Exactly 6 axes** for films, prose/novels, and manga/comics. A novel or manga series stays in its own medium profile.
- Within a profile, **axis labels, order, and count are fixed across reviews**. Bar layout may adapt to screen width but may never create a seventh or ninth visible criterion.
- The overall score need not equal the arithmetic mean of the axes. If it is materially different, justify the weighting in prose.
- Scale: **9–10 exceptional; 8 very good; 7 good; 6 mixed / above average; 5 average / flawed; 4 weak; 0–3 poor.** Never assign scores to fit a quota.
- State the evaluated scope of ongoing or incomplete works. **Never rate an unseen ending.** A series' last axis evaluates *continuity so far* until the work is complete, then *pacing and ending*. Name the platform, patch, season, or edition when it matters.
- Use the exact Arabic labels below, unchanged.

### A. TV series / anime series: 8 axes

1. **القصة والبناء السردي** — coherence, causality, arcs, setups and payoffs.
2. **الشخصيات وتطورها** — motivations, complexity, relationships and growth.
3. **العمق الفكري والنفسي** — moral, psychological, philosophical and thematic substance.
4. **العالم والبيئة** — coherent world or setting, whether fantasy, historical or realistic.
5. **الإخراج والتنفيذ البصري** — directing, cinematography/VFX or animation execution.
6. **الحوار والكتابة** — dialogue, scene construction and dramatic expression.
7. **الموسيقى والصوت** — soundtrack, sound design and audio performance.
8. **الإيقاع والاستمرارية / النهاية** — episode and season pacing and consistency; ending **only if completed**.

### B. Feature / animated / anime film: 6 axes

1. **القصة والبناء السردي** — screenplay and narrative coherence.
2. **الشخصيات وتطورها** — characterization, motivations and development.
3. **العمق والأثر العاطفي** — ideas and emotional impact.
4. **الإخراج والتنفيذ البصري** — direction, editing, cinematography or animation.
5. **الموسيقى والصوت** — musical and sound contribution.
6. **الإيقاع والتماسك** — tension, pacing, resolution and unity.

### C. Story-driven video games / RPGs: 8 axes

1. **القصة والسرد** — narrative structure, delivery and player agency where relevant.
2. **الشخصيات** — characterization and relationships.
3. **العمق الفكري والنفسي** — themes, ethics and psychological substance.
4. **القتال وأسلوب اللعب** — combat, mechanics, responsiveness and agency. For noncombat narrative games assess the central mechanics, not imaginary combat.
5. **العالم والاستكشاف** — setting, navigation, environmental design and discoveries.
6. **الرسومات والتوجه الفني** — art direction, presentation and animation; technical fidelity is not artistry.
7. **الموسيقى والصوت** — score, voices, soundscape and feedback.
8. **التصميم التقني والتوازن** — performance, bugs, accessibility, UX, progression and balance.

Additional game analysis belongs in prose only, as relevant: enemies and bosses, controls, dodging and parrying, builds and equipment, level design, quests, difficulty, replay value, online systems, patch and platform effects. Separate verifiable mechanics from subjective preference.

### D. Novels / prose fiction: 6 axes

1. **القصة والبناء السردي** — structure, causality and momentum.
2. **الشخصيات وتطورها** — psychology, relations and growth.
3. **العمق الفكري والنفسي** — ideas, subtext, morality and emotion.
4. **العالم والبيئة** — fantasy worldbuilding or historical/social milieu.
5. **الأسلوب الأدبي والحوار** — prose, voice, tone, readability and dialogue.
6. **الإيقاع والأثر العاطفي** — tension, pacing, emotional power and known ending.

Assess the specified volume, translation, or series only within the stated scope. Never invent a novel's soundtrack or cinematography.

### E. Manga / comics / graphic novels: 6 axes

1. **القصة والبناء السردي** — narrative construction and coherence.
2. **الشخصيات وتطورها** — motivation, relationships and progression.
3. **العمق الفكري والنفسي** — themes, moral ideas and psychology.
4. **الرسم والهوية الفنية** — linework, composition, design and consistency.
5. **الإخراج البصري وتسلسل اللوحات** — panel rhythm, visual storytelling and clarity of movement.
6. **الإيقاع والتماسك** — chapter flow, pacing, continuity and payoff.

### F. Gameplay-first / non-narrative games: 8 axes

For strategy, racing, simulation, sports, platformers, and other games where story and characters are not central design promises. Say in the review that this profile is being used.

1. **أسلوب اللعب والميكانيكيات**
2. **عمق الأنظمة والخيارات**
3. **تصميم المراحل أو المحتوى**
4. **التحدي والتوازن**
5. **التحكم وواجهة الاستخدام**
6. **الهوية البصرية والرسومات**
7. **الموسيقى والمؤثرات الصوتية**
8. **الأداء التقني وإعادة اللعب**

### Other media

Documentaries, interactive fiction, visual novels, audio dramas and the like: choose the nearest six- or eight-axis profile above. Define and reuse a **new stable profile** only if truly necessary. Do not invent ad hoc axes or score features the medium lacks.

## Analytical writing and the depth-sensitive section

### Core writing rules

- The **synopsis** names the premise, relevant characters, initiating conflict, central aim, and distinctive setup, **without outcomes or hints about future revelations**. For gameplay-first media, describe the player's goals, core mechanics, and experience instead.
- Criticism explains **how and why** something works or fails: narrative causality, character motives, thematic tension, visual direction, animation, dialogue, music, prose, combat feel, level design. Avoid generic praise, stock clichés, unsupported certainty, and comparisons that share only a genre.
- **Strengths:** typically 3–5, up to 6 if genuinely distinct. **Weaknesses:** typically 1–4, up to 6 if justified. Fewer, or even none, only if honest examination supports it. Never invent faults or pad praise.
- Keep each icon-and-text observation focused: usually 2 specific sentences (1–3 as needed), one clear claim plus one explanation or illustration. Cut digressions, not reasoning. Unusually complicated points may run longer.
- Judge an adaptation on its own execution, not the reputation of its source. Respect the medium: do not judge novels for sound, realistic dramas for fantasy lore, or noncombat games for missing combat.

### Deep works: «الأسئلة الفلسفية» or a fitting title

Include a substantial philosophical or thematic section **only when the work rewards it**, for example an unusually layered psychological, moral, existential, or symbolic narrative. Never force it onto light comedy, simple action, or straightforward entertainment.

- Offer **3–5 distinct, work-specific questions** (up to 6 for exceptionally rich works). Each must express a real tension, not a generic rhetorical question or a rephrasing of one idea.
- **Analyze every question**, ordinarily in 2–4 thoughtful sentences linking it to the work's narrative and artistic choices and, where defensible, to more than one interpretation. This section may be longer than the standard observations when its substance warrants.
- Topics (ethics, artistic expression, identity, freedom, duty, memory, grief, growth, conflicting values) are allowed only when the work specifically supports them. Do not claim a single official authorial answer, and do not expose plot turns past the spoiler boundary.
- Present it as a sequence of questions with analysis, separated by subtle dividers or short headings, without numbering and without a large bordered card per question. The main review must still read fully without any clicking.

### Other works: change the lens, not the rigor

For comedy, action, horror, mystery, adventure, non-narrative games, or simpler media, replace the philosophical section with a tailored insight if it helps. Examples of titles: «سرّ نجاح الكوميديا»، «كيف يصنع العمل التوتر؟»، «براعة الغموض»، «بصمة الإخراج»، «ما الذي يجعل القتال ممتعًا؟»، «جماليات الأسلوب». Analyze the chosen quality with concrete examples; these titles are not a checklist. **Omit the section entirely if it would only repeat earlier analysis.**

This section is not a new rating axis, a new suitability category, or a reason to lengthen every review. If a philosophical section already covers certain questions, later follow-ups must advance or broaden the discussion rather than repeat it.

### Limited creative freedom

You may add **one** relevant tailored analytical section or contextual mini-visual and shift emphasis by medium: literary voice for novels, adaptation craft for anime, action staging for films, gameplay systems for games. Everything else stays recognizable. Do not reinvent the design just to look creative.

## Content suitability: exactly three categories

Keep **exactly three** labeled rows, in this order. Each row has the exact category name, a small consistent icon, a colored severity badge, and a direct factual explanation. Use thin dividers rather than tall bordered cards. Show the section even when every category is clear.

### Four severity labels (used consistently everywhere)

| Badge text | Color | Meaning |
| --- | --- | --- |
| **لا يوجد** | Neutral gray | No relevant concern identified, with adequate evidence |
| **منخفض** | Green | Limited or mild concern |
| **متوسط** | Amber/orange | Meaningful caution. Never red |
| **مرتفع** | Red | Prominent or severe concern |

**Evidence exception:** if there is not enough information to assign a level responsibly, use **«معلومات غير كافية»** in neutral gray. This signals uncertainty, not a fifth severity level. Never mark «لا يوجد» just because a synopsis or review is silent.

### How much to write

Be direct, clear, and specific, **not artificially brief**. A category with no relevant issue may need one short sentence. A simple concern may need two or three. A work with many or serious issues may need a fuller paragraph or a few distinct factual points covering nature, intensity, frequency, centrality, and whether the content is optional or core. Never impose a one-sentence or word-count cap. Avoid repetition, vague alarms, and scene-by-scene spoilers.

### 1) المحتوى الجنسي والشذوذ

Where relevant and reliably supported, describe nudity, explicit or implied sexual acts, fanservice, sexual violence, romantic or sexual relationships, and same-sex relationships or themes. Use the category label as written, and describe the material **factually, without derogatory descriptions of people**. Explain what actually appears and how pronounced it is. Omit unverified sub-issues rather than listing irrelevant disclaimers.

### 2) العنف والدماء

Cover relevant fights and injuries, blood and gore, torture, disturbing or horror imagery, suicide or self-harm themes, psychological distress, disgusting scenes, and profanity or strong language. **Distinguish visual graphicness from emotional intensity**: a work can be psychologically heavy with little blood. Add detail when frequency or intensity materially affects suitability.

### 3) المخالفات العقدية للإسلام

Apply the user's **specific screening focus**, not a general ban on fantasy.

- Principal concern: **تجسيد الآلهة**, meaning gods shown as embodied or personified characters, or similarly explicit and central theological portrayals the screening standard treats as problematic.
- Mentioning mythological gods or a fictional religion, background worship or rituals, supernatural events, powers, spells, or magic **does not automatically trigger the concern**. Assess what is shown and its role in the story.
- If no relevant concern is verified, use **«لا يوجد»** with a simple line such as **«لا توجد مخالفات عقدية بارزة ضمن هذا المعيار.»** Do not add an explanation of why fictional beliefs or passing references do not qualify.
- If something genuinely relevant appears, explain it plainly and assign a proportional badge.
- Internal calibration only (never repeat as a disclaimer): fictional faiths in *Game of Thrones* do not automatically warrant a high rating, and supernatural elements in *Clair Obscur: Expedition 33* do not automatically count as deity personification. Verify every work independently.
- This is personalized media screening, **not a general or authoritative religious ruling**. Do not recite that methodology in the visible text.

### Verification

Check the **exact season, volume, cut, act, optional content, platform, or version**. An unclear source calls for the uncertainty label, not a guessed absence. Prefer credible age classifications (ESRB, PEGI, BBFC), Common Sense Media, detailed content guides, and corroborated firsthand reports. Keep citations discreet but real.

## Localization, studio identity, links, and evidence


### Arabic titles and recognizable identification

Prefer a meaningful Arabic title over transliterating an entire foreign title:

1. Use a verified established Arabic release or publication title when available, even if it is not word-for-word.
2. Otherwise supply a faithful, natural Arabic translation of the title's meaning. Do not claim that your rendering is an official or established release title. If ambiguity could misidentify the work, briefly mark it «ترجمة وصفية للعنوان» and retain the recognizable international title.
3. Keep proper names, invented terms, and titles that cannot be translated responsibly in a recognizable Arabic form. Do not force a misleading literal translation merely to avoid transliteration.

In the hero, show the Arabic title first and the recognizable international title smaller for identification. Japanese script is unnecessary by default; include it only if requested or needed to disambiguate a specific edition. Keep one Arabic spelling for character names and titles across the review and follow-up messages. Preserve accurate studio/platform/database brand names.

### Anime and animated films: dubbing in one short line

The user wants a quick answer to whether an English and/or Arabic dub exists, not a voice-cast article in the hero. Use exactly one label/value, and only when supported:

- `الدبلجة: إنجليزية وعربية` — both confirmed.
- `الدبلجة: إنجليزية فقط` / `الدبلجة: عربية فقط` — only the named dub(s) confirmed **and** reasonable evidence excludes the other. If not, write `الدبلجة: إنجليزية متوفرة` (or the Arabic equivalent) without claiming exclusivity.
- `الدبلجة: غير متوفرة` — verified lack of a dub for the assessed release. **Never infer this from a missing listing.**
- `الدبلجة: غير مؤكدة` — reliable evidence is insufficient. Do not falsely declare absence.

Do not add a paragraph about original Japanese audio, platform restrictions, voice actors, or subtitles unless the user asks or a material caveat would otherwise mislead. Distinguish **dubbing** from **subtitles**, and a dub's **existence** from platform or region availability. If a verified Arabic dub has a title-specific official page or a reputable Dubbing Wiki/Fandom entry, add a small direct link next to the language fact or in the sources. Link to voice-cast details only when the dub is well evidenced.

**Studio:** show the animation studio's actual name plainly in the hero, with no verbose role label (not «استوديو التحريك:»). Verify internally that it is the studio responsible for animation, not a production committee, licensor, publisher, or streaming distributor. For multi-studio works, clarify roles only when needed to avoid misattribution.

### Games: Arabic support in one short line

For the exact assessed platform and version, use a brief fact such as `العربية: واجهة ونصوص` / `العربية: ترجمة` / `العربية: أصوات ونصوص` / `العربية: غير مدعومة` / `العربية: غير مؤكدة`. Do not confuse interface, subtitles, and spoken voices. Mention region, patch, or storefront differences only when needed to avoid a wrong answer.

### Reference links

For visible work-navigation links throughout reviews and follow-up answers, **prioritize direct, verified pages on recognizable media databases**. Label them with service names, not generic «معلومات», «الحلقات», or «المزيد». Put a compact database-link group in the hero and appropriate verified database destinations on related-work entries. Avoid repeating buttons in every paragraph.

| Medium | Useful destinations |
| --- | --- |
| Film / TV | IMDb and TMDB |
| Anime / anime film | MyAnimeList and AniList; IMDb or TMDB when useful |
| Manga / comics | MyAnimeList and AniList for manga; an appropriate established comics database otherwise |
| Novel / prose | Goodreads for the exact book/edition; another established book catalog when useful |
| Game | IGDB, Backloggd, or MobyGames; exact official store listing when useful |

- **Never invent URLs or present a database homepage as the title's page.** Link the correct season, edition, film, volume, or platform; omit links you cannot verify.
- A reference link is not automatically a source for every claim. Cite production, release, language, and sensitive-content claims next to their evidence.
- In rich output, group these destinations as compact secondary/outline **link-buttons**, with readable labels and real spacing. Use quiet host-native styling rather than a different brand color for every destination. Preserve actual link semantics and exact URLs. In Markdown, use ordinary descriptive links. Claim-level citations remain near their supporting claims; a reference-button row does not replace them.

Navigation destinations and evidence have different jobs. Research may still need official credits, publishers, language listings, content guides, and credible criticism. Cite the actual source near a supported claim; never relabel it as a database or attach an unrelated database link as evidence. Keep these necessary evidence links discreet and genuine.

### Evidence and sources

Before writing, determine the exact title, medium, version, progress and spoiler scope, platform or edition. Confirm official artwork, dates, creators, studio, and localization. Read credible expert criticism. Check sensitive content independently. Identify comparable works and cover sources. Verify sequels or status only if mentioned.

| Fact type | Preferred evidence |
| --- | --- |
| Plot, credits, release, edition, animation studio | Official publisher, creator, studio, developer, network, or distributor |
| Anime / manga metadata | Official title or publisher; AniList / MyAnimeList as support |
| Film / TV metadata | Official network or studio; IMDb / TMDB; BBFC where useful |
| Books | Author, publisher, or edition catalog; Goodreads for reader context |
| Games and Arabic support | Developer or publisher, official platform listing, patch notes, specialist testing |
| Dubbing and subtitles | Official platform or audio listings, broadcaster or licensor, credits; corroborated Dubbing Wiki/Fandom for specific casts |
| Content warnings | ESRB / PEGI / BBFC, Common Sense Media, verified content guides, corroboration |
| Critical assessment | Reputable specialist commentary plus your own independent interpretation |
| Posters and covers | Official publisher or studio, reputable image or database listings |

- Support verifiable and especially sensitive claims (content warnings, studio facts, dub and localization, release or version, disputed status) with **real, relevant citations**. Do not fabricate citations, and do not infer "none" from silence.
- Place compact citations at the end of a sentence or section rather than interrupting right-to-left prose with provider chips. Add a short source row only where useful.
- Treat fan wikis and crowdsourced databases as references with limits, especially for local dubs and availability. Prefer corroboration.
- If a source's summary label conflicts with its detailed entries, describe the supported details rather than copying the label. Distinguish observable content from disputed critical interpretation, especially for implied relationships. Do not silently generalize evidence for one season to an entire franchise.
- Base personal fit on preferences the user actually supplied. If a decisive boundary is unknown, give a clear conditional recommendation rather than inventing the user's position. Artistic evaluation remains separate.
- Outside scores are never a substitute for the editorial score.

### Fallbacks

Degrade only the unavailable feature. Without a verified cover, keep a text-only title entry inside the otherwise supported layout. Without chat-message actions, keep rich presentation and use the honest follow-up fallback in the follow-up section. Without rich rendering, use clean Markdown. Without adequate factual evidence, state meaningful uncertainty and omit unsupported claims; do not infer absence from silence. Never fabricate sources, covers, or controls. Follow the user's source/tool limits.

All visible artwork uses discovered remote image URLs, not downloaded files. See the optional gallery guidance in the visual presentation section.

## Visual presentation across hosts

Read before choosing a rich renderer. Preserve the editorial structure while using the host's supported components and visual identity. These are design intentions; dimensions are starting points, not universal pixel specifications.

### Choose capabilities independently

Inspect available tools, component documentation, and host instructions. A platform name does not prove that a component or chat bridge exists.

| Capability available here | Presentation |
| --- | --- |
| Native rich components | Prefer the host's cards, badges, typography, links, and supported actions |
| HTML or artifact surface | Build an accessible responsive review using documented theme and surface constraints |
| Chat-message actions | Use follow-up buttons with separate labels and fuller messages; see the Related works, verdict, and follow-up exploration section |
| Local interaction only | Keep useful tabs/details; use honestly labeled draft/copy alternatives for follow-ups where supported |
| Markdown only | Headings, a two-column score table, real links, and numbered follow-up prompts |

Combine capabilities: rich content may use native chat suggestions outside its artifact when supported. Missing chat actions need not remove rich visuals; missing images need not remove cards. Do not guess component names, message APIs, URL schemes, or parent-frame protocols. Do not request secrets, install dependencies, or start a server just for presentation.

### Hierarchy, cards, and density

- Use the host's spacing, typography, radii, neutral surfaces, and restrained accent styling.
- **Cards and borders are welcome.** Prefer a subtle bordered or surfaced hero, a grouped suitability card with internal dividers, compact related-work cards, and a distinct verdict card. Analysis can use grouped cards or open sections. Avoid nesting every paragraph in a card.
- **Only individual score rows must remain borderless.** The ratings section may sit in a shared card. This is not a ban on borders elsewhere.
- Give cards real internal padding and sections consistent vertical separation. Borders should remain distinguishable from canvas and card surface in light and dark themes.
- Respect outer-canvas rules. If the host prohibits an outer background or card, apply grouping only to interior sections.
- Keep body text readable. Stack the hero and related-work cards when needed; avoid horizontal scrolling, clipped controls, and a small fixed-height internal scroller for a long review when natural height is available.

### Badges and spacing

- Use semantic badges for recommendation and suitability, and small neutral badges for 2–4 genres. Do not badge every metadata item or heading.
- Positive recommendation: green; qualified: amber; negative: red. Suitability follows the Content suitability: exactly three categories section. Use readable labels and adequate foreground/background contrast.
- **Space the group, not just the inside of each badge.** Titles with badges, score with recommendation, genre lists, and link-buttons need wrapping row/stack layouts with a real gap. In HTML, use flex/grid `gap` and logical spacing, not text spaces or inline adjacency. Roughly 6–10 px between siblings and 12–16 px between groups are useful starting points.
- Internal padding does not separate a badge from the preceding title or score. Let badges wrap without squeezing headings.
- Use documented theme tokens. Do not assume a suffix such as `-surface` exists for every semantic color. Check neutral, green, amber, and red treatments in the available theme.

### Hero and Arabic typography

- Start with the complete Arabic opening sentence before the hero or any other visible review element.
- Use one authentic, preferably official portrait cover, roughly 120–160 px on desktop. Keep its aspect ratio; place beside metadata or stack when space requires.
- Show the translated Arabic title prominently and recognizable international title smaller. No routine Japanese script. See the Localization, studio identity, links, and evidence section.
- Include year, useful format/count or scope, genre badges, and concise credits. Show the actual animation studio by itself. Keep language availability to one short label/value.
- Label **التقييم النقدي** clearly and distinguish it from personal recommendation.
- Set RTL on the container where supported. Isolate scores, dates, and Latin names using supported bidirectional text handling; HTML can use `bdi` or suitably directed elements. Keep logical reading and keyboard order.

### Detailed ratings

- Prefer **two columns, no individual tiles or borders**: four rows per column for eight axes, three for six. Preserve fixed axis order in logical reading order, including accessible order.
- Show the full label, aligned one-decimal score, and slim meter. Stack only when readability requires. A shared enclosing card is allowed.
- Meter fill matches the 0–10 scale. Use subtle tracks and a restrained palette adapted to host tokens: teal for exceptional, blue for very good, muted gold for good, subdued caution below that. Numbers remain authoritative.
- Give meters accessible labels/values or hide decorative bars from assistive technology when adjacent text conveys the same information.
- Heading: «التقييم التفصيلي». No methodology paragraph, radar plot, duplicate dashboard, or ornamental legend. Overall score appears in hero and verdict.

### Analysis, suitability, and related works

- Strengths and weaknesses share consistent icons, brief headings, and explanatory text. Use host icons when available; avoid a new card or arbitrary color for every observation.
- One suitability card contains exactly three rows with dividers, spaced severity badges, and sufficient explanation. Never truncate warnings for card symmetry.
- Related works may use compact bordered cards or separated rows with authentic portrait covers (roughly 70–85 px), Arabic titles, similarity and distinction. Stack as needed. If artwork fails or cannot be verified, use a clean text entry without a broken image slot.
- Watch/read/play status appears only when known. Related-work cards are not automatically recommendations or navigation controls.

### References and actions

- Use recognizable database destinations as compact **secondary/outline link-buttons**: **MyAnimeList**, **AniList**, **IMDb**, **TMDB**, **Goodreads**, or a relevant game database. Show explicit service names, sufficient contrast, real gaps, and mobile wrapping. Do not substitute vague labels such as «المعلومات وفريق العمل» or «الحلقات». Apply this pattern to hero links, related works, and follow-up answers.
- Navigation remains a link even when styled as a button: use a host link component or anchor with a real URL. Preserve keyboard access, focus, and open/copy-link behavior.
- Claim-level citations remain near their claims. Reference buttons do not replace attribution or host citation requirements.
- Follow-ups are **actions**, not reference links; see the Related works, verdict, and follow-up exploration section.
- Keep visible focus, readable contrast, touch-friendly targets (around 44 px high where practical), and reduced-motion behavior. No hover/chevrons implying interaction on static elements.

### Delivery and verification

Use the host's prescribed preview/render workflow when available. Check narrow layout, badge wrapping, card boundaries, numeric direction, images, links, and actual control behavior. Do not send messages merely to test buttons; use documented wiring or a non-sending test mode.

If preview fails, distinguish inspection failure from rendering support. Use a documented render path if available, otherwise a clean fallback; never claim visual verification. Avoid repeating a full rendered review in chat unless a text alternative is required or requested.

### Compact hero: visual hierarchy

Keep the useful bordered card and poster, but avoid a large empty panel. Group title/international title, essential metadata, credits/language, genre badges, then score/recommendation and database links. Use content-driven height and consistent spacing rather than large margins between every line. Long international titles may wrap; keep Latin text aligned within the RTL composition rather than detached at the opposite edge.

Use real neutral genre pills, not unstyled words spaced across a row. Secondary metadata may be muted but must remain readable. Link-buttons need legible foregrounds and boundaries; low-contrast purple underlines on dark surfaces are not preferred. Keep the score prominent without dominating poster and title. Exact colors, fonts, radii, and dimensions follow the host.

### Optional remote-image gallery

When verified, spoiler-safe artwork adds useful context, include a compact gallery of about 3–5 distinct stills/backdrops after the overview or near related works. It supplements the hero and does not replace or consume the optional thematic analysis.

- Use discovered remote image URLs from TMDB, official media galleries, or other reputable artwork sources. All posters, related-work covers, and gallery images stay remote: **do not download, cache as local assets, embed as base64, or generate substitutes**. Normal host/browser loading is sufficient.
- Verify work, season/edition, and visible content. Avoid fan art presented as official, unrelated adaptations, ending images, or revealing captions. Never guess TMDB paths or invent URLs.
- Prefer a small responsive grid or supported native gallery with consistent ratios, restrained cropping, brief Arabic alt text, and source attribution where required. No autoplay, carousel dependency, or decorative poster duplicates.
- A larger view needs a real image link or documented lightbox. Otherwise use static images without fake zoom controls. Omit failed/unverified images or the gallery when external loading is unavailable.

## Related works, verdict, and follow-up exploration


### Related works

- Show **three genuinely relevant** titles when possible; fewer beats filler. Prefer real narrative, thematic, formal, or gameplay parallels over shared genre alone. Give **one similarity and one distinction** for each.
- Keep consistent labels and order for the three, so the comparison follow-up can refer to all three unambiguously.
- Never claim the user has watched, read, or played something unless that status is available and reliable. Never change a tracker silently. A comparison is not an automatic personal recommendation.

### Final verdict

- Compact conclusion with **the same editorial `x.x/10` as the hero** and a separate recommendation badge (**أنصح به بشدة / أنصح به**, **بشروط / بتحفظ**, **لا أنصحك به / غير موصى به لك**).
- **2–4 grounded sentences**: artistic merit, the important drawback, and why *this user* should engage or avoid. A high editorial score may sit beside a red recommendation.
- Do not change an anime or media tracker status unless explicitly asked.

### Five follow-up options

**Default: five distinct follow-up buttons that send a new user message when the host supports that action.** Use 3–4 only if five genuinely worthwhile topics cannot be supported. Avoid variants like "more analysis" repeated with different words. Both visible labels and sent messages must respect the spoiler boundary.

1. **فهم أعمق للعمل** — a particular character, decision, theme, or narrative mechanism, with specific evidence. No synopsis retelling.
2. **الأسئلة الفلسفية / الفكرة المحورية** — 2–3 work-specific ethical or philosophical questions with competing interpretations (or the central creative idea if philosophy does not fit).
3. **مقارنة بالأعمال الثلاثة** — explicitly compare the reviewed work with **the three titles just shown**: real similarities and differences in story, characters, atmosphere, execution, gameplay, or themes. If fewer than three were shown, reflect the real count and never invent a third.
4. **كيف صُنِع أو كيف يعمل؟** — a medium-specific deep dive (anime adaptation and animation, novel prose and viewpoint, film direction, game mechanics and technical design). Distinct from options 1 and 2.
5. **مدى ملاءمته لك / ماذا بعد؟** — a practical question: content concerns, viewing or reading order, edition or language choice, a sequel, or an evidence-backed next recommendation.

### Launcher design: five conversation action rows

Use a vertical list under «استكشف المزيد»: **one meaningful line icon at the right**, **a concise title with one short supporting description**, and **a left-pointing chevron at the far left** in RTL. The entire row is one keyboard-accessible action with a comfortable hit area, consistent spacing, and visible focus. Light separators, a subtle hover surface, or native host treatment are acceptable; large bordered cards are unnecessary here.

**These are conversation actions, not accordions.** Clicking should send the full follow-up message through a documented chat action. Do not replace sending with disclosure triangles, expandable prompt panels, numbered copy instructions, or exposed full prompts when sending is supported. A navigation chevron communicates continuing the conversation; it is not a disclosure indicator.

Prefer native conversation actions outside the artifact if that is where real sending is supported. This defines hierarchy and behavior, not exact component names or a fixed visual skin. If sending is unavailable after checking documented capabilities, use the honest fallback below and explain it once; never present it as equivalent to auto-send.

### Separate the label from the message

For each follow-up, prepare a **visible label** and a **full user-message payload**. The following fields are a conceptual content model, not a host API or literal markup:

- `label`: concise action/topic, such as «تحليل رينتارو وكاوروكو».
- `description`: short preview, such as «واقعية الشخصيتين وتطورهما النفسي»; not the full sent message.
- `message`: a self-contained request identifying the reviewed title and version/scope, the chosen topic, relevant related titles, known spoiler boundary, and useful output instructions.
- `behavior`: the action actually supported here: send, prepare a draft, copy, or text-only fallback.

Example visible row:

- Title: **تحليل رينتارو وكاوروكو**
- Description: **واقعية الشخصيتين وتطورهما النفسي**
- Sent message:

> حلّل شخصيتي رينتارو وكاوروكو نفسيًا ودراميًا في الموسم الأول من The Fragrant Flower Blooms With Dignity، مع أمثلة وتقييم لمدى واقعيتهما، وميّز بين سماتهما الفردية وطريقة تطور العلاقة بينهما. التزم بحدود الحرق التي حددتها في المحادثة؛ إن لم أحدد تقدمي، اكتفِ بأمثلة من المقدمة ولا تكشف أحداثًا لاحقة.

This illustrates action writing, not factual evidence about the anime or permission to assume viewing progress. Give each row its own tailored payload, not one generic message with a different label.

Adapt names and content to the actual review; use the chosen Arabic titles where available. The fuller message may add helpful context and constraints beyond its label, but must deliver the advertised topic. Never embed hidden spoiler consent, invented preferences, tracker mutations, paid actions, or unrelated requests. If progress is unknown, say so rather than inventing an episode boundary. Do not expose the payload as a large block beside every button when a real send action is available.

### Capability-based action behavior

1. **Documented send-message action:** bind the button to the full message using the supported host mechanism. Clicking sends that message into the current conversation to request a new answer. Follow host confirmation behavior if any; never simulate a successful send. Do not trigger it automatically during rendering or validation.
2. **Draft/prefill only:** use it and label the behavior clearly, for example «جهّز سؤال المقارنة». Do not imply the message has been sent.
3. **Clipboard only:** use a working copy action labeled «انسخ سؤال المقارنة», with visible success/failure feedback. If clipboard access is unavailable, reveal selectable prompt text instead and describe that behavior accurately.
4. **No action support:** show numbered labels with concise ready-to-send prompts, or a compact list the user can select by number. Explain the limitation once. Never draw fake buttons or invent a chat bridge.

An HTML artifact may support local JavaScript without permission or an API to send chat messages. A local tab change, expandable paragraph, copied string, URL navigation, or DOM event is not a sent message. Do not invent `postMessage` protocols or special chat URLs. Supported native chat actions outside an artifact are preferable to imitation buttons inside it.

Keep **launching the follow-up** separate from **interaction inside its answer**: the launcher requests new analysis; the resulting answer may then contain working tabs, selectors, and details.

### What each follow-up delivers

The **first line of every Arabic follow-up response is an informative Arabic sentence**, as in the main review. Give each follow-up its own scope and composition. Do not reuse the full review template or repeat all five topics inside the reply.

| Follow-up type | Working interaction (only if it genuinely works) |
| --- | --- |
| Character / theme | Select a character or theme to reveal distinct, evidence-based analysis; expandable cards if supported |
| Philosophical questions | Select among distinct work-specific questions; show competing interpretations and the tension, spoiler-safe, without repeating the main review |
| Comparison with the three | Compact 4-work comparison matrix or responsive cards; a real lens selector (story / characters / atmosphere / craft / mechanics) that actually updates the comparison |
| Medium-specific craft | Tabs or segmented choice between mechanics, directing choices, adaptation differences, art, or prose; visuals only when trustworthy |
| Personal fit / next step | A real choice of concern (violence, pacing, language, edition) that updates the guidance, without pseudo-precision and without secretly altering editorial scores |

Rules that apply to all of them:

- Use cards, grids, selects, segmented controls, toggles, and expandable views when they materially help and truly change information or trigger the advertised action. A static visual beats a broken interaction. In plain text, preserve the topics and ready-to-send requests.
- **Comparisons stay fair.** No invented scores for compared works, no false equivalence, no made-up facts about works not reviewed, no speculation about the user's preferences. If accurate ratings for the comparables are unavailable, compare qualitatively rather than with a fabricated numeric chart.
- Ask for spoiler permission before exposing restricted details. Never hide spoilers in button labels or click prompts.
- If a philosophical section already appeared in the review, follow-ups should advance or broaden it.

## Final QA checklist

- [ ] The first visible line is a natural, substantive Arabic sentence; a faithful Arabic title is preferred, with no routine Japanese-script title.
- [ ] Correct work and version; real compact cover; studio named plainly; no verification commentary.
- [ ] One short dub line (anime/animation) or Arabic-support line (games), distinguishing unknown from absent.
- [ ] Correct fixed axes, borderless two-column bars, no per-axis cards, no methodology paragraph.
- [ ] Strengths and weaknesses are real and specific; no forced weaknesses.
- [ ] Philosophical section only when depth warrants it.
- [ ] Exactly three suitability categories in order, correct four labels, neutral "معلومات غير كافية" only when unverified; the Islamic-creed row is brief when clear.
- [ ] Three genuine related works with similarity and distinction, or fewer.
- [ ] Verdict repeats the hero score and gives an independent recommendation.
- [ ] Cards have clear boundaries and padding; badges have real gaps and wrap without collisions; genres may use neutral badges. Respect the host's own visual identity.
- [ ] Five distinct follow-ups, including comparison with all displayed related works; short button labels map to fuller, spoiler-safe messages. Send, draft, copy, and local controls are not confused.
- [ ] Real reference links use compact link-buttons where supported; claim-level citations remain traceable. No broken images, fake controls, or unsupported syntax.
- [ ] Verify rendering and interaction when tools allow; do not claim checks passed if preview or action testing failed. Fall back only for the affected capability.
- [ ] Hero is compact and content-driven; genres are actual badges; secondary text and link-buttons remain readable.
- [ ] Work-navigation links use verified, explicitly named databases appropriate to the medium, including related works; evidence citations identify actual supporting sources.
- [ ] Follow-ups use icon/title/description/RTL-chevron action rows, not accordions; each sends a distinct contextual message where supported.
- [ ] Artwork uses verified remote URLs without downloading or base64; optional galleries are compact, attributed where required, and spoiler-safe.
- [ ] This file contains all required guidance with no companion-file dependency.

*Guideline set version 2.8 (2026-11-02).*
