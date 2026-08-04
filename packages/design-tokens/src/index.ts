export const themes = {
  light: {
    surface: '#f7f9f7',
    raised: '#ffffff',
    text: '#17221e',
    muted: '#607066',
    border: '#d8e1da',
    primary: '#256b4b',
    focus: '#0d7a54',
  },
  dark: {
    surface: '#111914',
    raised: '#1a2820',
    text: '#edf5ef',
    muted: '#b1c0b6',
    border: '#35463c',
    primary: '#91cba9',
    focus: '#9de0b6',
  },
} as const;

export type ThemeName = keyof typeof themes;
