/**
 * Shell raiz: roteia entre as telas do MVP e renderiza a navegação inferior
 * (mobile-first). O estado de navegação (navStore) é separado do GameState.
 */

import { useGameStore } from "@state/gameStore";
import { useNavStore, type Screen } from "@state/navStore";
import { Title } from "./screens/Title";
import { NewGame } from "./screens/NewGame";
import { Dashboard } from "./screens/Dashboard";
import { Squad } from "./screens/Squad";
import { MatchPreview } from "./screens/MatchPreview";
import { LiveMatch } from "./screens/LiveMatch";
import { Standings } from "./screens/Standings";
import { MatchResult } from "./screens/MatchResult";
import { PlayoffBracket } from "./screens/PlayoffBracket";
import { SeasonEnd } from "./screens/SeasonEnd";
import { Offers } from "./screens/Offers";
import { Results } from "./screens/Results";
import { Roster } from "./screens/Roster";
import { DevelopmentScreen } from "./screens/DevelopmentScreen";
import { ManagerProfile } from "./screens/ManagerProfile";
import { Menu } from "./screens/Menu";
import { UpdatePrompt } from "./components/UpdatePrompt";

function BottomNav(): JSX.Element {
  const screen = useNavStore((s) => s.screen);
  const go = useNavStore((s) => s.go);
  const hasGame = useGameStore((s) => s.state !== null);

  // esconde a navegação na tela inicial, novo jogo e durante o fluxo de partida
  if (
    !hasGame ||
    screen === "title" ||
    screen === "new-game" ||
    screen === "live-match" ||
    screen === "match-preview"
  )
    return <></>;

  const items: { key: Screen; label: string }[] = [
    { key: "dashboard", label: "Início" },
    { key: "roster", label: "Plantel" },
    { key: "standings", label: "Tabela" },
    { key: "playoffs", label: "Chave" },
    { key: "menu", label: "Menu" },
  ];

  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        borderTop: "1px solid var(--surface-2)",
        background: "var(--surface)",
      }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => go(it.key)}
          style={{
            flex: 1,
            padding: "0.8rem 0",
            background: screen === it.key ? "var(--surface-2)" : "transparent",
            border: "none",
            color: screen === it.key ? "var(--accent)" : "var(--text-dim)",
            fontWeight: screen === it.key ? 800 : 500,
            fontSize: "0.8rem",
            cursor: "pointer",
          }}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}

function CurrentScreen(): JSX.Element {
  const screen = useNavStore((s) => s.screen);
  switch (screen) {
    case "title":
      return <Title />;
    case "new-game":
      return <NewGame />;
    case "dashboard":
      return <Dashboard />;
    case "squad":
      return <Squad />;
    case "match-preview":
      return <MatchPreview />;
    case "live-match":
      return <LiveMatch />;
    case "standings":
      return <Standings />;
    case "match-result":
      return <MatchResult />;
    case "playoffs":
      return <PlayoffBracket />;
    case "season-end":
      return <SeasonEnd />;
    case "offers":
      return <Offers />;
    case "results":
      return <Results />;
    case "roster":
      return <Roster />;
    case "development":
      return <DevelopmentScreen />;
    case "manager":
      return <ManagerProfile />;
    case "menu":
      return <Menu />;
    default:
      return <Dashboard />;
  }
}

export function App(): JSX.Element {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "0.5rem" }}>
        <CurrentScreen />
      </div>
      <BottomNav />
      <UpdatePrompt />
    </div>
  );
}
