import React from 'react';
import { Text } from 'react-native';
import type ReactTestRenderer from 'react-test-renderer';

/**
 * Every string a render actually put on screen, in tree order.
 *
 * Asserting on this rather than on a snapshot keeps the "which fields does this
 * surface show" tests readable and lets them state absence as plainly as
 * presence — the shape most of these components are specified in.
 *
 * Non-string children (nested elements, icons) are dropped rather than
 * stringified, so an icon beside a value doesn't leak a glyph into the
 * expectation.
 */
export function renderedText(renderer: ReactTestRenderer.ReactTestRenderer): string[] {
  return renderer.root
    .findAllByType(Text)
    .map((node) =>
      React.Children.toArray(node.props.children)
        .filter((child): child is string | number => typeof child !== 'object')
        .join(''),
    )
    .filter((text) => text.length > 0);
}
