## Why

The feed's header currently packs a search bar, a notifications bell, and a
profile/sign-in avatar into one row, and both the bell and avatar open
full-screen modals. As the app grows past a single screen, that header
doesn't scale as primary navigation. The user wants a standard bottom tab
bar — Jobs, Companies, Notifications, Profile — that auto-hides while
scrolling the feed and reappears on scroll-up, matching common mobile app
conventions. Full design in
`docs/superpowers/specs/2026-08-13-bottom-tab-bar-design.md`.

## What Changes

- Introduce an `(tabs)` route group with four tabs: **Jobs** (today's feed,
  header shrinks to just the search bar), **Companies** (a "coming soon"
  placeholder — no list API exists yet), **Notifications** (today's
  notification list rendered inline instead of as a modal, unread badge
  moves to the tab icon), **Profile** (today's profile screen rendered
  inline; shows an inline "Sign in" prompt when signed out instead of
  redirecting to the `auth` modal).
- Add a custom animated tab bar that hides on scroll-down (past a small
  threshold) and reappears on scroll-up, driven by the Jobs feed's scroll
  position via a small shared Reanimated value.
- **BREAKING (internal):** `router.push('/notifications')` and
  `router.push('/profile')` calls become tab switches; the standalone
  `notifications.tsx` and `profile.tsx` modal routes are removed. `auth.tsx`
  remains for the explicit "Sign in" action from the Profile tab.

Deferred (not in this change): a real Companies list/search screen and its
API; persisting the last-active tab; scroll-hide on Companies/
Notifications/Profile (none scroll enough yet to need it).

## Capabilities

### New Capabilities
- `bottom-tab-navigation`: the four-tab bottom navigation bar (Jobs,
  Companies, Notifications, Profile), including its scroll-driven
  auto-hide/show behavior and each tab's entry content.

### Modified Capabilities
<!-- None — openspec/specs/ has no synced capabilities yet to modify against. -->

## Impact

- **Screens:** `src/app/index.tsx` moves to `src/app/(tabs)/index.tsx`;
  `src/app/notifications.tsx` moves to `src/app/(tabs)/notifications.tsx`
  (dropping its modal header/dismiss-X); `src/app/profile.tsx` moves to
  `src/app/(tabs)/profile.tsx` (dropping its modal header, adding an inline
  signed-out state); new `src/app/(tabs)/companies.tsx` placeholder; new
  `src/app/(tabs)/_layout.tsx` (Tabs navigator with the custom tab bar).
- **Navigation:** `src/app/_layout.tsx`'s root `Stack` registers `(tabs)`
  instead of `index`; `jobs/[slug]`, `companies/[slug]`, `filters`,
  `filters/quick`, `auth`, `notifications/[id]` remain root-level siblings,
  unaffected in how they push/present.
- **New shared module:** a small context/provider exposing a Reanimated
  `SharedValue` for tab-bar `translateY`, mounted in `_layout.tsx`.
- **Reuse:** existing design tokens (`constants/freehire.ts`), `useAuth`,
  `useProfile`, `useUnreadCount`, `expo-symbols` icons, `react-native-reanimated`
  (already a dependency).
- **Tests:** unit test for the scroll-direction-to-visibility logic (pure
  function, testable without rendering); everything else is UI, verified
  manually in the iOS simulator per this project's existing convention.
