/**
 * Centralized color and spacing constants for Wall-to-All.
 *
 * Import these instead of hardcoding hex values in screens/components.
 *
 * Usage:
 *   import { colors } from '../lib/theme';
 *   backgroundColor: colors.background,
 */

export const colors = {
    // ── Brand ──────────────────────────────────────────────
    brand: '#000E3D',        // Navy — primary brand color
    accent: '#E5102E',       // Red — CTAs, active states, errors

    // ── Text ───────────────────────────────────────────────
    textPrimary: '#0F0F0F',  // Near-black — headings & body
    textSecondary: '#474747',// Dark gray — labels, hints
    textMuted: '#999999',    // Light gray — placeholders, captions

    // ── Backgrounds ────────────────────────────────────────
    background: '#FAFAFA',   // Light gray page background
    surface: '#FEFEFE',      // Card / modal surface
    white: '#FFFFFF',        // Pure white

    // ── Borders & Dividers ─────────────────────────────────
    border: '#E8E8E8',       // Light border
    divider: '#F0F0F0',      // Section dividers

    // ── Status ─────────────────────────────────────────────
    success: '#4CAF50',
    warning: '#FFB300',
    error: '#E5102E',        // Same as accent

    // ── Misc ───────────────────────────────────────────────
    shadow: '#1D1D1D',       // Shadow color
    disabled: '#A0A0A0',     // Disabled state fill
    overlay: 'rgba(0,0,0,0.5)', // Modal overlay

    // ── New design system (novo escopo) ────────────────────
    // Tokens do Figma do novo escopo (cliente/lojista). Reutilizados
    // por Toggle, Slider, tab bars, etc. — nomeados pela intenção do token.
    surfaceGrey: '#DBDBDB',    // Figma surface/grey — trilhos/off states
    surfaceSuccess: '#17723F', // Figma surface/success — verde do design system (≠ colors.success)
    contentLight: '#FEFEFE',   // Figma content/light — knobs/conteúdo claro sobre superfícies
} as const;

export type ColorKey = keyof typeof colors;
