// Design tokens — fuente unica de verdad para valores cross-platform
// Usar estos tokens en lugar de hardcodear valores repetidos en los componentes.

// --- Layout ---
export const LAYOUT = {
  maxWidth: 1280,
  gutter: 16,
  sidebar: {
    expanded: 288,   // w-72
    compact: 64,     // w-16
  },
};

// --- Border radius ---
export const RADIUS = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,       // rounded-xl (12px en Tailwind)
  xl: 16,       // rounded-2xl (16px)
  '2xl': 24,    // rounded-[24px]
  '3xl': 28,    // rounded-[28px]
  full: 9999,   // rounded-full
};

// --- Spacing ---
export const SPACING = {
  none: 0,
  xs: 4,     // p-1
  sm: 8,     // p-2
  md: 12,    // p-3
  lg: 16,    // p-4
  xl: 20,    // p-5
  '2xl': 24, // p-6
  '3xl': 32, // p-8
};

// --- z-index ---
export const Z_INDEX = {
  drawer: 60,
  drawerBackdrop: 55,
  modal: 50,
  dropdown: 40,
  header: 30,
  sidebar: 20,
};

// --- Animation ---
export const ANIMATION = {
  drawerDuration: 280,
  fast: 200,
  normal: 350,
  slow: 500,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

// --- Input ---
export const INPUT = {
  height: 48,
  borderRadius: RADIUS.lg,
  paddingX: SPACING.lg,
};

// --- Breakpoints (px) ---
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};
