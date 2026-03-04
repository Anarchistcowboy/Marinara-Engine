// ──────────────────────────────────────────────
// CustomThemeInjector: Injects active custom theme
// CSS and enabled extension CSS into the DOM
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { useUIStore } from "../../stores/ui.store";

export function CustomThemeInjector() {
  const activeCustomTheme = useUIStore((s) => s.activeCustomTheme);
  const customThemes = useUIStore((s) => s.customThemes);
  const installedExtensions = useUIStore((s) => s.installedExtensions);

  // Inject active custom theme CSS
  useEffect(() => {
    const id = "marinara-custom-theme";
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!activeCustomTheme) {
      style?.remove();
      return;
    }

    const theme = customThemes.find((t) => t.id === activeCustomTheme);
    if (!theme) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = theme.css;

    return () => {
      style?.remove();
    };
  }, [activeCustomTheme, customThemes]);

  // Inject enabled extension CSS
  useEffect(() => {
    const prefix = "marinara-ext-";

    // Remove old extension styles
    document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());

    // Inject enabled ones
    for (const ext of installedExtensions) {
      if (!ext.enabled || !ext.css) continue;
      const style = document.createElement("style");
      style.id = `${prefix}${ext.id}`;
      style.textContent = ext.css;
      document.head.appendChild(style);
    }

    return () => {
      document.querySelectorAll(`style[id^="${prefix}"]`).forEach((el) => el.remove());
    };
  }, [installedExtensions]);

  return null;
}
