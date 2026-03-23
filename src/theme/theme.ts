export type ThemeMode = "system" | "light" | "dark";

export type ThemeColors = {
  background: string;
  card: string;
  cardSolid: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
};

export function getColors(isDark: boolean): ThemeColors {
  if (isDark) {
    return {
      background: "#0B0D12",
      card: "rgba(18, 20, 28, 0.82)",
      cardSolid: "#12141C",
      text: "#F5F7FF",
      muted: "#AAB0C0",
      border: "rgba(255,255,255,0.12)",
      primary: "#2563EB",
      onPrimary: "#FFFFFF",
      danger: "#E11D48",
    };
  }

  return {
    background: "#fffcf5",
    card: "rgba(255,255,255,0.88)",
    cardSolid: "#FFFFFF",
    text: "#0f1220",
    muted: "#4b4b4b",
    border: "rgba(0,0,0,0.08)",
    primary: "#2563EB",
    onPrimary: "#FFFFFF",
    danger: "#E11D48",
  };
}

