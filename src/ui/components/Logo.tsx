/**
 * Logo do jogo (arte oficial VCM26) para a tela inicial.
 * Usa `assetUrl` para resolver o caminho tanto no GitHub Pages (subpasta)
 * quanto no APK (base relativa).
 */

import { assetUrl } from "../asset";

export function Logo({ maxWidth = 340 }: { maxWidth?: number }): JSX.Element {
  return (
    <div style={{ textAlign: "center", userSelect: "none" }}>
      <img
        src={assetUrl("/assets/ui/logo.png")}
        alt="VCM26 — Volleyball Club Management"
        style={{ width: "100%", maxWidth, height: "auto", display: "inline-block" }}
      />
    </div>
  );
}
