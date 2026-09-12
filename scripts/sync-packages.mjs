import { cp, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const canonical = path.join(root, "src", "redact.js");
const packageCopies = [
  path.join(root, "extensions", "safeCopy.popclipext", "redact.js"),
  path.join(root, "extensions", "safeReplace.popclipext", "redact.js"),
];

if (process.argv.includes("--write")) {
  await Promise.all(packageCopies.map((destination) => cp(canonical, destination)));
  console.log("Synchronized the redaction engine into both extension packages.");
} else {
  const expected = await readFile(canonical, "utf8");
  for (const file of packageCopies) {
    const actual = await readFile(file, "utf8");
    if (actual !== expected) {
      throw new Error(`${path.relative(root, file)} is out of sync with src/redact.js`);
    }
  }
  console.log("Both extension packages contain the current redaction engine.");
}
