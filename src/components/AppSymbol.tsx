import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolView, type SFSymbol, type SymbolWeight } from 'expo-symbols';
import React from 'react';
import { Platform, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

export type AppSymbolProps = {
  name: SFSymbol | string;
  size?: number;
  color?: string;
  tintColor?: string;
  weight?: SymbolWeight;
  style?: StyleProp<TextStyle | ViewStyle>;
};

type IoniconName = keyof typeof Ionicons.glyphMap;
type MaterialCommunityName = keyof typeof MaterialCommunityIcons.glyphMap;

type IconMapping =
  | { family: 'ionicons'; name: IoniconName }
  | { family: 'materialCommunity'; name: MaterialCommunityName };

const SYMBOL_MAP: Record<string, IconMapping> = {
  // Tabs & Identity
  briefcase: { family: 'ionicons', name: 'briefcase-outline' },
  'briefcase.fill': { family: 'ionicons', name: 'briefcase' },
  'building.2': { family: 'materialCommunity', name: 'office-building-outline' },
  'building.2.fill': { family: 'materialCommunity', name: 'office-building' },
  bell: { family: 'ionicons', name: 'notifications-outline' },
  'bell.fill': { family: 'ionicons', name: 'notifications' },
  person: { family: 'ionicons', name: 'person-outline' },
  'person.fill': { family: 'ionicons', name: 'person' },
  'person.crop.circle': { family: 'ionicons', name: 'person-circle-outline' },
  'person.crop.circle.fill': { family: 'ionicons', name: 'person-circle' },

  // Navigation & Chevrons
  'chevron.left': { family: 'ionicons', name: 'chevron-back' },
  'chevron.right': { family: 'ionicons', name: 'chevron-forward' },
  'chevron.down': { family: 'ionicons', name: 'chevron-down' },
  'chevron.up': { family: 'ionicons', name: 'chevron-up' },

  // Search & Filters & Inputs
  magnifyingglass: { family: 'ionicons', name: 'search' },
  xmark: { family: 'ionicons', name: 'close' },
  'xmark.circle.fill': { family: 'ionicons', name: 'close-circle' },
  'slider.horizontal.3': { family: 'ionicons', name: 'options-outline' },
  checkmark: { family: 'ionicons', name: 'checkmark' },
  'checkmark.circle': { family: 'ionicons', name: 'checkmark-circle-outline' },
  'checkmark.circle.fill': { family: 'ionicons', name: 'checkmark-circle' },

  // Actions & Metadata
  bookmark: { family: 'ionicons', name: 'bookmark-outline' },
  'bookmark.fill': { family: 'ionicons', name: 'bookmark' },
  'square.and.arrow.up': { family: 'ionicons', name: 'share-outline' },
  'arrow.up.right': { family: 'ionicons', name: 'open-outline' },
  globe: { family: 'ionicons', name: 'globe-outline' },
  mappin: { family: 'ionicons', name: 'location-outline' },
  'mappin.circle.fill': { family: 'ionicons', name: 'location' },
  'rectangle.portrait.and.arrow.right': { family: 'ionicons', name: 'log-out-outline' },
  trash: { family: 'ionicons', name: 'trash-outline' },
  'trash.fill': { family: 'ionicons', name: 'trash' },
  clock: { family: 'ionicons', name: 'time-outline' },
  star: { family: 'ionicons', name: 'star-outline' },
  'star.fill': { family: 'ionicons', name: 'star' },
  'exclamationmark.circle': { family: 'ionicons', name: 'alert-circle-outline' },
  'arrow.uturn.right': { family: 'ionicons', name: 'arrow-redo-outline' },
  'text.bubble': { family: 'ionicons', name: 'chatbubble-outline' },
  'wifi.slash': { family: 'ionicons', name: 'cloud-offline-outline' },
  'eye.slash.fill': { family: 'ionicons', name: 'eye-off' },
  'bookmark.slash.fill': { family: 'materialCommunity', name: 'bookmark-remove' },
  'hand.thumbsup': { family: 'ionicons', name: 'thumbs-up-outline' },
  'hand.thumbsdown': { family: 'ionicons', name: 'thumbs-down-outline' },
};

/**
 * Universal cross-platform icon component.
 * - On iOS: Renders Apple SF Symbols with SymbolView.
 * - On Android & Web: Renders mapped vector icons from @expo/vector-icons.
 */
export function AppSymbol({
  name,
  size = 20,
  color,
  tintColor,
  weight = 'regular',
  style,
}: AppSymbolProps) {
  const resolvedColor = tintColor ?? color ?? '#000000';

  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={name as SFSymbol}
        size={size}
        tintColor={resolvedColor}
        weight={weight}
        style={style as StyleProp<ViewStyle>}
      />
    );
  }

  const textStyle = style as StyleProp<TextStyle>;
  const mapped = SYMBOL_MAP[name];
  if (!mapped) {
    // Fallback search in Ionicons
    return <Ionicons name="help-circle-outline" size={size} color={resolvedColor} style={textStyle} />;
  }

  if (mapped.family === 'materialCommunity') {
    return (
      <MaterialCommunityIcons
        name={mapped.name}
        size={size}
        color={resolvedColor}
        style={textStyle}
      />
    );
  }

  return <Ionicons name={mapped.name} size={size} color={resolvedColor} style={textStyle} />;
}
