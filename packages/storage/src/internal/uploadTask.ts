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

import { argCheck, StorageError, storageErrorHandler, typeStrings, StorageErrorCode } from "../errors.js";
import { UploadTaskController } from "../helpers/uploadHelper.js";
import { TaskEvent, TaskState } from "../types.js";
import type { FullMetadata, UploadMetadata } from "../types.js";
import { getAccessToken, Utils, CustomEvent } from "./utils.js";

/**
 * Class representing an upload task.
 *
 * @example
 * ```ts
 * const task = uploadBytesResumable(fileRef, file);
 * task.pause();
 * ```
 */
export class UploadTask {
  /** The current snapshot of the upload task. */
  snapshot: UploadTaskSnapshot | null;
  private uploadController: UploadTaskController;
  private resolve: ((snapshot: UploadTaskSnapshot) => void) | null = null;
  private reject: ((error: any) => void) | null = null;
  private promise: Promise<UploadTaskSnapshot>;
  private app: any;
  /** @internal */
  _tasks: (() => void)[];
  /** @internal */
  _queue: Promise<void>;
  /** @internal */
  _running: boolean;

/**
 * Constructs a UploadTask instance with the supplied configuration.
 *
 * @param data - The document or request data to write.
 * @param metadata - The metadata accepted by this operation.
 * @param ref - The ref accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = new UploadTask({ title: "Example" }, { title: "Example" }, value);
 * void result;
 * ```
 */
  constructor(data: any, metadata: UploadMetadata, ref: any) {
    this._tasks = [];
    this._queue = Promise.resolve();
    this._running = false;

    if (!Object.prototype.hasOwnProperty.call(metadata, "contentType")) {
      metadata["contentType"] = data.type ? data.type : 'application/octet-stream';
    }
    Utils.baasLogger(ref.storage.logLevel, `Printing from uploadtask ${ref}`)
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    })
    this.app = ref.storage.app;
    const initialMetadata: FullMetadata = {
      bucket: ref.bucket,
      name: ref.name,
      fullPath: ref.fullPath,
      size: 0,
      timeCreated: "",
      updated: "",
      contentType: metadata.contentType,
      md5Hash: undefined
    };
    this.snapshot = new UploadTaskSnapshot(this, initialMetadata, ref);
    this.uploadController = ref.storage.__initUploadController(metadata);
    this.uploadController
      .initUpload(this.snapshot, data)
      .then(() => this.runUpload())
      .catch((err) => this.changeState(TaskState.ERROR, err));
  }

  /**
   * @internal
   */
  _enqueue(action: () => void) {
    this._tasks.push(action);
    if (!this._running) {
      this._process();
    }
  }

  /**
   * @internal
   */
  async _process() {
    this._running = true;
    while (this._tasks.length) {
      const fn = this._tasks.shift();
      if (!fn) continue; // ✅ ensure fn is defined
      try {
        await fn();
      } catch (err) {
        Utils.baasLogger(this.app.logLevel, "Task failed:", err);
      }
    }
    this._running = false;
  }

  /**
   * @function
   * Change the state of task.
   * @param {String} state
   * @returns {void}
   */
  /**
   * @internal
   */
  private changeState(state: TaskState, err: any = null) {
    if (this.snapshot) {
      this.snapshot.state = state;

      if (state === TaskState.CANCELED) {
        err = new StorageError(StorageErrorCode.CANCELED, "Upload Aborted!");
        err.status = 499;
        err = storageErrorHandler(err);
      }

      let options = {
        detail: {
          snapshot: this.snapshot,
          error: err
        }
      }
      this.uploadController
        .fireEvent(new CustomEvent(TaskEvent.STATE_CHANGED, options));
    }

    let completed = true;
    switch (state) {
      case TaskState.SUCCESS:
        if (this.resolve && this.snapshot) {
          this.resolve(this.snapshot);
        }
        break;
      case TaskState.CANCELED:
        if (this.reject) {
          this.reject(err);
        }
        break;
      case TaskState.ERROR:
        err = storageErrorHandler(err);
        if (this.reject) {
          this.reject(err);
        }
        break;
      default:
        completed = false;
    }
    if (completed) {
      this.resolve = null;
      this.reject = null;
    }
  }

/**
 * Executes the cancel operation for this public SDK type.
 *
 * @returns The result produced by `cancel`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.cancel();
 * void result;
 * ```
 */
  cancel() {
    this._enqueue(async () => {
      if (this.snapshot?.state === TaskState.SUCCESS) {
        Utils.baasLogger(this.app.logLevel,"Object Already Uploaded!");
        return;
      }
      Utils.baasLogger(this.app.logLevel,"Cancelling...");
      await this.uploadController.abortUpload();
      this.changeState(TaskState.CANCELED);
      Utils.baasLogger(this.app.logLevel,"Cancelled");
    });
  }

/**
 * Executes the on operation for this public SDK type.
 *
 * @param event - The event accepted by this operation.
 * @param next - The next accepted by this operation.
 * @param error - The authentication or service error to inspect.
 * @param complete - The complete accepted by this operation.
 * @returns The result produced by `on`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.on(value, value, new Error("example"), value);
 * void result;
 * ```
 */
  on(event: string, next: ((snapshot: UploadTaskSnapshot) => void) | null = null, error: ((error: any) => void) | null = null, complete: (() => void) | null = null) {
    argCheck(event, "Invalid event passed", true, [typeStrings.STRING]);
    argCheck(next, "Invalid next callback", false, [typeStrings.FUNCTION]);
    argCheck(error, "Invalid error callback", false, [typeStrings.FUNCTION]);
    argCheck(complete, "Invalid complete callback", false,
      [typeStrings.FUNCTION]);
    const controller = new AbortController();
    if (next || error || complete) {
      this.uploadController.setCallBacks(event, {
        'next': next,
        'error': error,
        'complete': complete
      }, controller);
      return () => controller.abort();
    }
    else {
      return (callbacks: any) =>
        this.uploadController.setCallBacks(event, callbacks, controller);
    }
  }

  /**
   * Internal method to resume the upload.
   */
  /**
   * @internal
   */
  async #resumeUpload(): Promise<number> {
    Utils.baasLogger(this.app.logLevel,"resume upload called");
    Utils.baasLogger(this.app.logLevel,this.snapshot?.state);
    if (this.snapshot?.state !== TaskState.RUNNING)
      return 0;

    try {
      const access_token = await getAccessToken(this.app);
      const snap = await this.uploadController.continueUpload(this.snapshot, access_token);

      let res = 0;
      if (snap.state === TaskState.SUCCESS)
        this.changeState(snap.state);
      else if (snap.state === TaskState.RUNNING)
        res = 1;
      if (this.snapshot) {
        this.snapshot.bytesTransferred = snap.bytesTransferred;
        this.snapshot.metadata.md5Hash = snap.md5sum;
        this.snapshot.metadata.size = snap.size;
        this.snapshot.metadata.timeCreated = snap.timeCreated;
        this.snapshot.metadata.updated = snap.updated;
      }
      return res;
    }
    catch (err:any) {
      if (err.name !== 'AbortError')
        this.changeState(TaskState.ERROR, err);
      return 0;
    }
  }

  /**
   * Internal method to start the upload process.
   */
  private runUpload = () => {
    let _do = 0;
    this._enqueue(async () => {
      Utils.baasLogger(this.app.logLevel,"Running #resumeUpload...");
        _do = await this.#resumeUpload();
        if (_do) {
          this._enqueue(async () => {
            this.runUpload();
          });
        }
      Utils.baasLogger(this.app.logLevel,"Completed #resumeUpload");
    });
  }

/**
 * Executes the resume operation for this public SDK type.
 *
 * @returns The result produced by `resume`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.resume();
 * void result;
 * ```
 */
  resume(): void {
    if (!this.uploadController.isMultipart) {
      return;
    }
    this._enqueue(async () => {
      Utils.baasLogger(this.app.logLevel,"Resuming...");
      if (this.snapshot?.state === TaskState.SUCCESS
      || this.snapshot?.state === TaskState.CANCELED
      || this.snapshot?.state === TaskState.ERROR
      || this.snapshot?.state === TaskState.RUNNING)
      return;
      this.changeState(TaskState.RUNNING);
      this.runUpload();
      Utils.baasLogger(this.app.logLevel,"Resumed");
    });
  }

/**
 * Executes the pause operation for this public SDK type.
 *
 * @returns The result produced by `pause`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.pause();
 * void result;
 * ```
 */
  pause(): void {
    if (!this.uploadController.isMultipart) {
      return;
    }
    this._enqueue(() => {
      Utils.baasLogger(this.app.logLevel,"Pausing...");
      if (this.snapshot?.state === TaskState.RUNNING)
        this.changeState(TaskState.PAUSED);

      Utils.baasLogger(this.app.logLevel,"Paused");
    });
  }

/**
 * Executes the then operation for this public SDK type.
 *
 * @param onFulfilled - The onFulfilled accepted by this operation.
 * @param onRejected - The onRejected accepted by this operation.
 * @returns The result produced by `then`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.then(value, value);
 * void result;
 * ```
 */
  then(onFulfilled?: ((snapshot: UploadTaskSnapshot) => unknown) | null, onRejected?: ((error: StorageError) => unknown) | null): Promise<unknown> {
    argCheck(onFulfilled, "Invalid success callback", false,
       [typeStrings.FUNCTION]);
    argCheck(onRejected, "Invalid error callback", false, [typeStrings.FUNCTION]);
    return this.promise.then(onFulfilled, onRejected);
  }

/**
 * Executes the catch operation for this public SDK type.
 *
 * @param onRejected - The onRejected accepted by this operation.
 * @returns The result produced by `catch`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTask } from "fusabase/storage";
 * const result = client.catch(value);
 * void result;
 * ```
 */
  catch(onRejected: (error: StorageError) => unknown): Promise<unknown> {
    argCheck(onRejected, "Invalid callback", false, [typeStrings.FUNCTION]);
    return this.then(null, onRejected);
  }
}

/**
 * Class representing a snapshot of an upload task.
 *
 * @example
 * ```ts
 * task.on(TaskEvent.STATE_CHANGED, snapshot => console.log(snapshot.bytesTransferred));
 * ```
 */
export class UploadTaskSnapshot {
  /** The number of bytes transferred so far. */
  bytesTransferred: number;
  /** The StorageReference for the upload. */
  ref: any;
  /** The UploadTask instance. */
  task: any;
  /** The metadata associated with the upload. */
  metadata: FullMetadata;
  /** The current state of the upload. */
  state: TaskState;
  /** The total number of bytes to upload. */
  totalBytes: number;

/**
 * Constructs a UploadTaskSnapshot instance with the supplied configuration.
 *
 * @param task - The task accepted by this operation.
 * @param metadata - The metadata accepted by this operation.
 * @param ref - The ref accepted by this operation.
 * @returns The result produced by `constructor`, including any requested data or handle.
 * @example
 * ```ts
 * import { UploadTaskSnapshot } from "fusabase/storage";
 * const result = new UploadTaskSnapshot(value, { title: "Example" }, value);
 * void result;
 * ```
 */
  constructor(task: UploadTask, metadata: FullMetadata, ref: any) {
    this.task = task;
    this.ref = ref;
    this.metadata = metadata;
    this.bytesTransferred = 0;
    this.state = TaskState.RUNNING;
    this.totalBytes = 0;
  }
}
