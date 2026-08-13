# Bottom tab bar: Jobs / Companies / Notifications / Profile

Date: 2026-08-13

## Context

The app currently has a single root screen (the feed at `src/app/index.tsx`)
with a bell (notifications) and avatar (profile/sign-in) icon in its header
row, both opening full-screen modals (`notifications.tsx`, `profile.tsx` /
`auth.tsx`). There is no bottom tab bar and no "Companies" screen — only a
per-company detail route (`src/app/companies/[slug].tsx`); no API exists yet
to list/search companies.

The user wants the header's bell/avatar replaced by a bottom tab bar with
**Jobs / Companies / Notifications / Profile**, which auto-hides on scroll
down and reappears on scroll up.

## Goals

- Bottom tab bar with 4 tabs, replacing the header's bell + avatar.
- Notifications and Profile become inline tab content (no longer modals).
- Companies is a placeholder ("Coming soon") — no list API exists yet.
- Tab bar hides on scroll-down past a small threshold, reappears on scroll-up
  or near the top of the list — applies to the Jobs feed (the only
  scrollable list today; Companies/Notifications/Profile don't need it yet
  since they're short/static).
- Job detail, company detail, Filters, Quick filters, and the auth modal
  keep pushing/presenting over the tab bar exactly as they do today.

## Non-Goals

- Building a real Companies list/search screen or its API — placeholder only.
- Persisting the last-active tab across app restarts.
- Any change to what each tab's underlying screen *does* beyond removing
  their modal presentation and header duplication (Notifications' unread
  logic, Profile's sign-in/sign-out flow, etc. are unchanged).

## Decisions

**Route restructuring: introduce an `(tabs)` group.**
`src/app/index.tsx` (Jobs), a new `src/app/(tabs)/companies.tsx`, the
existing `src/app/notifications.tsx` and `src/app/profile.tsx` move under
`src/app/(tabs)/`. `jobs/[slug]`, `companies/[slug]`, `filters`,
`filters/quick`, `auth`, and `notifications/[id]` stay as siblings of the
group at the root `Stack`, so they still push/present as full-screen
routes over the tab bar — this is the standard expo-router pattern and
requires no change to how those screens navigate today.

**Custom tab bar, not the default `tabBarStyle`.**
Alternative considered: static `Tabs` with the default tab bar (no
animation) — rejected, doesn't meet the auto-hide requirement. Also
considered: driving hide/show through `tabBarStyle`'s `display` — rejected,
causes a layout jump instead of a slide. Chosen: a custom tab bar component
(`Tabs.tabBar` render prop over `@react-navigation/bottom-tabs`, which
expo-router's `Tabs` wraps) using a shared Reanimated value for
`translateY`, driven by scroll direction from the feed.

**Scroll-direction tracking lives in a small shared store, not local state
per screen.**
The feed screen owns the `FlashList`'s `onScroll`; the tab bar is a sibling
in the layout tree, not a child, so they can't share state via props
without lifting it above the `Stack`. A tiny context (`TabBarVisibility`
provider, mounted in `_layout.tsx` alongside `FilterProvider`) exposes a
shared Reanimated `SharedValue<number>` for the bar's `translateY`; the
feed's scroll handler updates it directly (worklet-safe, no re-renders).
Screens that don't scroll (Companies placeholder, first cut of
Notifications/Profile) simply never touch it, so the bar stays visible
there by default.

**Direction detection: threshold + delta, not raw scroll position.**
Track the last offset; on each scroll event, if `offset - lastOffset` >
8px scrolling down past the top 40px, hide; if negative (scrolling up) at
any point, show immediately. This avoids the bar flickering on small
bounces (overscroll, tiny jitter) while still feeling responsive to an
intentional scroll-up.

**Notifications and Profile keep their existing screen components almost
verbatim**, just stripped of their own header's dismiss-X and modal
`SafeAreaView` edges (`top` becomes irrelevant under a tab bar screen,
`bottom` is handled by the tab bar itself). Their data hooks
(`useUnreadCount`, `useAuth`, `useProfile`) are unchanged.

**Companies placeholder** is a static screen: a centered icon, "Companies —
coming soon" text, using the same design tokens as the rest of the app. No
data fetching, no list.

## Risks / Trade-offs

- **[Risk]** Restructuring `src/app/index.tsx` into `(tabs)/index.tsx` moves
  a file expo-router treats as the app's root route — any external deep
  link or push-notification handler pointing at `/` must still resolve.
  → **Mitigation:** `(tabs)` is a *group* (parentheses = doesn't appear in
  the URL), so `/` still resolves to `(tabs)/index` automatically; verified
  by checking existing deep-link handling in `_layout.tsx`
  (`useNotificationDeepLink` only pushes to `/jobs/[slug]`, unaffected).
- **[Risk]** A custom tab bar means losing some default
  `@react-navigation/bottom-tabs` conveniences (safe-area handling, badge
  rendering) — must be re-implemented by hand.
  → **Mitigation:** scope is small (4 static icons, 1 badge), well within
  what the existing `expo-symbols` + `Space`/`Radius` tokens already cover.
- **[Trade-off]** Auto-hide only wired to the Jobs feed for this iteration;
  Companies/Notifications/Profile don't scroll-hide. Acceptable since none
  of them have long scrollable content yet (Companies is a placeholder,
  Notifications/Profile are short lists/forms) — can be extended later by
  reusing the same shared value.

## Migration Plan

Additive/structural, no data migration. Ships as part of the same
`add-search-region-clear-button` branch/PR to avoid re-paying the local
iOS native build cost already sunk in this session; tracked as its own
OpenSpec change for clarity. Rollback is a plain revert of the commit(s).

## Open Questions

None outstanding — confirmed with the user: tab bar replaces the header
bell/avatar; Companies is a placeholder; Notifications renders inline (not
a modal); Profile shows an inline "Sign in" prompt when signed out.
