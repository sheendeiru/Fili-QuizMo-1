import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  projectRoot,
  "public",
  "assets",
  "'Di ko ma-edit background para transparent.png",
);
const targetPath = join(projectRoot, "public", "brand", "logo.png");

if (!existsSync(sourcePath)) {
  throw new Error(`Logo source file not found: ${sourcePath}`);
}

if (!existsSync(targetPath)) {
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}
