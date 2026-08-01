# VCM26 — Volleyball Club Management

Jogo de gestão de vôlei — web, mobile-first, PWA (instalável e offline).

**Jogar online:** https://SEU-USUARIO.github.io/VoleyballClubManagement/
(substitua `SEU-USUARIO` pelo seu usuário do GitHub após ativar o Pages)

## Stack

- **Vite** + **React** + **TypeScript** (strict)
- **Zustand** para o estado do jogo (fonte única de verdade, serializável)
- **IndexedDB** (via `idb`) para saves versionados (até 5 slots)
- **Vitest** para testes (incl. paridade com o motor validado)
- **PWA** (`vite-plugin-pwa`) — instalável no celular, funciona offline

## Arquitetura em camadas (`src/`)

| Pasta | Responsabilidade |
|---|---|
| `engine/` | Motor de simulação PURO (sem UI, sem I/O). Recebe forças, devolve resultados. |
| `domain/` | Regras do jogo: tipos, geração de mundo, elenco/escalação, liga, playoffs, carreira, desenvolvimento. |
| `state/` | `GameState` serializável + store Zustand + ações puras. |
| `persistence/` | Save/load em IndexedDB, versionado com migrações. |
| `ui/` | Componentes React e telas, navegação mobile-first. |

## Scripts

```bash
npm install       # instala dependências
npm run dev       # servidor de desenvolvimento
npm run build     # type-check + build de produção
npm test          # roda os testes (vitest)
npm run lint      # eslint
```

## Publicar no GitHub Pages

O deploy é **automático** via GitHub Actions (`.github/workflows/deploy.yml`):
a cada `push` na branch `main`, o site é reconstruído e publicado.

Para ativar (uma vez):
1. No GitHub, vá em **Settings → Pages**.
2. Em **Build and deployment → Source**, selecione **GitHub Actions**.
3. Dê um push na `main` — o workflow builda e publica. Veja o progresso na aba **Actions**.
4. O site fica em `https://SEU-USUARIO.github.io/VoleyballClubManagement/`.

> O `base` do site é definido pela variável `DEPLOY_BASE` no workflow. Se o nome do
> repositório mudar, ajuste `DEPLOY_BASE` em `.github/workflows/deploy.yml`.

## Instalar no celular (sem APK)

Abra o site no **Chrome do Android** → menu (⋮) → **Instalar app / Adicionar à tela
inicial**. Ele instala como um app, abre em tela cheia e funciona offline.

## Gerar um APK (opcional)

Duas formas:
- **PWABuilder** (sem instalar nada): com o site no ar, use https://www.pwabuilder.com,
  cole a URL e baixe o APK.
- **Capacitor** (local): ver `GERAR_APK.md`. Exige Android Studio.
