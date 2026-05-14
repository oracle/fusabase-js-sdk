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

import fusabase from "./fusabase-internal.js";
import { App } from "./public-types.js";
import {LogLevel} from "../../logger/LogLevel.js";
import { FusabaseOptions } from "./public-types.js"; // your existing options interface

// initialize app
export function initializeApp(options: FusabaseOptions | null, name?: string): App {
  if (options == null) {
    const err = new Error("Incorrect config provided!") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }

  if (name == null) {
    name = "[DEFAULT]";
  } else if (typeof name === "object") {
    // If name was mistakenly passed as an object, assume it has a .name
    name = (name as { name?: string }).name ?? "[DEFAULT]";
  }

  return fusabase.initializeApp(options, name);
}

// get app instance
export function getApp(name?: string): App {
  if (name == null) {
    name = "[DEFAULT]";
  }
  return fusabase.app(name);
}

// get all apps
export function getApps(): App[] {
  const apps: App[] = [];
  Object.entries(fusabase._apps).forEach(([_, value]) => {
    if (value instanceof App) {
      apps.push(value);
    }
  });
  return apps;
}

// make app unusable
export async function deleteApp(app: App): Promise<null> {
  if (!(app instanceof App)) {
    const err = new Error("App instance is null!") as Error & { status?: number };
    err.status = 400;
    throw fusabase.appErrorHandler(err);
  }
  await app.delete();
  return null;
}

// set log level for all apps
export function setLogLevel(logLevel: LogLevel): void {
  const apps = getApps();
  for (let i = 0; i < apps.length; i++) {
    apps[i].logLevel = logLevel;
  }
}
