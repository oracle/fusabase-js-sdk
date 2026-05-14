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

export const FUSABASE_INSTANCE_ID_STORAGE_KEY = 'fusabase_instance_id';

/** @internal */
export function generateInstanceId(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return String(c.randomUUID());
  } catch {
    // ignore
  }

  return `fusabase_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** @internal */
export function getOrCreateBrowserInstanceId(): string {
  try {
    const ls = (globalThis as any).localStorage;
    if (ls) {
      const existing = ls.getItem(FUSABASE_INSTANCE_ID_STORAGE_KEY);
      if (existing) return existing;
      const created = generateInstanceId();
      ls.setItem(FUSABASE_INSTANCE_ID_STORAGE_KEY, created);
      return created;
    }
  } catch {
    // ignore (storage blocked / not in browser)
  }

  return generateInstanceId();
}
