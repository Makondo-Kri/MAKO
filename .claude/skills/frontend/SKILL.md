---
name: frontend
description: Use when building, reviewing, or modifying frontend/UI code in this repo — components, pages, styling, client-side state, and accessibility. Triggers on requests to add a component, build a page or view, style something, fix a UI bug, or review frontend changes.
---

# Frontend

Guidance for frontend work in this repository. Follow the stack and conventions
actually present in the codebase — inspect `package.json` and existing
components before assuming a framework, styling approach, or component
library.

## Before writing code

1. Find an existing component similar to what you're building and match its
   structure, naming, props style, and file layout.
2. Check for a design system or shared component library before creating new
   primitives (buttons, inputs, modals) — reuse what exists.
3. Note the styling approach in use (CSS modules, Tailwind, styled-components,
   plain CSS, etc.) and stay consistent within a file/feature; don't mix
   approaches in the same component tree.

## Building components

- Keep components small and focused; lift state up only as far as it needs to
  go, don't reach for global state for local UI concerns (open/closed,
  hover, form field values).
- Name props and files consistently with neighboring code, not with a new
  convention.
- Handle loading, empty, and error states explicitly for anything that
  fetches or derives data — don't leave a bare happy path.
- Prefer semantic HTML elements (`button`, `nav`, `label`, `table`) over
  generic `div`/`span` with ARIA bolted on, except where the design system
  already provides an accessible primitive.

## Accessibility

- Interactive elements must be keyboard-operable and have a visible focus
  state.
- Images need meaningful `alt` text (or `alt=""` when purely decorative).
- Form inputs need an associated label.
- Don't rely on color alone to convey state (error, success, disabled).

## Verifying changes

- Start the project's dev server and exercise the changed UI in a browser
  before calling the task done — check the golden path and at least one edge
  case (empty state, long text, small viewport).
- Run the project's lint/typecheck/test scripts if defined in `package.json`.
- Watch for regressions in nearby UI, not just the element you changed.

## Common pitfalls to avoid

- Introducing a new styling method or component library when one is already
  in use.
- Adding client-side state for data that's actually server state (prefer the
  project's existing data-fetching pattern, e.g. a query library, over ad hoc
  `useEffect` fetches).
- Skipping responsive/overflow handling for tables, wide content, or long
  strings.
