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
import path from "node:path";

const root = process.cwd();
const packageNames = [
  "app",
  "logger",
  "auth-core",
  "auth",
  "oracledb",
  "storage",
  "ui",
  "app-trust",
  "relational",
  "fusabase-collections",
  "fusabase-relational"
];

const outputDir = path.join(root, "package-artifacts");
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const pkg of packageNames) {
  const result = spawnSync("npm", ["pack", `./${path.join("packages", pkg)}`, "--pack-destination", outputDir], {
    cwd: root,
    env: { ...process.env, npm_config_cache: "/private/tmp/fusabase-npm-cache" },
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Packed ${packageNames.length} packages into ${outputDir}.`);
