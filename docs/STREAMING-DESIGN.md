# Streaming selection redesign — preparation checkpoint

The source picker is a small viewing desk for Nahhasio's Arabic family library. It answers:
which source to try, which audio is being requested, what subtitle facilities were reported,
and what remains unknown for this exact film or episode.

## Visual plan

Retain the current semantic palette, approximately: background charcoal #0a0a0a, raised surface
#171717, secondary surface #252525, foreground #fafafa, muted ink #a3a3a3, action violet #6149f7.
These are descriptive references; feature code uses the existing theme tokens. Noto Sans Arabic
and Noto Sans remain the reading faces; Plex Arabic gives the section heading its familiar voice.

RTL reading order, normal-case provider names and restrained badges. A searchable vertical
provider list replaces the button grid. Selection reveals one detail panel and one explicit
Play action. DUB/SUB indicates a request, not detected audio. Subtitle, Arabic-subtitle and
upload capabilities each have a separate evidence state. No remote logos, decorative hero,
animated backdrop or network requests on hover. The list remains usable with keyboard and
at narrow widths; selection, search and the More disclosure are ephemeral to the current viewing session.

    [Torrent / Video servers]                 [source count]
    [English dub] [search provider]
    [provider, DUB, optional verified star]          [selected source]
    [provider, DUB, optional verified star]          [subtitle / Arabic / upload]
    [Want more?: secondary/problem options]        [short evidence notes]
                                             [Play selected source]

At drawer widths, the selected-source panel stays above the list. In the work-page video slot,
it can sit beside the list. One coherent surface and row dividers replace repeated cards.

## Critique before implementation

A provider-card gallery would repeat the previous problem: audio, subtitles and failures become
hidden in many tiny panels. Use a single detail surface and explicit launch instead. Keep test-status labels out of the viewing UI; previous manual reports are historical evidence, never a green
availability indicator for another title. The empty playback matrix is separate from all UI,
URL-construction and privacy-filter tests.

Preferred stars require confirmed English audio and Arabic captions together for the exact
film/episode. They sort first; broader subtitle capabilities do not create a star. Provider
configuration and test evidence belong in the versioned registry and test matrix.
