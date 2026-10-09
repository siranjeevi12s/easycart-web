/** Restaurant design tokens — sourced from @easycart/design-tokens.
 *  Local wrappers keep existing import paths working across pages. */
import {
  brand as sharedBrand,
  orderStatusKind as sharedKind,
  statusColors,
  type StatusKind as SharedKind,
  type ThemeMode,
} from '@easycart/design-tokens';

export const brand = sharedBrand;
export type StatusKind = SharedKind;
export type { ThemeMode };

export function orderStatusKind(status?: string): StatusKind {
  return sharedKind(status);
}

/** Soft tint backgrounds that stay readable in both modes (MUI palette-driven). */
export function statusSoft(kind: StatusKind, mode: 'light' | 'dark'): string {
  return statusColors(kind, mode).bg;
}

/** Strong foreground color for a status kind (theme-aware). */
export function statusStrong(kind: StatusKind, mode: 'light' | 'dark'): string {
  return statusColors(kind, mode).fg;
}
