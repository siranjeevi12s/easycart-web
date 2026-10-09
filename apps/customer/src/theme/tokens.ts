/** Customer theme tokens — sourced from @easycart/design-tokens (single source
 *  of truth). Local additions only for RN-specific type metadata. */
export {
  brand,
  palette,
  spacing,
  radius,
  orderStatusKind,
  statusColors,
  type ThemeMode,
  type Palette,
  type StatusKind,
} from '@easycart/design-tokens';

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '800' as const },
  heading: { fontSize: 18, fontWeight: '800' as const },
  subheading: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  bodyBold: { fontSize: 14, fontWeight: '700' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  captionBold: { fontSize: 12, fontWeight: '700' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const },
  button: { fontSize: 15, fontWeight: '800' as const },
} as const;
