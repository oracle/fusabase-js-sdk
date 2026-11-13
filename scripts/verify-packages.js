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

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const artifactsDir = path.join(root, "package-artifacts");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fusabase-package-verify-"));
const nodeModulesDir = path.join(tempDir, "node_modules");

function run(command, args, cwd = tempDir) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function findTarball(packageBaseName) {
  const files = fs.readdirSync(artifactsDir);
  const tarball = files.find(file => file.startsWith(`${packageBaseName}-`) && file.endsWith(".tgz"));
  if (!tarball) {
    throw new Error(`Could not find tarball for ${packageBaseName}`);
  }
  return path.join(artifactsDir, tarball);
}

function extractPackage(tarball, scopeName, packageName) {
  const destination = path.join(nodeModulesDir, scopeName, packageName);
  fs.mkdirSync(destination, { recursive: true });
  run("tar", ["-xzf", tarball, "--strip-components=1", "-C", destination]);
}

function copyDir(src, dest) {
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

fs.mkdirSync(nodeModulesDir, { recursive: true });
fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
  name: "fusabase-package-verify",
  private: true,
  type: "module"
}, null, 2));

const packages = [
  ["fusabase-logger", "logger"],
  ["fusabase-app", "app"],
  ["fusabase-auth-core", "auth-core"],
  ["fusabase-auth", "auth"],
  ["fusabase-oracledb", "oracledb"],
  ["fusabase-storage", "storage"],
  ["fusabase-ui", "ui"],
  ["fusabase-app-trust", "app-trust"],
  ["fusabase-relational", "relational"],
  ["fusabase-fusabase-collections", "fusabase-collections"],
  ["fusabase-fusabase-relational", "fusabase-relational"]
];

for (const [tarballBase, packageName] of packages) {
  extractPackage(findTarball(tarballBase), "@fusabase", packageName);
}

const localTslib = path.join(root, "node_modules", "tslib");
if (fs.existsSync(localTslib)) {
  copyDir(localTslib, path.join(nodeModulesDir, "tslib"));
} else {
  throw new Error("Local node_modules/tslib is required for offline package verification.");
}

const smoke = `
import { initializeApp } from '@fusabase/app';
import { getAuth } from '@fusabase/auth';
import { getOracledb } from '@fusabase/oracledb';
import { getStorage } from '@fusabase/storage';
import { initializeAppTrust } from '@fusabase/app-trust';
import { getOracledb as getCollectionsOracledb } from '@fusabase/fusabase-collections/db';
import { createClient } from '@fusabase/fusabase-relational';

console.log(JSON.stringify({
  initializeApp: typeof initializeApp,
  getAuth: typeof getAuth,
  getOracledb: typeof getOracledb,
  getStorage: typeof getStorage,
  initializeAppTrust: typeof initializeAppTrust,
  getCollectionsOracledb: typeof getCollectionsOracledb,
  createClient: typeof createClient
}, null, 2));
`;

run("node", ["--input-type=module", "-e", smoke]);

console.log(`Verified individual package installs in ${tempDir}.`);
