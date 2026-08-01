/**
 * Logo do jogo — estilo "VCM 26" (inspirado no layout de referência):
 * "VCM" em branco + "26" em laranja, com o subtítulo
 * "VOLLEYBALL CLUB MANAGEMENT" abaixo.
 */

export function Logo({ size = 1 }: { size?: number }): JSX.Element {
  const main = 3.2 * size; // rem
  const sub = 0.82 * size; // rem
  return (
    <div style={{ textAlign: "center", lineHeight: 1, userSelect: "none" }}>
      <div
        style={{
          fontSize: `${main}rem`,
          fontWeight: 900,
          fontStyle: "italic",
          letterSpacing: "-1px",
          textShadow: "2px 2px 0 rgba(0,0,0,0.45)",
        }}
      >
        <span style={{ color: "#ffffff" }}>VCM</span>
        <span style={{ color: "var(--accent)" }}>26</span>
      </div>
      <div
        style={{
          fontSize: `${sub}rem`,
          fontWeight: 800,
          letterSpacing: "1px",
          color: "#ffffff",
          marginTop: 2,
        }}
      >
        VOLLEYBALL CLUB MANAGEMENT
      </div>
    </div>
  );
}
