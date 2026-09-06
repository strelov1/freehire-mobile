import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  type View as ViewType,
} from 'react-native';

import { AppSymbol } from '@/components/AppSymbol';
import { getColors, Radius, Space } from '@/constants/freehire';
import type { JobSort, SortOption } from '@/lib/jobFilters';

/** Where the menu hangs, measured from the trigger it belongs to. */
type Anchor = { top: number; right: number };

const MENU_WIDTH = 200;
const GAP = 6;

/**
 * The feed's ordering control: a button naming the ordering in force, which
 * drops its options directly beneath itself.
 *
 * The web spells this as a `<select>`, whose list the browser anchors to the
 * control. React Native has no `<select>` and no anchored popover: a `Modal` is
 * a full-screen layer with no idea where it was opened from. So the trigger
 * measures itself on press and the menu is positioned from that — which is the
 * whole of what a `<select>` gets for free.
 *
 * A centred dialog was the easy version and the wrong one: a box in the middle
 * of the screen reads as a decision to make, and this is a control to adjust.
 *
 * The button names the current ordering rather than saying "Sort": the feed is
 * always in SOME order, and hiding which one makes the reader open the menu to
 * find out.
 */
export function SortMenu({
  options,
  selected,
  onSelect,
}: {
  options: SortOption[];
  selected: JobSort;
  onSelect: (sort: JobSort) => void;
}) {
  const c = getColors(useColorScheme());
  // Where the menu sits and whether it is showing are separate on purpose. The
  // modal's fade-out still renders a frame or two after the close, and clearing
  // the position on close made the menu jump to the top-left corner on its way
  // out. The anchor outlives the close and is replaced on the next open.
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const trigger = useRef<ViewType>(null);

  const current = options.find((o) => o.value === selected);

  /** Measure the trigger in window coordinates, then open under it. The measure
   *  is taken per press rather than on layout: the toolbar moves with the list's
   *  header, and a position cached at mount would open the menu where the button
   *  used to be. */
  function openMenu() {
    trigger.current?.measureInWindow((x, y, width, height) => {
      setAnchor({
        top: y + height + GAP,
        // Right-aligned to the trigger, the way a select's list lines up with
        // its control rather than with the screen.
        right: Math.max(Space.sm, Dimensions.get('window').width - (x + width)),
      });
      setOpen(true);
    });
  }

  return (
    <>
      <Pressable
        ref={trigger}
        accessibilityRole="button"
        accessibilityLabel={`Sort: ${current?.label ?? selected}`}
        accessibilityState={{ expanded: open }}
        onPress={openMenu}
        style={({ pressed }) => [
          styles.trigger,
          { borderColor: c.border, backgroundColor: c.card },
          pressed && { opacity: 0.7 },
        ]}>
        <Text style={[styles.triggerText, { color: c.foreground }]}>
          {current?.label ?? selected}
        </Text>
        <AppSymbol name="chevron.down" size={11} weight="semibold" tintColor={c.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}>
        {/* The scrim is invisible: a dimmed screen would make this feel like the
            dialog it is not. It is here to catch the tap that closes the menu. */}
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.menu,
              { top: anchor?.top ?? 0, right: anchor?.right ?? Space.lg },
              { backgroundColor: c.card, borderColor: c.border },
            ]}
            onPress={(e) => e.stopPropagation()}>
            {options.map((option) => {
              const active = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setOpen(false);
                    // Re-picking the ordering in force is a no-op rather than a
                    // refetch of the same list in the same order.
                    if (!active) onSelect(option.value);
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}>
                  <Text style={[styles.rowText, { color: active ? c.brandStrong : c.foreground }]}>
                    {option.label}
                  </Text>
                  {active ? (
                    <AppSymbol name="checkmark" size={13} tintColor={c.brandStrong} />
                  ) : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
    paddingVertical: 6,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrim: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Space.xs,
    // Enough to read as a layer above the list without the dialog's drop of
    // dimming behind it.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: 10,
  },
  rowText: {
    fontSize: 14,
  },
});
