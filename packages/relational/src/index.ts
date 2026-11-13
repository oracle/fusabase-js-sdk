// Copyright (c) 2015, 2026, Oracle and/or its affiliates.

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

import { initializeApp } from "../../app/src/app.js";
import { type FusabaseConfig } from "../../app/src/public-types.js";
import { registerAuth } from "../../auth/src/register.js";
import { registerRelational } from "./register.js";
import {
  RelationalDb,
  RelationalDatabaseError,
  RelationalFilterBuilder,
  RelationalQueryBuilder,
  RelationalResumableUploadTask,
  RelationalStorageClient,
  RelationalStorageError,
  RelationalStorageFileApi,
  type RelationalResponse,
  type BaasDateValue,
  type RelationalStorageResponse,
  type CountPreference,
  type RelationalFileObject,
  type RelationalFileOptions,
  type RelationalPublicUrlData,
  type RelationalResumableUploadBody,
  type RelationalResumableUploadData,
  type RelationalResumableUploadOptions,
  type RelationalResumableUploadSession,
  type RelationalResumableUploadTaskOptions,
  type RelationalResumableUploadTaskState,
  type RelationalRetryOptions,
  type RelationalSearchOptions,
  type RelationalSignedUploadUrlData,
  type RelationalSignedUrlData,
  type RelationalUploadData,
  type RelationalUploadOptions,
} from "./relational.js";
import {
  RelationalAuthClient,
  RelationalAuthError,
  MfaClient,
  type RelationalAuthEvent,
  type RelationalAuthResponse,
  type RelationalAuthSession,
  type RelationalAuthUser,
  type RelationalClaims,
  type RelationalClaimsResponse,
  type RelationalAuthCredentials,
  type RelationalIdTokenCredentials,
  type RelationalIdTokenProvider,
  type RelationalInitializeResponse,
  type RelationalOAuthCredentials,
  type RelationalPasswordCredentials,
  type RelationalProviderCredentials,
  type RelationalResendParams,
  type RelationalSessionInput,
  type RelationalUserAttributes,
  type RelationalUserIdentity,
  type MfaChallengeParams,
  type MfaEnrollParams,
  type MfaFactor,
  type MfaFactorType,
  type MfaSignInChallengeParams,
  type MfaSignInVerifyParams,
  type MfaResponse,
  type MfaVerifyParams,
  type RelationalMfaRequired,
} from "./auth.js";
import {
  AppTrustClient,
  type AppTrust,
  type AppTrustOptions,
  type AppTrustTokenListener,
  type AppTrustTokenResult,
  type Unsubscribe,
} from "./app-trust.js";
import {
  clearIndexedDbPersistence,
  disableNetwork,
  enableIndexedDbPersistence,
  enableMemoryPersistence,
  enableNetwork,
  enableOffline,
  isOfflineEnabled,
  persistentLocalCache,
  shutdownOffline,
  waitForPendingWrites,
} from "./offline/index.js";
import type {
  RelationalOfflineMetadata,
  RelationalOfflineOptions,
  RelationalOfflineRelationOptions,
  RelationalPersistenceKind,
  RelationalPersistentCacheOptions,
} from "./offline/index.js";
import {
  HCaptchaProvider,
  FusabaseAppTrustError,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  TurnstileProvider,
} from "../../app-trust/src/index.js";

// RelationalDb always exposes an auth client, so register Auth when this
// entry point is imported. Consumers should not need a separate
// `fusabase/auth` import before calling createClient().
registerAuth();
registerRelational();

let directClientCount = 0;

/**
 * Creates a data client without requiring separate application and service
 * initialization calls.
 *
 * @param ordsHost - Base ORDS URL, including its trailing slash.
 * @param config - `FusabaseConfig` object. Required keys are
 * `{ schema: string, app_name: string, app_type: string, app_id: string,
 * project_id: string, objs_type: string, storage_bucket: string,
 * auth_type: string, auth_id: string, backend_type: "RELATIONAL" }`. Optional
 * keys include `app_name`, `use_socket`, `long_polling_interval`,
 * `upload_chunk_size`, and `max_upload_bytes`. Do not
 * include `ords_host`; this argument supplies it.
 * @returns A client with relation, account, file, and attestation members.
 *
 * @example
 * ```ts
 * const client = createClient("https://example.com/ords/USER1/", {
 *   schema: "user1",
 *   app_name: "TodoApp",
 *   app_type: "WEB",
 *   app_id: "app-id",
 *   project_id: "project-id",
 *   objs_type: "dbfs",
 *   storage_bucket: "bucket-name",
 *   auth_type: "base",
 *   auth_id: "auth-id",
 *   backend_type: "RELATIONAL",
 * });
 * await client.from("todos").select();
 * ```
 */
export function createClient(ordsHost: string, config: FusabaseConfig): RelationalDb {
  if (config.backend_type === "COLLECTION") {
    throw new RelationalDatabaseError("COLLECTION configuration cannot be used by the relational client", 400, { code: "invalid_backend_type" });
  }
  const app = initializeApp(
    { ...config, ords_host: ordsHost },
    `relational-client-${directClientCount++}`,
    "RELATIONAL"
  );
  return new RelationalDb(app);
}

export {
  RelationalAuthClient,
  RelationalAuthError,
  MfaClient,
  AppTrustClient,
  HCaptchaProvider,
  FusabaseAppTrustError,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  TurnstileProvider,
  RelationalDb,
  RelationalDatabaseError,
  RelationalFilterBuilder,
  RelationalQueryBuilder,
  RelationalResumableUploadTask,
  RelationalStorageClient,
  RelationalStorageError,
  RelationalStorageFileApi,
  enableOffline,
  isOfflineEnabled,
  enableIndexedDbPersistence,
  enableMemoryPersistence,
  persistentLocalCache,
  disableNetwork,
  enableNetwork,
  waitForPendingWrites,
  clearIndexedDbPersistence,
  shutdownOffline,
};
export type {
  BaasDateValue,
  CountPreference,
  RelationalAuthEvent,
  RelationalAuthCredentials,
  RelationalClaims,
  RelationalClaimsResponse,
  RelationalIdTokenCredentials,
  RelationalIdTokenProvider,
  RelationalInitializeResponse,
  RelationalOAuthCredentials,
  RelationalPasswordCredentials,
  RelationalProviderCredentials,
  RelationalResendParams,
  RelationalAuthResponse,
  RelationalAuthSession,
  RelationalAuthUser,
  RelationalSessionInput,
  RelationalResponse,
  RelationalStorageResponse,
  RelationalFileObject,
  RelationalFileOptions,
  RelationalPublicUrlData,
  RelationalResumableUploadBody,
  RelationalResumableUploadData,
  RelationalResumableUploadOptions,
  RelationalResumableUploadSession,
  RelationalResumableUploadTaskOptions,
  RelationalResumableUploadTaskState,
  RelationalRetryOptions,
  RelationalSearchOptions,
  RelationalSignedUploadUrlData,
  RelationalSignedUrlData,
  RelationalUploadData,
  RelationalUploadOptions,
  RelationalUserAttributes,
  RelationalUserIdentity,
  MfaChallengeParams,
  MfaEnrollParams,
  MfaFactor,
  MfaFactorType,
  MfaSignInChallengeParams,
  MfaSignInVerifyParams,
  MfaResponse,
  MfaVerifyParams,
  RelationalMfaRequired,
  AppTrust,
  AppTrustOptions,
  AppTrustTokenListener,
  AppTrustTokenResult,
  Unsubscribe,
  RelationalOfflineMetadata,
  RelationalOfflineOptions,
  RelationalOfflineRelationOptions,
  RelationalPersistenceKind,
  RelationalPersistentCacheOptions,
};
