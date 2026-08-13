## 1. Scroll-visibility logic (TDD, pure function)

- [ ] 1.1 Write failing tests for `nextTabBarHidden(current: boolean, delta: number, offset: number): boolean` in a new `src/lib/tabBarVisibility.ts`: hides when `delta > 8` and `offset > 40`; shows when `delta < 0`; shows when `offset <= 40` regardless of delta; otherwise returns `current` unchanged (small deltas within the dead zone don't flip state).
- [ ] 1.2 Implement `nextTabBarHidden` until tests pass.

## 2. Shared tab-bar-visibility context

- [ ] 2.1 Add `src/lib/tabBarVisibility.tsx` (or extend the file above): a `TabBarVisibilityProvider` + `useTabBarVisibility()` exposing a Reanimated `SharedValue<number>` (`translateY`, 0=shown) and a plain JS setter that (a) tracks last scroll offset, (b) calls `nextTabBarHidden`, (c) animates the shared value via `withTiming` when the boolean flips.
- [ ] 2.2 Mount `TabBarVisibilityProvider` in `src/app/_layout.tsx` alongside `FilterProvider`.

## 3. Route restructuring into `(tabs)`

- [ ] 3.1 Create `src/app/(tabs)/` and move `src/app/index.tsx` into
      `src/app/(tabs)/index.tsx` unchanged except: remove the bell and
      avatar `Pressable`s (and their now-unused imports/handlers) from the
      header row, feed the `FlashList`'s `onScroll` into
      `useTabBarVisibility()`'s setter.
- [ ] 3.2 Move `src/app/notifications.tsx` into
      `src/app/(tabs)/notifications.tsx`: drop the header `View` (title +
      dismiss-X), keep `SafeAreaView edges={['top']}` only (bottom is the
      tab bar's job), everything else (data hooks, `NotificationCard`,
      list/empty/error states) unchanged.
- [ ] 3.3 Move `src/app/profile.tsx` into `src/app/(tabs)/profile.tsx`: drop
      the header `View`; add a signed-out branch (checked via `useAuth()`'s
      `user`) rendering a centered icon + "Sign in" button
      (`onPress={() => router.push('/auth')}`) instead of the existing
      identity/profile/sign-out content.
- [ ] 3.4 Create `src/app/(tabs)/companies.tsx`: a static centered
      icon + "Companies — coming soon" screen, no data fetching, styled
      with existing `Space`/`Radius`/color tokens.
- [ ] 3.5 Delete the now-empty root `src/app/notifications.tsx` and
      `src/app/profile.tsx` (content fully moved in 3.2/3.3). Keep
      `src/app/notifications/[id].tsx` and `src/app/auth.tsx` at the root
      (unaffected).

## 4. Custom animated tab bar

- [ ] 4.1 Create `src/app/(tabs)/_layout.tsx`: a `Tabs` navigator with
      `screenOptions={{ headerShown: false }}`, four `Tabs.Screen` entries
      (`index` label "Jobs" icon `magnifyingglass` or similar, `companies`
      label "Companies" icon `building.2`, `notifications` label
      "Notifications" icon `bell`/`bell.fill` with `tabBarBadge` bound to
      `useUnreadCount()`, `profile` label "Profile" icon
      `person.crop.circle`), and a custom `tabBar` render prop.
- [ ] 4.2 Implement the custom tab bar component (co-located in
      `_layout.tsx` or a new `src/components/AnimatedTabBar.tsx`): reads
      `translateY` from `useTabBarVisibility()`, wraps the four tab buttons
      in an `Animated.View` with `position: absolute, bottom: 0, left: 0,
      right: 0` and an animated `transform: [{ translateY }]` (0 → visible,
      full bar height → hidden), each button calling
      `navigation.navigate(route.name)` per React Navigation's custom
      tab-bar contract.
- [ ] 4.3 Add bottom padding (matching the tab bar's height) to each tab
      screen's scrollable content so the bar doesn't initially cover the
      last item.

## 5. Root layout + call-site updates

- [ ] 5.1 In `src/app/_layout.tsx`, replace the root `Stack.Screen
      name="index"` registration with `name="(tabs)"` (both
      `headerShown: false`); leave `jobs/[slug]`, `companies/[slug]`,
      `filters`, `filters/quick`, `auth`, `notifications/[id]` as-is.
- [ ] 5.2 Grep for and update any remaining `router.push('/notifications')`
      / `router.push('/profile')` call sites (none expected outside the
      deleted files per the pre-implementation search, but re-check) to
      navigate to the corresponding tab instead.

## 6. Verify, simplify, review

- [ ] 6.1 Run unit tests (`tabBarVisibility.test.ts`) and `tsc --noEmit`.
- [ ] 6.2 Run `npm run lint`.
- [ ] 6.3 Verify end-to-end in the iOS simulator against every scenario in
      `specs/bottom-tab-navigation/spec.md`: all four tabs present and
      switchable, Jobs feed unchanged, Companies placeholder, Notifications
      inline list + badge, Profile signed-in/signed-out states, auto-hide
      on scroll-down/show on scroll-up/stay-visible-near-top on the Jobs
      feed.
- [ ] 6.4 Run the `simplify` pass over the changed files, then request code
      review.
