---
name: shadcn
description: Compose, inspect, add or update shadcn registry components. Use for existing shadcn primitives, registry and preset tasks, component APIs, or shadcn design-system work.
---

# Work with shadcn in Nahhasio

- For the desktop, run `pnpm --dir apps/linux/ui exec shadcn info --json` and
  `pnpm --dir apps/linux/ui exec shadcn docs <components>` with the project environment.
  Check [components.json](../../../apps/linux/ui/components.json) and the installed component source.
  Use the lockfile's CLI and official registry when adding or refreshing a component.
- Desktop uses Base UI Maia/Mist, Tailwind 4, Lucide, and Arabic RTL. Use Base UI's installed
  API, including `render` for composition, and follow [desktop design rules](../../../docs/desktop/design-rules.md).
  Keep caller layout in feature code and fix caller errors there.
- The static [website](../../../apps/website/README.md) has its own primitives and a static renderer.
  Use the website's existing API and keep it independent of the desktop component tree.
- Consult the [vendored workflow and examples](references/workflow.md) for composition details,
  CLI, registry operations or design-system work. In generic examples use the installed CLI
  and compare the installed Base UI APIs. The [official shadcn skill docs](https://ui.shadcn.com/docs/skills)
  describe the upstream workflow.
