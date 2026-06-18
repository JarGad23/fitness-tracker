// Generates PWA PNG icons from public/icons/icon.svg.
// Run on Windows (sharp's native binary is platform-specific and isn't
// available under WSL here):  node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const svg = readFileSync(join(iconsDir, "icon.svg"));

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  // High density so the vector upscales crisply before resizing down.
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, file));
  console.log("wrote", `public/icons/${file}`);
}

console.log("Done. Icons generated.");
