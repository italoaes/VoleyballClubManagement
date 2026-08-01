/**
 * Gera os ícones do app/PWA e os favicons a partir de uma única arte quadrada.
 * Fonte: src/assets-src/icon-source.png  ->  public/*.png
 * Uso: node scripts/make-app-icons.mjs (ou npm run icons)
 */
import { Jimp } from "jimp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "src", "assets-src", "icon-source.png");
const publicDir = join(root, "public");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

const img = await Jimp.read(source);
for (const { name, size } of sizes) {
  const clone = img.clone().resize({ w: size, h: size });
  await clone.write(join(publicDir, name));
  console.log("gerado", name, `(${size}x${size})`);
}
