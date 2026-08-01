/**
 * Resolve a URL pública de um asset respeitando a base do deploy.
 *
 * Necessário porque o site pode ser servido de um subcaminho (GitHub Pages:
 * "/VoleyballClubManagement/") ou de forma relativa (APK/Capacitor: "./").
 * Os caminhos guardados no domínio são absolutos ("/assets/...") por
 * conveniência/serialização; aqui os convertemos para a base correta na hora
 * de renderizar a imagem.
 */
export function assetUrl(path: string): string {
  // remove "/" ou "./" inicial para virar caminho relativo à base
  const clean = path.replace(/^\.?\//, "");
  const base = import.meta.env.BASE_URL || "/";
  return (base.endsWith("/") ? base : base + "/") + clean;
}
