import fs from "fs";
import path from "path";

const src = "packages/ui/src/icons";
const dest = "dist/ui/src/icons";

fs.mkdirSync(dest, { recursive: true });

for (const file of fs.readdirSync(src)) {
  fs.copyFileSync(
    path.join(src, file),
    path.join(dest, file)
  );
}
