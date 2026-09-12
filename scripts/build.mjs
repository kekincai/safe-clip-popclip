import { cp, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(root, "extensions");
const dist = path.join(root, "dist");
const packages = ["safeCopy.popclipext", "safeReplace.popclipext"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const packageName of packages) {
  const source = path.join(sourceRoot, packageName);
  const destination = path.join(dist, packageName);
  await cp(source, destination, { recursive: true });
  const archiveName = `${packageName}z`;
  await exec("zip", ["-r", "-X", path.join(dist, archiveName), packageName], {
    cwd: dist,
  });
}
