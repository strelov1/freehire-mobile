## Context

Full exploration and the negotiated design live in
`docs/superpowers/specs/2026-08-13-bottom-tab-bar-design.md`; this restates
the decisions in OpenSpec's format.

The app currently has one root screen (`src/app/index.tsx`, the feed) with a
bell + avatar in its header, both opening full-screen modals. No bottom tab
bar exists. `src/app/companies/[slug].tsx` is the only companies-related
route (a detail page) — there is no list/search API for companies.

## Goals / Non-Goals

**Goals:**
- Four-tab bottom bar (Jobs/Companies/Notifications/Profile) replacing the
  header's bell/avatar.
- Auto-hide on scroll-down past a small threshold, reappear on scroll-up,
  wired to the Jobs feed.
- Notifications and Profile render inline in their tab instead of as modals.

**Non-Goals:**
- A real Companies list/search screen or backing API (placeholder only).
- Persisting the active tab across restarts.
- Scroll-hide on tabs that don't have long scrollable content yet.

## Decisions

**Route restructuring via an `(tabs)` group.**
`index.tsx`, `notifications.tsx`, `profile.tsx` move under
`src/app/(tabs)/`; a new `companies.tsx` placeholder joins them. `(tabs)` is
a route *group* (parentheses), so `/` still resolves to `(tabs)/index`
automatically — no deep-link/push-notification handler changes needed
(`useNotificationDeepLink` in `_layout.tsx` only targets `/jobs/[slug]`).
`jobs/[slug]`, `companies/[slug]`, `filters`, `filters/quick`, `auth`,
`notifications/[id]` stay root-level siblings of `(tabs)`, unaffected in how
they push/present over it.

**Custom tab bar instead of the default `tabBarStyle`.**
Alternatives considered: default static tab bar (no animation — fails the
requirement); toggling `tabBarStyle.display` (causes a layout jump instead
of a slide). Chosen: a custom component passed to `Tabs`'s `tabBar` render
prop (available since expo-router's `Tabs` wraps
`@react-navigation/bottom-tabs`), animated via a Reanimated `SharedValue`
`translateY`.

**Shared scroll-visibility state via a small context, not prop drilling.**
The tab bar and the Jobs feed are siblings in the tree (feed is a screen
inside `(tabs)`, the bar is part of `(tabs)/_layout.tsx`), so they can't
share state through props. A `TabBarVisibilityProvider` (mounted in the
root `_layout.tsx` alongside `FilterProvider`) exposes a Reanimated
`SharedValue<number>` (0 = shown, 1 = hidden) both sides read/write
directly — worklet-safe, no re-renders on every scroll frame.

**Direction detection: pure function, tested in isolation.**
`nextTabBarHidden(current, delta, offset)` — hides when `delta > 8` (scrolled
down) and `offset > 40` (past the very top, so the bar doesn't flicker on
initial small movements); shows immediately when `delta < 0` (any upward
scroll) or `offset <= 40`. Kept as a standalone, framework-free function
(`src/lib/tabBarVisibility.ts`) so it has real unit tests instead of only
manual verification, unlike the rest of this UI-heavy change.

**Notifications/Profile screens reused near-verbatim.**
Drop their own modal header (title + dismiss-X) and top safe-area edge
(irrelevant under a tab); keep their data hooks (`useUnreadCount`,
`useAuth`, `useProfile`) and content unchanged. Profile gains one new
branch: signed-out renders an inline "Sign in" prompt (button pushes
`/auth`) instead of the tab itself redirecting to the modal.

**Companies placeholder** is fully static — no data fetching, an icon +
"Coming soon" text using existing design tokens.

## Risks / Trade-offs

- **[Risk]** Custom tab bar loses `@react-navigation/bottom-tabs`'s built-in
  safe-area handling and badge rendering.
  → **Mitigation:** small, fixed scope (4 icons, 1 badge) — implement by
  hand with `SafeAreaView`/existing badge styles already used elsewhere in
  the app (the search bar's active-filter badge).
- **[Risk]** Removing `notifications.tsx`/`profile.tsx` as standalone modal
  routes could break something that pushes them directly by path.
  → **Mitigation:** grep the codebase for `router.push('/notifications'`
  and `router.push('/profile'` before deleting; update every call site to a
  tab switch (`router.navigate` to the `(tabs)` route, or equivalent) in the
  same commit.
- **[Trade-off]** Auto-hide only wired to Jobs this iteration; acceptable
  since other tabs don't yet have enough scrollable content to need it, and
  the shared value makes wiring a second screen later a small addition.

## Migration Plan

Additive/structural, no data migration, no API changes. Ships in the same
branch/worktree as `add-search-region-clear-button` to avoid re-paying the
local iOS native-build cost already sunk this session (see that change's
notes on CocoaPods/Maven connectivity). Rollback is a plain revert.

## Open Questions

None — confirmed with the user: tab bar replaces the header bell/avatar;
Companies is a placeholder; Notifications renders inline; Profile shows an
inline sign-in prompt when signed out.
