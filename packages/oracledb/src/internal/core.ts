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

import { DBConn, getHostString, getSnapshotToken, getToken, nullCheck } from "../util/utils.js";
import { App } from "../../../app/src/public-types.js";
import SnapshotStorage from "./snapshot_storage.js";
import { Utils } from "../util/utils.js";
import { argCheck } from "../util/utils.js";
import { CollectionReference, DualityViewColReference } from "../collection/reference.js";
import { typeStrings } from "../util/utils.js";
import { DocumentReference, DualityViewDocReference } from "../document/reference.js";
import { Transaction } from "../transaction/batch.js";
import { createUniqueName } from "../util/utils.js";
import { WriteBatch } from "../transaction/batch.js";
import { oracledbErrorHandler } from "../util/utils.js";
import { Query } from "../collection/reference.js";
import { createConnection } from "../util/utils_helper.js";
import { LogLevel } from "../../../logger/LogLevel.js";
import { DocumentSnapshot, QueryDocumentSnapshot } from "../document/snapshot.js";
import { SnapshotMetadata } from "../listener/snapshot.js";
import {
  getFailedQuerySnapshotError,
  isQuerySnapshotFromFailedRequest,
  QuerySnapshot,
} from "../collection/snapshot.js";
import { DocumentData } from "../types/common.js";
import { BulkUpdate } from "../transaction/bulk.js";
import { getFieldValue, matchesQueryFilters } from "../local/offline_query_matcher.js";
import {
  DEFAULT_LONG_POLLING_TIMEOUT_SECONDS,
  MAX_REALTIME_MESSAGE_QUEUE_BYTES,
  MAX_REALTIME_MESSAGE_QUEUE_COUNT,
  normalizeLongPollingOptions,
  type LongPollingOptions
} from "./settings.js";

const DISALLOWED_REALTIME_SETTINGS = ["host", "ssl"] as const;
const INITIAL_REALTIME_RECONNECT_DELAY_MS = 1_000;
const MAX_REALTIME_RECONNECT_DELAY_MS = 30_000;
const REALTIME_SOCKET_CONNECT_TIMEOUT_MS = 15_000;

type RealtimeProtocolError = {
  queryId: number;
  code: "RETRY" | "UNAVAILABLE";
  error: string;
};

function parseRealtimeProtocolError(value: unknown): RealtimeProtocolError | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (!Number.isSafeInteger(candidate.queryId) ||
      (candidate.code !== "RETRY" && candidate.code !== "UNAVAILABLE") ||
      typeof candidate.error !== "string") {
    return null;
  }
  return candidate as RealtimeProtocolError;
}

function snapshotDocumentKey(snapshot: QueryDocumentSnapshot<any, any>): string {
  return snapshot.ref?.path ?? snapshot.id;
}

function snapshotDocumentDataKey(snapshot: QueryDocumentSnapshot<any, any>): string {
  return JSON.stringify(snapshot.data());
}

function querySnapshotChanges(
  previous: QuerySnapshot<any, any>,
  current: QuerySnapshot<any, any>
): any[] {
  const previousByKey = new Map(
    previous.docs.map((doc, index) => [snapshotDocumentKey(doc), { doc, index }])
  );
  const currentByKey = new Map(
    current.docs.map((doc, index) => [snapshotDocumentKey(doc), { doc, index }])
  );
  const changes: any[] = [];

  for (const [key, previousEntry] of previousByKey) {
    if (!currentByKey.has(key)) {
      changes.push({
        doc: previousEntry.doc,
        type: "removed",
        oldIndex: previousEntry.index,
        newIndex: -1,
      });
    }
  }

  for (const [key, currentEntry] of currentByKey) {
    const previousEntry = previousByKey.get(key);
    if (!previousEntry) {
      changes.push({
        doc: currentEntry.doc,
        type: "added",
        oldIndex: -1,
        newIndex: currentEntry.index,
      });
    } else if (
      previousEntry.index !== currentEntry.index ||
      snapshotDocumentDataKey(previousEntry.doc) !== snapshotDocumentDataKey(currentEntry.doc)
    ) {
      changes.push({
        doc: currentEntry.doc,
        type: "modified",
        oldIndex: previousEntry.index,
        newIndex: currentEntry.index,
      });
    }
  }

  return changes;
}

function compareRealtimeQueryValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function applyRealtimeQueryConstraints(
  docs: QueryDocumentSnapshot<any, any>[],
  query: any
): QueryDocumentSnapshot<any, any>[] {
  const explicitOrder = query._explicitOrder ?? [];
  let constrainedDocs = [...docs];

  if (explicitOrder.length > 0) {
    constrainedDocs = constrainedDocs
      .filter(doc => explicitOrder.every((order: any) =>
        getFieldValue(doc._data as Record<string, unknown>, order.field) !== undefined
      ))
      .sort((left, right) => {
        for (const order of explicitOrder) {
          const comparison = compareRealtimeQueryValues(
            getFieldValue(left._data as Record<string, unknown>, order.field),
            getFieldValue(right._data as Record<string, unknown>, order.field)
          );
          if (comparison !== 0) {
            return order.direction === "desc" ? -comparison : comparison;
          }
        }
        return snapshotDocumentKey(left).localeCompare(snapshotDocumentKey(right));
      });
  }

  // Limits are not applied to socket updates. The listener only filters and
  // orders its cached visible set from the received change.
  if (query._limitToLast) {
    constrainedDocs.reverse();
  }
  return constrainedDocs;
}

function buildRealtimeEndpoint(ordsHost: string): { host: string; ssl: boolean } {
  const [scheme, hostWithPath = ""] = ordsHost.split("://");
  const schemaName = hostWithPath.split("ords")[1] ?? "";
  const hostPrefix = hostWithPath.split("ords")[0] ?? "";

  return {
    host: `${hostPrefix}ords/baas-realtime${schemaName}`,
    ssl: scheme !== "http"
  };
}

function buildSnapshotNamespace(app: App): string {
  let endpoint = String(app.options.ordsHost ?? '');
  try {
    endpoint = new URL(endpoint).toString();
  } catch {
    // App configuration validation owns endpoint validity; preserve the configured value here.
  }
  return encodeURIComponent(JSON.stringify({
    version: 2,
    appName: app.name,
    endpoint,
    projectId: app.options.projectID ?? '',
    appId: app.options.appID ?? '',
    schema: app.options.schema ?? '',
    backendType: app.options.backendType ?? ''
  }));
}

function rejectRealtimeEndpointOverrides(settings: Record<string, unknown>): void {
  for (const key of DISALLOWED_REALTIME_SETTINGS) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      const error = new Error(
        "Oracledb realtime host and SSL settings cannot be changed at runtime."
      ) as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
  }
}

function normalizeRuntimeLongPollingOptions(
  options: LongPollingOptions | undefined,
  fallbackTimeoutSeconds = DEFAULT_LONG_POLLING_TIMEOUT_SECONDS
): { timeoutSeconds: number } {
  try {
    return normalizeLongPollingOptions(options, fallbackTimeoutSeconds);
  } catch (err) {
    throw oracledbErrorHandler(err);
  }
}

function getMessageByteLength(message: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(message).length;
  }

  return message.length;
}

function createRealtimeQueueError(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = 400;
  return error;
}

function createRealtimeSocketError(message: string): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = 408;
  return error;
}

/** @internal */
export function extractRealtimeChange(eventData: any): {
  changedData: any;
  oid: any;
  metadata: {
    version: any;
    asOf: any;
    lastModified: any;
    created: any;
    parentOid: any;
  };
} {
  const rawChangedData = eventData.changedData;
  const relationalData = rawChangedData?.DATA;
  const sourceData =
    relationalData != null && typeof relationalData === 'object'
      ? relationalData
      : rawChangedData ?? {};
  const { OID: dataOid, _metadata: dataMetadata, parent_oid: parentOid, ...changedData } = sourceData;
  const metadata = dataMetadata ?? rawChangedData?._metadata ?? eventData._metadata ?? {};
  const oid = dataOid ?? rawChangedData?.OID ?? metadata.OID ?? null;
  const changeMetadata = {
    version: metadata.VERSION ?? metadata.etag ?? null,
    asOf: metadata.ASOF ?? metadata.asof ?? null,
    lastModified: metadata.LAST_MODIFIED ?? null,
    created: metadata.CREATED ?? null,
    parentOid: metadata.PARENT_OID ?? parentOid ?? null
  };

  return { changedData, oid, metadata: changeMetadata };
}

function versionMarker(value: unknown): bigint | number | null {
  if (value == null || value === "") return null;
  try {
    return BigInt(String(value));
  } catch {
    const timestamp = Date.parse(String(value));
    return Number.isNaN(timestamp) ? null : timestamp;
  }
}

/** @internal */
export function isStaleRealtimeDocumentEvent(currentSnapshot: any, incomingVersion: unknown): boolean {
  const currentVersion = currentSnapshot?._otherMetadata?.VERSION ?? currentSnapshot?.__version;
  const currentMarker = versionMarker(currentVersion);
  const incomingMarker = versionMarker(incomingVersion);
  if (currentMarker == null || incomingMarker == null || typeof currentMarker !== typeof incomingMarker) {
    return false;
  }
  return incomingMarker < currentMarker;
}

/**
 * Provides access to the document-data service.
 *
 * @example
 * ```ts
 * const database = getOracledb(app);
 * ```
 */
export class Oracledb {
  #conn: DBConn | null = null;
  #snapStore: SnapshotStorage | undefined;
  readonly #snapshotNamespace: string;
/** Describes the public `connection` value. */
  connection: WebSocket | null = null;
  #bundleStore: any;
  readonly #realtimeHost: string;
  readonly #realtimeSsl: boolean;
  /** @internal */ eventManager: EventTarget | undefined;
/** Describes the public `name` value. */
  name: string | undefined;
  /** @internal */  __snaps: Record<string, any> = {};
  /** @internal */  __callbacks: Record<string, any> = {};
  /** @internal */  __listening: number = 0;
  /** @internal */  __messageQueue: string[] = [];
  /** @internal */  __queryIdMap: Record<string, any> = {};
  /** @internal */  __realtimeSubscriptions: Record<string, object> = {};
  private __messageQueueBytes = 0;
  private __initialSnapshotReady: Record<string, boolean> = {};
  private __initialSnapshotEvents: Record<string, MessageEvent[]> = {};
  private __realtimeEventTails: Record<string, Promise<void>> = {};
  private __realtimeGeneration = 0;
  private __reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private __connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private __reconnectAttempts = 0;
  private __socketCreation: Promise<void> | null = null;
  private __hasEstablishedRealtimeSocket = false;
  private __recoveryInProgress = false;
  private __bufferedSocketMessages: MessageEvent[] = [];
  private __realtimeConnectivityBound = false;
  private readonly __onRealtimeOnline = () => this.__scheduleRealtimeReconnect(true);
  private readonly __onRealtimeOffline = () => this.__pauseRealtimeForConnectivityLoss();
  private __authStateListenerBound = false;
  private __unsubscribeAuthStateListener: (() => void) | null = null;
  private __offlineShutdown: (() => Promise<void>) | null = null;
  private __beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;
  private __receivedInitialAuthState = false;
  private __socketAuthIdentity: string | null = null;
  private __socketAuthToken: string | null = null;

  /** @internal */  __listenerKey: string;
/** Describes the public `app` value. */
  app: App;
/** Describes the public `type` value. */
  type: string;
  /** @internal */  _settings: any;

/**
 * Constructs a Oracledb instance with the supplied configuration.
 *
 * @param app - The app instance that owns this service.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { Oracledb } from "fusabase/oracledb";
 * const result = new Oracledb(value);
 * void result;
 * ```
 */
  constructor(app: App) {
    this.__listenerKey = "__fusabaseindexeddb__";
    this.app = app;
    this.type = "oracledb";
    const realtimeEndpoint = buildRealtimeEndpoint(app.options.ordsHost ?? '');
    this.#realtimeHost = realtimeEndpoint.host;
    this.#realtimeSsl = realtimeEndpoint.ssl;
    const initialLongPollingOptions = app.options.longPollingInterval === undefined
      ? undefined
      : { timeoutSeconds: app.options.longPollingInterval };
    this._settings = {
      experimentalAutoDetectLongPolling: !app.options.useSocket,
      experimentalForceLongPolling: !app.options.useSocket,
      host: this.#realtimeHost,
      ssl: this.#realtimeSsl,
      merge: false,
      ignoreUndefinedProperties: true,
      writePromiseResolution: "local",
      experimentalLongPollingOptions: normalizeRuntimeLongPollingOptions(initialLongPollingOptions)
    };
    this.#conn = new DBConn(app);
    this.#snapshotNamespace = buildSnapshotNamespace(app);
    this.#snapStore = new SnapshotStorage(this, `FUSABASE_SNAP_DB2:${this.#snapshotNamespace}`, "SNAPS", "queryId");
    this.#bundleStore = null;
    this.eventManager = new EventTarget();
    if (this.eventManager.addEventListener != null) {
      this.eventManager.addEventListener("socket established", (e: Event) => {
        e.preventDefault?.();
        const queuedMessages = this.__messageQueue.splice(0);
        for (let i = 0; i < queuedMessages.length; i++) {
          try {
            Utils.baasLogger(this.app.logLevel, "sending message from queue", queuedMessages[i]);
            this.connection!.send(queuedMessages[i]);
          } catch (error) {
            this.__messageQueue.unshift(...queuedMessages.slice(i));
            Utils.baasLogger(this.app.logLevel, "Error sending queued snapshot message", error);
            break;
          }
        }
      });
    }
    const __cleanDB = () => {
      Utils.baasLogger(this.app.logLevel, "cleaning db");
      this.connection = null;
      this.__snaps = {};
      if (this.#snapStore != null) {
        this.#snapStore.deleteDB();
      }
    };
    // if (typeof window !== "undefined") {
    //   const listenerKey = this.__listenerKey;
    //   const listening = this;
    //   this.__beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    //     e.preventDefault?.();
    //     let total_listeners:any = window.localStorage.getItem(listenerKey);
    //     if (total_listeners != null && listening.__listening === 1) {
    //       //Utils.baasLogger((listening.app as any).logLevel, "reduce");
    //       total_listeners = parseInt(total_listeners);
    //       window.localStorage.setItem(listenerKey,
    //         Math.max(total_listeners - 1, 0).toString());
    //       if (total_listeners <= 1) {
    //         __cleanDB();
    //       }
    //     }
    //     (e as any).returnValue = '';
    //   };
    //   window.addEventListener('beforeunload', this.__beforeUnloadHandler);
    // }
  }

  /**
   * @internal
   */
  settings(obj: any) {
    argCheck(obj, "Invalid argument passed", true, [typeStrings.OBJECT]);
    rejectRealtimeEndpointOverrides(obj);
    const currentTimeoutSeconds =
      this._settings.experimentalLongPollingOptions?.timeoutSeconds ??
      DEFAULT_LONG_POLLING_TIMEOUT_SECONDS;
    const experimentalLongPollingOptions =
      obj.experimentalLongPollingOptions === undefined
        ? this._settings.experimentalLongPollingOptions
        : normalizeRuntimeLongPollingOptions(
            obj.experimentalLongPollingOptions,
            currentTimeoutSeconds
          );
    this._settings = {
      experimentalAutoDetectLongPolling: obj.experimentalAutoDetectLongPolling ?? this._settings.experimentalAutoDetectLongPolling,
      experimentalForceLongPolling: obj.experimentalForceLongPolling ?? this._settings.experimentalForceLongPolling,
      host: this.#realtimeHost,
      ssl: this.#realtimeSsl,
      merge: obj.merge ?? this._settings.merge,
      ignoreUndefinedProperties: obj.ignoreUndefinedProperties ?? this._settings.ignoreUndefinedProperties,
      writePromiseResolution: obj.writePromiseResolution ?? this._settings.writePromiseResolution,
      experimentalLongPollingOptions: obj.experimentalLongPollingOptions ?? this._settings.experimentalLongPollingOptions
    };
    if (
      (this._settings.experimentalAutoDetectLongPolling || this._settings.experimentalForceLongPolling) &&
      this.connection != null
    ) {
      try {
        this.connection.close();
      } catch {
        // Ignore close errors from already-closing sockets.
      }
      this.connection = null;
    }
  }

  /**
   * @internal
   */
  __getBundleData(id: string): Promise<any> {
    Utils.baasLogger(this.app.logLevel, "retrieving bundle data", id);
    return this.#bundleStore!.get(id);
  }

  /**
   * @internal
   */
  __setBundleData(obj: object): void {
    Utils.baasLogger(this.app.logLevel, "setting bundle data", obj);
    this.#bundleStore!.set(obj);
  }

  /**
   * @internal
   */
  __retrieveSnaps(id: string): Promise<any> {
    return this.#snapStore!.get(id);
  }

  /** @internal */
  __snapshotOwner(): string {
    let userId = 'anonymous';
    let tenantId = '';
    try {
      const auth = this.app.auth();
      userId = String(auth?.currentUser?.uid ?? userId);
      tenantId = String(auth?.tenantId ?? auth?.currentUser?.tenantId ?? '');
    } catch {
      // Snapshot storage remains isolated under the anonymous owner when Auth is unavailable.
    }
    return JSON.stringify({ namespace: this.#snapshotNamespace, userId, tenantId });
  }

  /**
   * @internal
   */
  __setIndexDB(object: object): Promise<any> {
    Utils.baasLogger(this.app.logLevel, "index db set", object);
    return this.#snapStore!.set(object);
  }

  /**
   * @internal
   */
  __removeIndexDB(id: string): Promise<any> {
    return this.#snapStore!.delete(id);
  }

  /** @internal */
  __registerSnapshotQuery(queryId: number, snapshotKey: string): void {
    const existing = this.__queryIdMap[queryId];
    if (existing != null && existing !== snapshotKey) {
      throw new Error('Snapshot query ID collision');
    }
    this.__queryIdMap[queryId] = snapshotKey;
    if (!Object.prototype.hasOwnProperty.call(this.__snaps, queryId)) {
      this.__initialSnapshotReady[queryId] = false;
      this.__initialSnapshotEvents[queryId] = [];
    }
  }

  /** @internal */
  __markInitialSnapshotReady(queryId: number): void {
    if (!Object.prototype.hasOwnProperty.call(this.__snaps, queryId)) return;
    this.__initialSnapshotReady[queryId] = true;
    const events = this.__initialSnapshotEvents[queryId] ?? [];
    delete this.__initialSnapshotEvents[queryId];
    for (const event of events) {
      void this.connection?.onmessage?.(event);
    }
  }

  /** @internal Retains the protocol message needed to restore an online listener after reconnecting. */
  __registerRealtimeSubscription(queryId: number, queryObject: object): void {
    this.__realtimeSubscriptions[queryId] = queryObject;
    this.__bindRealtimeConnectivity();
  }

  /** @internal */
  __unregisterRealtimeSubscription(queryId: number): void {
    delete this.__realtimeSubscriptions[queryId];
    delete this.__initialSnapshotReady[queryId];
    delete this.__initialSnapshotEvents[queryId];
    delete this.__realtimeEventTails[queryId];
    if (!this.__hasActiveRealtimeListeners()) {
      this.__clearReconnectTimer();
      this.__reconnectAttempts = 0;
      this.__unbindRealtimeConnectivity();
    }
  }

  /** @internal Resets reconnect backoff after a subscription receives data. */
  __clearSubscriptionRetry(queryId: string): void {
    if (this.__realtimeSubscriptions[queryId] != null) {
      this.__reconnectAttempts = 0;
    }
  }

  private __clearMessageQueue(): void {
    this.__messageQueue = [];
    this.__messageQueueBytes = 0;
  }

  private __clearInitialSnapshotEvents(): void {
    this.__initialSnapshotReady = {};
    this.__initialSnapshotEvents = {};
    this.__realtimeEventTails = {};
  }

  private __queueInitialSnapshotEvent(queryId: number, event: MessageEvent): void {
    const events = this.__initialSnapshotEvents[queryId] ?? [];
    if (events.length >= MAX_REALTIME_MESSAGE_QUEUE_COUNT) {
      this.__terminateRealtimeSubscription(
        queryId,
        createRealtimeQueueError("Realtime initial snapshot event queue limit exceeded.")
      );
      return;
    }
    events.push(event);
    this.__initialSnapshotEvents[queryId] = events;
  }

  private async __acquireRealtimeEventProcessing(queryId: number): Promise<() => void> {
    const previous = this.__realtimeEventTails[queryId] ?? Promise.resolve();
    let release: () => void;
    const current = new Promise<void>(resolve => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.__realtimeEventTails[queryId] = tail;
    await previous;
    return () => {
      release();
      if (this.__realtimeEventTails[queryId] === tail) {
        delete this.__realtimeEventTails[queryId];
      }
    };
  }

  private __hasActiveRealtimeListeners(): boolean {
    return Object.values(this.__snaps).some(
      listeners => Array.isArray(listeners) && listeners.length > 0
    );
  }

  private __clearReconnectTimer(): void {
    if (this.__reconnectTimer != null) {
      clearTimeout(this.__reconnectTimer);
      this.__reconnectTimer = null;
    }
  }

  private __clearConnectTimeout(): void {
    if (this.__connectTimeout != null) {
      clearTimeout(this.__connectTimeout);
      this.__connectTimeout = null;
    }
  }

  private __networkAllowsRealtimeAttempt(): boolean {
    return typeof navigator === "undefined" || navigator.onLine !== false;
  }

  private __bindRealtimeConnectivity(): void {
    if (this.__realtimeConnectivityBound || typeof window === "undefined") return;
    this.__realtimeConnectivityBound = true;
    window.addEventListener("online", this.__onRealtimeOnline);
    window.addEventListener("offline", this.__onRealtimeOffline);
  }

  private __unbindRealtimeConnectivity(): void {
    if (!this.__realtimeConnectivityBound || typeof window === "undefined") return;
    window.removeEventListener("online", this.__onRealtimeOnline);
    window.removeEventListener("offline", this.__onRealtimeOffline);
    this.__realtimeConnectivityBound = false;
  }

  private __pauseRealtimeForConnectivityLoss(): void {
    this.__clearReconnectTimer();
    const socket = this.connection;
    if (!socket) return;
    this.__handleRealtimeSocketFailure(socket, false);
    try {
      socket.close();
    } catch {
      // The browser may have already disposed of the connection.
    }
  }

  private __scheduleRealtimeReconnect(immediate = false): void {
    if (!this.__hasActiveRealtimeListeners() || this.__reconnectTimer != null ||
        !this.__networkAllowsRealtimeAttempt()) {
      return;
    }

    const maxDelay = Math.min(
      INITIAL_REALTIME_RECONNECT_DELAY_MS * 2 ** this.__reconnectAttempts,
      MAX_REALTIME_RECONNECT_DELAY_MS
    );
    const delay = immediate ? 0 : Math.ceil(maxDelay / 2 + Math.random() * (maxDelay / 2));
    if (!immediate) this.__reconnectAttempts++;
    this.__reconnectTimer = setTimeout(() => {
      this.__reconnectTimer = null;
      if (!this.__hasActiveRealtimeListeners() || !this.__networkAllowsRealtimeAttempt()) return;

      const token = this.__getCurrentAuthToken();
      this.__createSocket(token)
        .catch(error => {
          Utils.baasLogger(this.app.logLevel, "Unable to reconnect realtime socket", error);
        })
        .finally(() => {
          if (!this.connection || this.connection.readyState === WebSocket.CLOSED) {
            this.__scheduleRealtimeReconnect();
          }
        });
    }, delay);
  }

  private __handleRealtimeSocketFailure(socket: WebSocket, retry = true): void {
    if (this.connection !== socket) return;
    this.__clearConnectTimeout();
    this.connection = null;
    this.__realtimeGeneration++;
    // Queued protocol messages belong to the failed connection. Active
    // subscriptions are replayed from __realtimeSubscriptions on reconnect.
    this.__clearMessageQueue();
    if (retry) this.__scheduleRealtimeReconnect();
  }

  private __terminateRealtimeSubscription(queryId: number, error: Error): void {
    const listeners = this.__snaps[queryId] ?? [];
    delete this.__snaps[queryId];
    delete this.__queryIdMap[queryId];
    this.__unregisterRealtimeSubscription(queryId);
    for (const listenerId of listeners) {
      const callback = this.__callbacks[listenerId];
      delete this.__callbacks[listenerId];
      try {
        callback?.error?.(error);
      } catch (callbackError) {
        Utils.baasLogger(this.app.logLevel, "Error in snapshot callback", callbackError);
      }
    }
  }

  private __restoreRealtimeSubscriptions(): void {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) return;
    for (const queryObject of Object.values(this.__realtimeSubscriptions)) {
      try {
        this.connection.send(JSON.stringify(queryObject));
      } catch (error) {
        Utils.baasLogger(this.app.logLevel, "Unable to restore realtime subscription", error);
        this.__handleRealtimeSocketFailure(this.connection);
        return;
      }
    }
  }

  private async __refreshRealtimeSnapshots(socket: WebSocket): Promise<void> {
    for (const queryId of Object.keys(this.__realtimeSubscriptions)) {
      if (this.connection !== socket) return;
      const snapshotKey = this.__queryIdMap[queryId];
      if (!snapshotKey) continue;
      const stored = await this.__retrieveSnaps(snapshotKey);
      if (!stored || this.connection !== socket) continue;

      const previous = stored.snap;
      const refreshed = await (stored.type === "document"
        ? previous.ref.get()
        : previous.query.get());
      if (isQuerySnapshotFromFailedRequest(refreshed)) {
        throw getFailedQuerySnapshotError(refreshed) ?? new Error("Unable to refresh realtime snapshot");
      }
      if (this.connection !== socket || !this.__snaps[queryId]) continue;

      if (stored.type !== "document") {
        refreshed.docChanges = () => querySnapshotChanges(previous, refreshed);
      }
      stored.snap = refreshed;
      await this.__setIndexDB(stored);
      for (const listenerId of this.__snaps[queryId]) {
        try {
          this.__callbacks[listenerId]?.next?.(refreshed);
        } catch (error) {
          Utils.baasLogger(this.app.logLevel, "Error in snapshot callback", error);
        }
      }
    }
  }

  private __flushBufferedSocketMessages(socket: WebSocket): void {
    const messages = this.__bufferedSocketMessages.splice(0);
    for (const message of messages) {
      if (this.connection !== socket) return;
      void socket.onmessage?.(message);
    }
  }

  private __bindAuthStateListener(): void {
    if (this.__authStateListenerBound) {
      return;
    }

    try {
      const auth = this.app.auth();
      if (typeof auth?.onIdTokenChanged !== "function") {
        return;
      }

      this.__authStateListenerBound = true;
      this.__unsubscribeAuthStateListener = auth.onIdTokenChanged(() => {
        // Auth invokes an observer immediately with the current state. That
        // establishes the baseline; only later changes end live listeners.
        if (!this.__receivedInitialAuthState) {
          this.__receivedInitialAuthState = true;
          return;
        }
        if (!this.__socketMatchesCurrentAuth()) {
          this.__resetRealtimeForAuthChange();
        }
      });
    } catch {
      // Auth is optional until a realtime listener is created. Listener
      // creation will still use its normal token acquisition path.
    }
  }

  private __resetRealtimeForAuthChange(): void {
    const callbacks = Object.values(this.__callbacks);
    const socket = this.connection;

    // Invalidate in-flight socket creation and detach all handlers before
    // closing. A late event from the previous session must have no route to
    // the next session's callbacks or cache.
    this.__realtimeGeneration++;
    this.connection = null;
    this.__socketAuthIdentity = null;
    this.__socketAuthToken = null;
    this.__clearMessageQueue();
    this.__clearInitialSnapshotEvents();
    this.__snaps = {};
    this.__callbacks = {};
    this.__queryIdMap = {};
    this.__realtimeSubscriptions = {};
    this.__recoveryInProgress = false;
    this.__bufferedSocketMessages = [];
    this.__clearReconnectTimer();
    this.__clearConnectTimeout();
    this.__unbindRealtimeConnectivity();
    this.__reconnectAttempts = 0;
    this.__hasEstablishedRealtimeSocket = false;
    this.eventManager?.dispatchEvent(new Event("authentication changed"));

    if (socket != null) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState !== WebSocket.CLOSED) {
        try {
          socket.close();
        } catch (error) {
          Utils.baasLogger(this.app.logLevel, "Error closing realtime socket after auth change", error);
        }
      }
    }

    const error = new Error("Realtime listener ended because authentication changed.");
    for (const callback of callbacks) {
      if (callback?.error) {
        try {
          callback.error(error);
        } catch (callbackError) {
          Utils.baasLogger(this.app.logLevel, "Error in snapshot callback", callbackError);
        }
      }
    }
  }

  /** @internal */
  __closeRealtimeForSignOut(): void {
    this.__realtimeGeneration++;
    this.__failRealtimeListeners(
      createRealtimeSocketError("Realtime listeners were terminated because the user signed out.")
    );

    const connection = this.connection;
    this.connection = null;
    this.__socketAuthIdentity = null;
    this.__socketAuthToken = null;
    this.__clearConnectTimeout();
    this.__reconnectAttempts = 0;
    if (connection && connection.readyState !== WebSocket.CLOSED) {
      try {
        connection.close();
      } catch {
        // Ignore close errors from already-closing sockets.
      }
    }
  }

  /** @internal */
  __getRealtimeGeneration(): number {
    return this.__realtimeGeneration;
  }

  /** @internal */
  __ensureAuthStateListener(): void {
    this.__bindAuthStateListener();
  }

  /** @internal */
  __setOfflineShutdown(shutdown: (() => Promise<void>) | null): void {
    this.__offlineShutdown = shutdown;
  }

  /** @internal Releases realtime, auth, and offline resources owned by this instance. */
  async _delete(): Promise<void> {
    this.__realtimeGeneration++;
    this.__unsubscribeAuthStateListener?.();
    this.__unsubscribeAuthStateListener = null;
    this.__authStateListenerBound = false;
    this.__failRealtimeListeners(new Error('OracleDB instance was deleted.'));
    await this.__offlineShutdown?.();
    this.__offlineShutdown = null;
    if (typeof window !== 'undefined' && this.__beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.__beforeUnloadHandler);
      this.__beforeUnloadHandler = null;
    }

    const socket = this.connection;
    this.connection = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Socket may already be closed.
      }
    }
    this.__clearMessageQueue();
    this.__clearInitialSnapshotEvents();
    this.__snaps = {};
    this.__callbacks = {};
    this.__queryIdMap = {};
    this.__realtimeSubscriptions = {};
    this.__recoveryInProgress = false;
    this.__bufferedSocketMessages = [];
    this.__clearReconnectTimer();
    this.__clearConnectTimeout();
    this.__unbindRealtimeConnectivity();
    this.__socketAuthIdentity = null;
    this.__socketAuthToken = null;
    this.eventManager = undefined;
    this.#conn = null;
  }

  /** @internal */
  __getAuthStateKey(): string {
    return JSON.stringify({
      identity: this.__getCurrentAuthIdentity(),
      token: this.__getCurrentAuthToken(),
    });
  }

  private __getCurrentAuthIdentity(): string {
    try {
      const auth = this.app.auth();
      return JSON.stringify({
        userId: String(auth?.currentUser?.uid ?? "anonymous"),
        tenantId: String(auth?.tenantId ?? auth?.currentUser?.tenantId ?? "")
      });
    } catch {
      return JSON.stringify({ userId: "anonymous", tenantId: "" });
    }
  }

  private __socketMatchesCurrentAuth(): boolean {
    return this.__socketAuthIdentity === this.__getCurrentAuthIdentity() &&
      this.__socketAuthToken === this.__getCurrentAuthToken();
  }

  private __getCurrentAuthToken(): string | null {
    try {
      return getToken(this.app) ?? null;
    } catch {
      return null;
    }
  }

  private __failRealtimeListeners(error: Error): void {
    const callbacks = Object.values(this.__callbacks);
    this.__clearMessageQueue();
    this.__clearInitialSnapshotEvents();
    this.__snaps = {};
    this.__callbacks = {};
    this.__queryIdMap = {};
    this.__realtimeSubscriptions = {};
    this.__recoveryInProgress = false;
    this.__bufferedSocketMessages = [];
    this.__clearReconnectTimer();
    this.__unbindRealtimeConnectivity();

    for (const callback of callbacks) {
      if (callback?.error) {
        try {
          callback.error(error);
        } catch (ue) {
          Utils.baasLogger(this.app.logLevel, "Error in snapshot callback", ue);
        }
      }
    }
  }

  private __queueMessage(message: string): void {
    const messageBytes = getMessageByteLength(message);
    if (
      messageBytes > MAX_REALTIME_MESSAGE_QUEUE_BYTES ||
      this.__messageQueue.length >= MAX_REALTIME_MESSAGE_QUEUE_COUNT ||
      this.__messageQueueBytes + messageBytes > MAX_REALTIME_MESSAGE_QUEUE_BYTES
    ) {
      const error = createRealtimeQueueError("Realtime listener message queue limit exceeded.");
      this.__failRealtimeListeners(error);
      throw oracledbErrorHandler(error);
    }

    this.__messageQueue.push(message);
    this.__messageQueueBytes += messageBytes;
  }

  /**
   * @internal
   */
  __sendMessage(payload: object): void {
    const strPayload = JSON.stringify(payload);
    if (!this.connection || this.connection.readyState !== 1) {
      Utils.baasLogger(this.app.logLevel, "adding to message queue");
      this.__queueMessage(strPayload);
    } else {
      Utils.baasLogger(this.app.logLevel, "sending directly");
      this.connection.send(strPayload);
    }
  }

  // Socket establishment logic
  /**
   * @internal
   */
  async __createSocket(token: string | null): Promise<void> {
  if (this.__socketCreation) return this.__socketCreation;
  const creation = this.__createSocketAttempt(token);
  this.__socketCreation = creation;
  try {
    await creation;
  } finally {
    if (this.__socketCreation === creation) this.__socketCreation = null;
  }
  }

  private async __createSocketAttempt(token: string | null): Promise<void> {
  if (!this.__networkAllowsRealtimeAttempt()) return;
  this.__bindAuthStateListener();
  const authIdentity = this.__getCurrentAuthIdentity();
  if (this.connection != null && this.connection.readyState !== WebSocket.CLOSED) {
    if (this.__socketMatchesCurrentAuth()) {
      return;
    }
    this.__resetRealtimeForAuthChange();
  }

  const generation = this.__realtimeGeneration;

  // Record the identity before awaiting the snapshot ticket. Auth state
  // notifications are dispatched asynchronously; without this, the login
  // notification can arrive while the ticket request is in flight and
  // incorrectly cancel a socket being created for that same user.
  this.__socketAuthIdentity = authIdentity;
  this.__socketAuthToken = token;

  let snapToken: any;
  try {
    snapToken = await getSnapshotToken(
      this.app,
      `${this.app.options.ordsHost}_/baas-services/idm/onprem/${this.app.options.projectID}/authorizeSnapshot?apiKey=${this.app.options.appID}`,
      token ?? ""
    );
  } catch (error) {
    this.__scheduleRealtimeReconnect();
    throw error;
  }

  // An auth transition while the snapshot ticket was being fetched makes
  // that ticket unusable for the current realtime session.
  if (generation !== this.__realtimeGeneration || authIdentity !== this.__getCurrentAuthIdentity() ||
      (this.connection != null && this.connection.readyState !== WebSocket.CLOSED)) {
    if (authIdentity !== this.__getCurrentAuthIdentity()) {
      this.__resetRealtimeForAuthChange();
    }
    return;
  }

  let socket: WebSocket;
  try {
    socket = createConnection(
      getHostString(this.#realtimeSsl, this.#realtimeHost, snapToken["access_token"])
    );
  } catch (error) {
    this.__scheduleRealtimeReconnect();
    throw error;
  }
  this.connection = socket;
  this.__clearConnectTimeout();
  this.__connectTimeout = setTimeout(() => {
    if (this.connection !== socket || socket.readyState === WebSocket.OPEN) return;
    Utils.baasLogger(this.app.logLevel, "Realtime socket connection timed out");
    try {
      socket.close();
    } catch {
      // The socket may already have failed; schedule a replacement either way.
    }
    this.__handleRealtimeSocketFailure(socket);
  }, REALTIME_SOCKET_CONNECT_TIMEOUT_MS);

  const __fireEvent = (event: Event) => {
    this.eventManager?.dispatchEvent(event);
  };

  socket.onopen = (event: Event) => {
    event.preventDefault();
    this.__clearConnectTimeout();
    const isReconnect = this.__hasEstablishedRealtimeSocket;
    this.__hasEstablishedRealtimeSocket = true;
    this.__reconnectAttempts = 0;
    this.__clearReconnectTimer();
    if (isReconnect || Object.keys(this.__realtimeSubscriptions).length > 0) {
      this.__clearMessageQueue();
      this.__restoreRealtimeSubscriptions();
    }
    __fireEvent(new Event("socket established"));
    if (isReconnect && Object.keys(this.__realtimeSubscriptions).length > 0) {
      this.__recoveryInProgress = true;
      void this.__refreshRealtimeSnapshots(socket)
        .catch(error => {
          Utils.baasLogger(this.app.logLevel, "Unable to refresh realtime snapshots after reconnect", error);
          this.__handleRealtimeSocketFailure(socket);
          try {
            socket.close();
          } catch {
            // The server may already have closed this connection.
          }
        })
        .finally(() => {
          if (this.connection === socket) {
            this.__recoveryInProgress = false;
            this.__flushBufferedSocketMessages(socket);
          }
        });
    }
  };

  socket.onerror = (error: Event) => {
    error.preventDefault?.();
    __fireEvent(new Event("socket error"));
    this.__handleRealtimeSocketFailure(socket);
  };

  socket.onclose = (event: CloseEvent) => {
    event.preventDefault?.();
    __fireEvent(new Event("socket closed"));
    this.__handleRealtimeSocketFailure(socket);
  };

  const oracleDB = this;

  socket.onmessage = async (event: MessageEvent) => {
    event.preventDefault();
    if (oracleDB.connection !== socket) return;
    if (oracleDB.__recoveryInProgress) {
      oracleDB.__bufferedSocketMessages.push(event);
      return;
    }
    if (!oracleDB.__socketMatchesCurrentAuth()) {
      oracleDB.__resetRealtimeForAuthChange();
      return;
    }
    Utils.baasLogger(oracleDB.app.logLevel, "event received!", event.data);

    let eventData: any;
    try {
      eventData = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    const rawSocketEvent = typeof CustomEvent !== "undefined"
      ? new CustomEvent("offline socket message", { detail: eventData })
      : Object.assign(new Event("offline socket message"), { detail: eventData });
    __fireEvent(rawSocketEvent as Event);

    const protocolError = parseRealtimeProtocolError(eventData);
    if (protocolError) {
      // Offline persistence owns its existing transport-retry flow. The
      // structured envelope is forwarded above as a raw socket event. RETRY
      // also enters that path as a transport failure so every active target
      // reattaches and refreshes from the local-store controller.
      if (!oracleDB.__realtimeSubscriptions[protocolError.queryId]) {
        if (protocolError.code === "RETRY") {
          __fireEvent(new Event("socket error"));
          oracleDB.__handleRealtimeSocketFailure(socket);
          try {
            socket.close();
          } catch {
            // The server may already have closed this connection.
          }
        } else {
          Utils.baasLogger(
            oracleDB.app.logLevel,
            "Realtime listener received an error for an unknown subscription.",
            protocolError
          );
        }
        return;
      }
      if (protocolError.code === "UNAVAILABLE") {
        oracleDB.__terminateRealtimeSubscription(
          protocolError.queryId,
          new Error(protocolError.error)
        );
        return;
      }
      oracleDB.__handleRealtimeSocketFailure(socket);
      try {
        socket.close();
      } catch {
        // The server may already have closed this connection.
      }
      return;
    }
    if (eventData && Object.prototype.hasOwnProperty.call(eventData, "error")) {
      const errorQueryId = eventData.queryId;
      if (Number.isSafeInteger(errorQueryId) && oracleDB.__realtimeSubscriptions[errorQueryId]) {
        const errorMessage = typeof eventData.error === "string" && eventData.error
          ? eventData.error
          : "Realtime listener received an invalid or non-retryable protocol error.";
        oracleDB.__terminateRealtimeSubscription(errorQueryId, new Error(errorMessage));
      } else {
        Utils.baasLogger(
          oracleDB.app.logLevel,
          "Ignoring realtime error without a matching subscription.",
          eventData
        );
      }
      return;
    }

    if (
      !Object.prototype.hasOwnProperty.call(eventData, "queryId") ||
      !Object.prototype.hasOwnProperty.call(eventData, "rowId")
    ) {
      return;
    }

    const queryId = eventData.queryId;
    oracleDB.__clearSubscriptionRetry(queryId);
    const rowId = eventData.rowId;
    const realtimeChange = extractRealtimeChange(eventData);
    let changedData = realtimeChange.changedData;
    let oid = realtimeChange.oid;
    const opr: string[] = eventData.operations;

    if (!Object.prototype.hasOwnProperty.call(oracleDB.__snaps, queryId)) {
      return;
    }

    if (oracleDB.__initialSnapshotReady[queryId] === false) {
      oracleDB.__queueInitialSnapshotEvent(queryId, event);
      return;
    }

    const mappedQueryId = oracleDB.__queryIdMap[queryId];
    const releaseRealtimeEventProcessing = await oracleDB.__acquireRealtimeEventProcessing(queryId);

    try {
      try {
        const resObj = await oracleDB.__retrieveSnaps(mappedQueryId);
      Utils.baasLogger(oracleDB.app.logLevel, "resObj from retrieve", resObj);

      if (resObj == null) return;

      // ---------- Document Snapshot Handling ----------
      if (resObj.type === "document") {
        Utils.baasLogger(oracleDB.app.logLevel, "document level run");
        const listenedDocId = String(resObj.path ?? "").split("/").filter(Boolean).pop();
        if (oid && listenedDocId && oid !== listenedDocId) {
          return;
        }
        if (!oid && rowId && resObj.snap?.__rowId && resObj.snap.__rowId !== rowId) {
          return;
        }

        let docR: any;
        if (resObj.snap.ref.type === "dualityviewdocument") {
          docR = oracleDB.dualityViewDoc(resObj.path);
        } else {
          docR = oracleDB.doc(resObj.path);
        }

        if (opr[opr.length - 1] === "DELETE") {
          changedData = resObj.snap._data;;
        }

        if (isStaleRealtimeDocumentEvent(resObj.snap, realtimeChange.metadata.version)) {
          return;
        }

        const docData = {
          DOCUMENT: changedData,
          LAST_MODIFIED: realtimeChange.metadata.lastModified,
          CREATED: realtimeChange.metadata.created,
          SUBCOLLECTION: null,
          ASOF: realtimeChange.metadata.asOf,
          PARENT_OID: realtimeChange.metadata.parentOid,
          VERSION: realtimeChange.metadata.version,
          ROWID: rowId
        };

        const docSnap = new DocumentSnapshot(
          docData,
          docR,
          new SnapshotMetadata(false, false)
        );
        resObj.snap = docSnap;

        for (const _queryId of oracleDB.__snaps[queryId]) {
          const callback = oracleDB.__callbacks[_queryId];
          if (callback) {
            try {
              callback.next(docSnap);
            } catch (ue) {
              Utils.baasLogger(oracleDB.app.logLevel, "Error running callbacks ", ue);
            }
          }
        }

        await oracleDB.__setIndexDB(resObj)
          .then(() => Utils.baasLogger(oracleDB.app.logLevel, "document set successful for onmessage"))
          .catch((e: any) => Utils.baasLogger(oracleDB.app.logLevel, e));

        // ---------- Query Snapshot Handling ----------
      } else {
        Utils.baasLogger(oracleDB.app.logLevel, "query level run");

        let query: any;
        let ref: any = null;
        const oldSnap = resObj.snap;
        const currentDocument = oldSnap._docs.find((doc: any) =>
          oid ? doc.id === oid : doc.__rowId === rowId
        );
        if (currentDocument && isStaleRealtimeDocumentEvent(currentDocument, realtimeChange.metadata.version)) {
          return;
        }

        if (opr[opr.length - 1] === "DELETE") {
          changedData = null;
          if (!oid) {
            for (const doc of oldSnap._docs) {
              if (doc.__rowId === rowId) {
                oid = doc.id;
                changedData = doc._data;
                break;
              }
            }
          }
        }

        if (resObj.snap.query.type === "dualityviewcollection") {
          query = oracleDB.dualityViewCollection(resObj.path);
          ref = query.dualityViewDoc(oid);
        } else {
          query = oracleDB.collection(resObj.path);
          ref = query.doc(oid);
        }

        const docData = {
          DOCUMENT: changedData,
          LAST_MODIFIED: realtimeChange.metadata.lastModified,
          CREATED: realtimeChange.metadata.created,
          SUBCOLLECTION: null,
          ASOF: realtimeChange.metadata.asOf,
          PARENT_OID: realtimeChange.metadata.parentOid,
          VERSION: realtimeChange.metadata.version,
          ROWID: rowId
        };

        const docSnap = new QueryDocumentSnapshot(
          docData,
          ref,
          new SnapshotMetadata(false, false)
        );

        if (!oid) {
          return;
        }

        const activeQuery = oldSnap.query ?? query;
        const operation = opr[opr.length - 1];

        const docSnaps = [...oldSnap._docs];
        const indexMap: Record<string, number> = {};
        for (let i = 0; i < docSnaps.length; i++) {
          indexMap[docSnaps[i].id] = i;
        }

        const oldIndex = indexMap[oid];
        const existedInOldSnapshot = Object.prototype.hasOwnProperty.call(indexMap, oid);
        const matchesQuery = operation !== "DELETE" &&
          matchesQueryFilters(changedData, oldSnap.query?._conditions ?? []);

        if (operation === "DELETE") {
          if (!existedInOldSnapshot) {
            return;
          }
          docSnaps.splice(oldIndex, 1);
        } else if (!matchesQuery) {
          if (!existedInOldSnapshot) {
            return;
          }
          docSnaps.splice(oldIndex, 1);
        } else if (operation === "INSERT" || !existedInOldSnapshot) {
          docSnaps.push(docSnap);
        } else if (operation === "UPDATE") {
          docSnaps[oldIndex] = docSnap;
        }

        const constrainedDocs = applyRealtimeQueryConstraints(docSnaps, activeQuery);

        const querSnap = new QuerySnapshot(
          constrainedDocs,
          activeQuery,
          new SnapshotMetadata(false, false)
        );
        querSnap._docs = constrainedDocs;

        const docChange = querySnapshotChanges(oldSnap, querSnap);
        if (docChange.length === 0) {
          return;
        }
        querSnap.docChanges = () => docChange;
        resObj.snap = querSnap;

        for (const _queryId of oracleDB.__snaps[queryId]) {
          const callback = oracleDB.__callbacks[_queryId];
          if (callback) {
            try {
              callback.next(resObj.snap);
            } catch (ue) {
              Utils.baasLogger(oracleDB.app.logLevel, "Error running callbacks ", ue);
            }
          }
        }

        Utils.baasLogger(oracleDB.app.logLevel, "query set on message", resObj);

        await oracleDB.__setIndexDB(resObj)
          .then(() => Utils.baasLogger(oracleDB.app.logLevel, "query set successful for onmessage"))
          .catch((e: any) => Utils.baasLogger(oracleDB.app.logLevel, e));
      }
      } catch (e) {
        Utils.baasLogger(oracleDB.app.logLevel, e);
      }
    } finally {
      releaseRealtimeEventProcessing();
    }
  };
}

  /**
   * @internal
   */
  get url(): string {
    return this.#conn!.url;
  }

/**
 * Executes the setLogLevel operation for this public SDK type.
 *
 * @param log - The log accepted by this operation.
 * @returns The result produced by `setLogLevel`, including any requested data or handle.
 * @example
 * ```ts
 * import { Oracledb } from "fusabase/oracledb";
 * const result = client.setLogLevel(value);
 * void result;
 * ```
 */
  setLogLevel(log: LogLevel): void {
    this.app.logLevel = log;
  }

  /**
   * @internal
   */
  collection(colPath: string): CollectionReference {
    argCheck(colPath, "Invalid collection path", true, [typeStrings.STRING]);
    return new CollectionReference(this, colPath);
  }

  /**
   * @internal
   */
  dualityViewCollection(name: string): DualityViewColReference {
    argCheck(name, "Invalid collection path", true, [typeStrings.STRING]);
    return new DualityViewColReference(this, name);
  }

  /**
   * @internal
   */
  dualityViewDoc(docPath: string): DualityViewDocReference {
    argCheck(docPath, "Invalid document path", true, [typeStrings.STRING]);
    return new DualityViewDocReference(this, docPath);
  }

  /**
   * @internal
   */
  collectionGroup(name: string): Query<DocumentData, DocumentData> {
    argCheck(name, "Invalid collection group name", true, [typeStrings.STRING]);
    const colRef = new CollectionReference(this, "");
    const query = colRef.__copyQuery();
    query._path = [];
    query._col_group = name;
    return query;
  }

  /**
   * @internal
   */
  doc(docPath: string): DocumentReference {
    argCheck(docPath, "Invalid document path", false, [typeStrings.STRING]);
    return new DocumentReference(this, docPath);
  }

  /**
   * @internal
   */
  updateDocs (path: string): BulkUpdate {
    return new BulkUpdate(this, path);
  }

  /**
   * @internal
   */
  async runTransaction<T>(callback: (t: Transaction) => Promise<T>, attempts?: { maxAttempts: number }): Promise<T> {
    argCheck(callback, "Invalid callback passed", true, [typeStrings.FUNCTION]);
    const trans_name = createUniqueName();
    let trans = new Transaction(trans_name);
    let res: T | null = null;
    let temp_res: any = null;
    let success = false;
    const maxAttempts = attempts == null ? 5 : attempts.maxAttempts;
    let retry = maxAttempts;
    while (!success && retry > 0) {
      try {
        if (retry < maxAttempts) {
          trans.__reset();
        }
        res = await callback(trans);
        temp_res = await (trans as any).__makeOperations();
        success = true;
      } catch (e) {
        if (retry === 1) {
          throw e;
        }
        retry--;
        success = false;
        const baseDelay = 50;
        const maxDelay = 10000;
        const delay = Math.min(baseDelay * (2 ** (maxAttempts - retry)), maxDelay);
        const jitter = Math.random() * delay * 0.5;
        const waitTime = delay + jitter;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    return res ?? temp_res;
  }

  /**
   * @internal
   */
  batch(): WriteBatch {
    const trans_name = createUniqueName();
    return new WriteBatch(trans_name);
  }

/**
 * Executes the toJSON operation for this public SDK type.
 *
 * @returns The result produced by `toJSON`, including any requested data or handle.
 * @example
 * ```ts
 * import { Oracledb } from "fusabase/oracledb";
 * const result = client.toJSON();
 * void result;
 * ```
 */
  toJSON(): any {
    return {
      appName: this.app.name,
      type: this.type
    };
  }

  /**
   * @internal
   */
  loadBundle(data: ArrayBuffer | ReadableStream<Uint8Array> | string): any {
    nullCheck(data, "Invalid data.");
    if (!(data instanceof ReadableStream || data instanceof ArrayBuffer || typeof data === 'string')) {
      const error = new Error("Supported data types for bundle load are ArrayBuffer, ReadableStream<Uint8Array> and string") as Error & { status?: number };
      error.status = 400;
      throw oracledbErrorHandler(error);
    }
    return null;
  }

  /**
   * @internal
   */
  async namedQuery(name: string): Promise<Query> {
    const error = new Error("Not implemented") as any;
    error.status = 501;
    throw oracledbErrorHandler(error);
  }
}
