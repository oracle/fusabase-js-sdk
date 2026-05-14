// import { oracledbErrorHandler } from "../util/utils.js";

// /**
//  * Creates a new document in the given collection.
//  *
//  * @param colRef - Collection reference
//  * @param document - Document data to be stored
//  * @param access_token - Optional access token for authorization
//  * @param transObj - Optional transaction object
//  * @returns A promise resolving to the created document response
//  */
// export async function createDocument<T = any>(
//   colRef: CollectionReference<T>,
//   document: Record<string, unknown>,
//   transObj?: Record<string, unknown>
// ): Promise<T> {
//   const _db = colRef.oracledb;

//   const reqURL =
//     _db.url +
//     endpoints.ADD_DOC +
//     `?apiKey=${_db.app.options.appID}`;

//   const body: Record<string, unknown> = {
//     options: { merge: false },
//     data: document,
//   };

//   if (checkOracledbApiVersion(_db.app.options, OracledbVersion.VER_2)) {
//     body["apiversion"] = 2;
//   }

//   const params: RequestInit & { headers: Record<string, string> } = {
//     method: "POST",
//     headers: {
//       "x-transaction": JSON.stringify(transObj ?? {}),
//     },
//     body: JSON.stringify(body),
//   };

//   const access_token = await getAccessToken(_db.app);

//   if (access_token) {
//     params.headers["Authorization"] = `Bearer ${access_token}`;
//   }

//   return makeRequest<T>(params, reqURL, _db.app);
// }
