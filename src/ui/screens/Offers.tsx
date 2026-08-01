import { useGameStore } from "@state/gameStore";
import { useNavStore } from "@state/navStore";
import { seasonLabel } from "@domain/career";
import type { JobOffer } from "@domain/types";
import { Button, Card, ScreenHeader, StarRating, TeamBadge } from "../components/ui";

function OfferCard({ offer, onAccept }: { offer: JobOffer; onAccept: () => void }): JSX.Element {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <TeamBadge shortName={offer.teamName.slice(0, 3).toUpperCase()} crest={offer.crest} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{offer.teamName}</div>
          <StarRating stars={offer.stars} size={12} />
        </div>
        {offer.isRenewal ? (
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              color: "var(--accent)",
              border: "1px solid var(--accent)",
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            RENOVAÇÃO
          </span>
        ) : null}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: "0.8rem",
          color: "var(--text-dim)",
          borderTop: "1px solid var(--surface-2)",
          paddingTop: 8,
        }}
      >
        Objetivo exigido: <strong style={{ color: "var(--text)" }}>{offer.objective.description}</strong>
      </div>
      <Button onClick={onAccept} style={{ marginTop: 10 }}>
        {offer.isRenewal ? "Renovar contrato" : "Aceitar proposta"}
      </Button>
    </Card>
  );
}

export function Offers(): JSX.Element {
  const state = useGameStore((s) => s.state);
  const nextSeason = useGameStore((s) => s.nextSeason);
  const go = useNavStore((s) => s.go);
  if (!state) return <p style={{ padding: "1rem" }}>Carregando…</p>;

  const offers = state.offers ?? [];
  const nextLabel = seasonLabel(state.season + 1);

  const accept = (teamId: string): void => {
    nextSeason(teamId);
    go("dashboard");
  };

  return (
    <div>
      <ScreenHeader title="Propostas" subtitle={`Escolha seu clube para ${nextLabel}`} />
      <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        {offers.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>Nenhuma proposta disponível.</p>
        ) : (
          offers.map((o) => (
            <OfferCard key={o.teamId} offer={o} onAccept={() => accept(o.teamId)} />
          ))
        )}
        <Button variant="ghost" onClick={() => go("season-end")}>
          Voltar
        </Button>
      </div>
    </div>
  );
}
