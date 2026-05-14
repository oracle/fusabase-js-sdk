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

/**
 * Indicates the current state of a bundle loading task.
 */
export enum TaskState {
  Error = "Error",
  Running = "Running",
  Success = "Success"
}

// export interface LoadBundleTaskProgress {
//   /**
//    * The number of documents that have been loaded from the bundle so far.
//    */
//   documentsLoaded: number;

//   /**
//    * The total number of documents in the bundle.
//    */
//   totalDocuments: number;

//   /**
//    * The number of bytes that have been loaded from the bundle so far.
//    */
//   bytesLoaded: number;

//   /**
//    * The total number of bytes in the bundle.
//    */
//   totalBytes: number;

//   /**
//    * The current state of the loading task.
//    * Possible values: `"Error" | "Running" | "Success"`
//    */
//   taskState: "Error" | "Running" | "Success";
// }