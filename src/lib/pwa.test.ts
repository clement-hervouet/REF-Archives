import { describe, expect, it } from "vitest";
import { PWA_COLORS, PWA_ICONS, buildManifest, detectInstallPlatform, themeColorsFor } from "./pwa";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const WINDOWS_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

describe("buildManifest", () => {
  const manifest = buildManifest();

  it("décrit une application plein écran qui démarre à l'accueil", () => {
    expect(manifest.name).toBe("REF-Archives");
    expect(manifest.short_name).toBe("REF-Archives");
    expect(manifest.lang).toBe("fr");
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("reprend les couleurs de la palette", () => {
    expect(manifest.theme_color).toBe(PWA_COLORS.brand);
    expect(manifest.background_color).toBe(PWA_COLORS.lightBackground);
  });

  it("fournit les icônes 192 et 512 px exigées par les navigateurs, plus une icône maskable", () => {
    expect(manifest.icons).toEqual([
      { src: PWA_ICONS.small, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: PWA_ICONS.large, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: PWA_ICONS.maskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });

  it("ne pointe que vers des chemins du site", () => {
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith("/")).toBe(true);
      expect(icon.src.startsWith("//")).toBe(false);
    }
  });
});

describe("themeColorsFor", () => {
  it("donne le fond clair quand le thème clair est imposé", () => {
    expect(themeColorsFor("light")).toEqual([{ color: PWA_COLORS.lightBackground }]);
  });

  it("donne le fond sombre quand le thème sombre est imposé", () => {
    expect(themeColorsFor("dark")).toEqual([{ color: PWA_COLORS.darkBackground }]);
  });

  it("suit le système sans choix explicite", () => {
    expect(themeColorsFor(undefined)).toEqual([
      { media: "(prefers-color-scheme: light)", color: PWA_COLORS.lightBackground },
      { media: "(prefers-color-scheme: dark)", color: PWA_COLORS.darkBackground },
    ]);
  });
});

describe("detectInstallPlatform", () => {
  it("reconnaît l'application déjà installée, quel que soit l'appareil", () => {
    expect(
      detectInstallPlatform({ standalone: true, userAgent: IPHONE_UA, maxTouchPoints: 5 }),
    ).toBe("standalone");
    expect(
      detectInstallPlatform({ standalone: true, userAgent: WINDOWS_UA, maxTouchPoints: 0 }),
    ).toBe("standalone");
  });

  it("reconnaît un iPhone", () => {
    expect(
      detectInstallPlatform({ standalone: false, userAgent: IPHONE_UA, maxTouchPoints: 5 }),
    ).toBe("ios");
  });

  it("reconnaît un iPad qui se présente comme un Mac", () => {
    expect(
      detectInstallPlatform({ standalone: false, userAgent: IPAD_AS_MAC_UA, maxTouchPoints: 5 }),
    ).toBe("ios");
  });

  it("ne prend pas un vrai Mac pour un iPad", () => {
    expect(
      detectInstallPlatform({ standalone: false, userAgent: IPAD_AS_MAC_UA, maxTouchPoints: 0 }),
    ).toBe("browser");
  });

  it("laisse les autres navigateurs proposer l'installation eux-mêmes", () => {
    expect(
      detectInstallPlatform({ standalone: false, userAgent: ANDROID_UA, maxTouchPoints: 5 }),
    ).toBe("browser");
    expect(
      detectInstallPlatform({ standalone: false, userAgent: WINDOWS_UA, maxTouchPoints: 0 }),
    ).toBe("browser");
  });
});
