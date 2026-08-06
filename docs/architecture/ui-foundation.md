# Shared UI foundation

Status: accepted on 2026-08-06

## Context

The application currently expresses the same visual and interaction patterns
with repeated Tailwind utility strings. Buttons, links, fields, alerts, cards,
and page shells have begun to diverge, while dark-mode support depends on a
large set of selector-specific overrides. The application does not currently
have dialogs, menus, comboboxes, or other widgets that require a headless
interaction library.

The foundation must work with React Router, React 19, server rendering, and
Tailwind CSS 4. It must also make semantic links and buttons distinguishable,
keep feature behavior out of shared UI, and avoid turning one cleanup into a
broad visual migration.

## Decision

Use the shadcn/ui Radix catalog as the source and design-system baseline, with
semantic HTML as the default primitive. Add a Radix primitive only when native
HTML cannot provide the required behavior, focus management, or composition.
This is a source-owned component model rather than a packaged component-suite
abstraction: generated code is committed under `app/ui/`, reviewed, tested,
and adapted to this application.

This choice is compatible with shadcn/ui's documented
[React Router installation](https://ui.shadcn.com/docs/installation/react-router)
and its [Tailwind CSS 4 and React 19 support](https://ui.shadcn.com/docs/tailwind-v4).
Radix documents that its primitives follow WAI-ARIA patterns and provide
keyboard navigation, focus management, and appropriate roles where those
behaviors are not native; see the
[Radix accessibility overview](https://www.radix-ui.com/primitives/docs/overview/accessibility).

Do not add a headless runtime to wrap a native input, label, alert, or card.
For a future complex widget, use the Radix implementation from the selected
catalog unless a focused evaluation demonstrates that it cannot meet the
requirement. Do not mix headless libraries within one interaction pattern.

## Representative spike

A small production bundle rendered a button, input, label, and alert using
semantic HTML and each currently supported shadcn base. React, React DOM, and
CSS were external so the result measures only the incremental component
runtime. Every variant also completed a React server render.

| Primitive approach | Minified | Gzipped | Server render |
| ------------------ | -------: | ------: | :-----------: |
| Semantic HTML      |  0.42 KB | 0.23 KB |      yes      |
| Radix               |  5.56 KB | 2.09 KB |      yes      |
| Base UI             | 26.15 KB | 7.62 KB |      yes      |
| React Aria          | 60.20 KB | 15.96 KB |      yes      |

The spike used React 19.2.8, Vite 8.2.0, `radix-ui` 1.6.7,
`@base-ui/react` 1.7.0, and `react-aria-components` 1.20.0. These values are a
comparison of one representative slice, not a bundle budget or a prediction
of a complete application's size. They support keeping simple controls native
and show that Radix has the lowest incremental runtime among the evaluated
headless bases for the behavior this application is likely to add next.

Base UI and React Aria both provide documented accessibility foundations; see
the [Base UI accessibility guide](https://base-ui.com/react/overview/accessibility)
and [React Aria documentation](https://react-aria.adobe.com/). React Aria's
broader internationalization and interaction system is valuable but not
currently required. Base UI is a viable alternative, but selecting it would
add more runtime to this representative slice without solving a current gap.
Re-evaluate the selected base if concrete widget requirements expose a Radix
limitation rather than adopting a second base by default.

## Component scope and sequence

The first standardization work is intentionally split into reviewable slices:

1. Semantic color, spacing, radius, focus-ring, and light/dark theme tokens,
   plus the class-name utility required by source-owned components.
2. `Button`, `ActionLink`, and `TextLink`. Links retain anchor or router-link
   semantics; shared variants may align an action link visually with a button
   without rendering one element inside the other.
3. `Input`, `Textarea`, `NativeSelect`, and a small `Field` composition for
   label, description, and error relationships.
4. `Alert`, `Card`, and `PageShell`, with feature-specific content and policy
   remaining in the owning feature.
5. Migrate one feature or route at a time, deleting superseded styles and
   tests in the same focused change.

Complex components such as dialog, select, menu, popover, and combobox are not
part of the initial set. Add one only in the change that introduces a concrete
product need for it.

## Accessibility and theming contract

Shared components preserve native semantics and expose the attributes needed
by callers instead of inferring product policy.

- Buttons use `button` semantics and declare a type. Navigation uses links.
- Every control has an accessible name. Field descriptions and errors are
  connected with stable IDs and `aria-describedby`; invalid controls expose
  `aria-invalid`.
- Alerts do not receive a live-region role merely because they look like an
  alert. The caller selects `alert`, `status`, or no live behavior based on
  when and how the message appears.
- Focus remains visible for keyboard users, disabled and pending states are
  distinguishable, and interactive targets retain the application's current
  minimum height.
- Tests assert roles, accessible names, states, and keyboard-visible behavior
  rather than generated element structure or utility-class strings.

Theme values become semantic CSS custom properties exposed through Tailwind
CSS 4's `@theme` integration. Components consume names such as background,
foreground, muted, border, primary, destructive, and focus ring rather than
hard-coded Slate, amber, and red palettes. Every component change is reviewed
in light and dark themes, including hover, focus, disabled, invalid, and
message states. The existing system/light/dark preference behavior remains the
source of theme state.

## Ownership and updates

`components.json` records the selected Radix base, aliases, and Tailwind setup
when the first implementation slice is added. Files generated by shadcn/ui are
starting points owned by this repository; the CLI is not run with blanket
overwrite during routine dependency updates.

Before adopting an upstream component change:

1. Inspect it with the shadcn CLI's `view`, `diff`, or `--dry-run` support as
   described in the [CLI documentation](https://ui.shadcn.com/docs/cli).
2. Apply the change in a component-scoped commit and review generated source,
   runtime dependencies, server/client boundaries, theme states, and tests.
3. Reapply intentional local adaptations and run the canonical verification
   suite. The shadcn Tailwind guide explicitly notes that overwrite updates can
   replace local component changes and must be reviewed.

Prefer direct Radix packages for the primitives actually used when that keeps
the installed dependency graph smaller than the aggregate package. New icon,
animation, form, or notification packages require their own demonstrated use;
they are not adopted solely because an upstream example includes them.

## Consequences

The application gains a consistent component vocabulary and an upstream source
of accessible interaction patterns without paying for a headless abstraction
on simple HTML. The repository also accepts responsibility for reviewing and
maintaining its copied component source. Some intentional divergence from the
latest registry output is expected, so updates require a source diff rather
than a version-only dependency bump.
