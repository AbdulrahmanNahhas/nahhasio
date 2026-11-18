# Nahhasio release notes

[Documentation index](../README.md) · [Deployment procedure](../operations/deployment.md) · [Operations runbook](../operations/runbook.md)

| Version                     | Channel | What the repository records                                                                        |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| [0.2.0-rc.1](0.2.0-rc.1.md) | RC      | Signed RC cutover recorded on the family PC; playback, restore, and reboot acceptance are separate |
| [0.1.3](0.1.3.md)           | Alpha   | Calendar, desktop presentation, and remembered-account changes                                     |
| [0.1.2](0.1.2.md)           | Alpha   | Flatpak player startup and browsing fixes                                                          |
| [0.1.1](0.1.1.md)           | Alpha   | Coordinated host-tool updates and a one-time upgrade for the original worker                       |
| [0.1.0](0.1.0.md)           | Alpha   | Initial signed server and client deployment and catalog transfer                                   |

These are versioned records, not a live inventory or permission to deploy. For the version last
observed on the family PC, read the [dated host handoff](../operations/family-server.md).

For a new release, add `docs/releases/<version>.md` and link it here. Record the channel, what
changed, compatibility or one-time prerequisites, and verification by environment. Link to the
runbook for reusable commands and the host handoff for dated installation evidence. Do not mark
build, publication, installation, or runtime acceptance complete without evidence for that step.
