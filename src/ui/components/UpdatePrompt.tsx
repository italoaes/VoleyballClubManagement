/**
 * Faixa de atualização do PWA. Quando o service worker detecta uma versão nova,
 * mostra um aviso com botão "Atualizar" — o usuário decide quando aplicar, sem
 * precisar limpar cache (o que apagaria o save).
 */

import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt(): JSX.Element | null {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: "var(--surface-2)",
        borderTop: "1px solid var(--accent)",
        padding: "0.75rem 1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <span style={{ fontSize: "0.85rem" }}>Nova versão disponível.</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => setNeedRefresh(false)}
          style={{
            padding: "0.4rem 0.7rem",
            borderRadius: 8,
            border: "1px solid var(--surface)",
            background: "transparent",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Depois
        </button>
        <button
          onClick={() => void updateServiceWorker(true)}
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: 8,
            border: "none",
            background: "var(--accent)",
            color: "#08131f",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Atualizar
        </button>
      </div>
    </div>
  );
}
