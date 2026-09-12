import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");

const packages = [
  { name: "safeCopy", icon: "safe-copy.svg" },
  { name: "safeReplace", icon: "safe-replace.svg" },
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const item of packages) {
  const packageName = `${item.name}.popclipext`;
  const packagePath = path.join(dist, packageName);
  await mkdir(packagePath, { recursive: true });
  await cp(path.join(root, "extensions", item.name, "Config.ts"), path.join(packagePath, "Config.ts"));
  await cp(path.join(root, "src", "redact.js"), path.join(packagePath, "redact.js"));
  await cp(path.join(root, "assets", item.icon), path.join(packagePath, item.icon));

  const archive = path.join(dist, `${item.name}.popclipextz`);
  await exec("zip", ["-r", "-X", archive, packageName], { cwd: dist });
}

const manifest = {
  generatedAt: new Date().toISOString(),
  packages: await Promise.all(
    packages.map(async (item) => ({
      name: item.name,
      config: await readFile(path.join(root, "extensions", item.name, "Config.ts"), "utf8"),
    })),
  ),
};
await writeFile(path.join(dist, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
