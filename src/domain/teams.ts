/**
 * Catálogo dos 12 times reais do jogo (nomes e escudos fornecidos).
 *
 * Os mesmos times servem às categorias masculina e feminina (mudam apenas os
 * nomes dos jogadores). Cada escudo vive em public/assets/crests/<slug>.png.
 */

export interface TeamCatalogEntry {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  crest: string; // caminho público do escudo
}

function crest(slug: string): string {
  return `/assets/crests/${slug}.png`;
}

/** Ordenados do (tendencialmente) mais forte ao mais fraco — usado no gradiente. */
export const TEAM_CATALOG: readonly TeamCatalogEntry[] = [
  { slug: "minas", name: "Minas Esporte Vôlei", shortName: "MIN", city: "Belo Horizonte", crest: crest("minas") },
  { slug: "campinas", name: "Campinas Vôlei Clube", shortName: "CAM", city: "Campinas", crest: crest("campinas") },
  { slug: "paulista", name: "Clube Atlético Paulista", shortName: "PAU", city: "São Paulo", crest: crest("paulista") },
  { slug: "osasco", name: "Osasco Associação Voleibol", shortName: "OSA", city: "Osasco", crest: crest("osasco") },
  { slug: "rio", name: "Rio Volleyball Club", shortName: "RIO", city: "Rio de Janeiro", crest: crest("rio") },
  { slug: "curitiba", name: "Curitiba Vôlei Clube", shortName: "CTB", city: "Curitiba", crest: crest("curitiba") },
  { slug: "floripa", name: "Floripa Voleibol", shortName: "FLO", city: "Florianópolis", crest: crest("floripa") },
  { slug: "brasilia", name: "Brasília Esporte Vôlei", shortName: "BSB", city: "Brasília", crest: crest("brasilia") },
  { slug: "goiania", name: "Goiânia Vôlei Clube", shortName: "GYN", city: "Goiânia", crest: crest("goiania") },
  { slug: "recife", name: "Recife Vôlei Clube", shortName: "REC", city: "Recife", crest: crest("recife") },
  { slug: "fortaleza", name: "Fortaleza Atlântico Clube", shortName: "FOR", city: "Fortaleza", crest: crest("fortaleza") },
  { slug: "salvador", name: "Salvador Vôlei Club", shortName: "SSA", city: "Salvador", crest: crest("salvador") },
];

/** Escudo genérico (fallback). */
export const FALLBACK_CREST = "/assets/ui/star.png";
