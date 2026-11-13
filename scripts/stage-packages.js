// Copyright (c) 2015, 2025, Oracle and/or its affiliates.

//-----------------------------------------------------------------------------
//
// This software is dual-licensed to you under the Universal Permissive License
// (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
// 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
// either license.
//
// If you elect to accept the software under the Apache License, Version 2.0,
// the following applies:
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
//-----------------------------------------------------------------------------
// 

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagesRoot = path.join(root, "packages");
const rootDist = path.join(root, "dist");

const packageNames = [
  "app",
  "app-trust",
  "auth",
  "auth-core",
  "fusabase-collections",
  "logger",
  "oracledb",
  "fusabase-relational",
  "storage",
  "relational",
  "ui"
];

const packageNameMap = new Map(packageNames.map(name => [name, `@fusabase/${name}`]));
packageNameMap.set("relational", "@fusabase/relational");

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteBuiltImports(filePath) {
  if (!filePath.endsWith(".js") && !filePath.endsWith(".d.ts")) return;

  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(
    /(["'])((?:\.\.\/)+)(app|app-trust|auth|auth-core|fusabase-collections|oracledb|fusabase-relational|relational|storage|ui)\/src\/([^"']+)\1/g,
    (_match, quote, _prefix, pkg, subpath) => {
      const packageName = packageNameMap.get(pkg);
      if (subpath === "index.js" || subpath === "index.d.ts") {
        return `${quote}${packageName}${quote}`;
      }
      return `${quote}${packageName}/${subpath}${quote}`;
    }
  );
  text = text.replace(
    /(["'])((?:\.\.\/)+)logger\/([^"']+)\1/g,
    (_match, quote, _prefix, subpath) => {
      if (subpath === "LogLevel.js" || subpath === "LogLevel.d.ts") {
        return `${quote}@fusabase/logger${quote}`;
      }
      return `${quote}@fusabase/logger/${subpath}${quote}`;
    }
  );
  fs.writeFileSync(filePath, text);
}

function walkFiles(dir, visit) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, visit);
    } else if (entry.isFile()) {
      visit(fullPath);
    }
  }
}

function stagePackage(pkg) {
  const packageDir = path.join(packagesRoot, pkg);
  const distDir = path.join(packageDir, "dist");
  rmDir(distDir);

  if (pkg === "logger") {
    copyDir(path.join(rootDist, "logger"), distDir);
  } else {
    copyDir(path.join(rootDist, pkg, "src"), distDir);
  }

  walkFiles(distDir, rewriteBuiltImports);
}

for (const pkg of packageNames) {
  stagePackage(pkg);
}

console.log(`Staged ${packageNames.length} packages with package-local dist output.`);
