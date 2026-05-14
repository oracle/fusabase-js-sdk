# OracleDB Module

Use `fusabase/oracledb` for document-style data access, queries, writes, transactions, aggregates, and snapshot listeners.

## Primary Imports

```ts
import {
  addDoc,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteVector,
  denseVector,
  doc,
  findNearest,
  getDoc,
  getDocs,
  getOracledb,
  increment,
  join,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  sparseVector,
  updateDoc,
  updateDocs,
  where,
  writeBatch
} from "fusabase/oracledb";
```

## Common Patterns

### Read and query

```ts
import {
  collection,
  getDocs,
  getOracledb,
  orderBy,
  query,
  where
} from "fusabase/oracledb";

const db = getOracledb(app);
const recipesRef = collection(db, "recipes");
const recentDinnerSnap = await getDocs(
  query(recipesRef, where("category", "==", "Dinner"), orderBy("createdAt", "desc"))
);
```

### Create and update

```ts
import {
  addDoc,
  collection,
  getOracledb,
  increment,
  updateDoc
} from "fusabase/oracledb";

const db = getOracledb(app);
const recipesRef = collection(db, "recipes");
const recipeRef = await addDoc(recipesRef, { title: "Tea", ratingCount: 0 });
await updateDoc(recipeRef, { ratingCount: increment(1) });
```

### Transactions and batches

```ts
import { doc, runTransaction, writeBatch } from "fusabase/oracledb";

await runTransaction(db, async (tx) => {
  const ref = doc(collection(db, "recipes"), recipeId);
  const snap = await tx.get(ref);
  tx.update(ref, { reviewedAt: Date.now() });
  tx.set(doc(collection(db, "recipes"), "tea"), { title: "Tea" });
  tx.delete(doc(collection(db, "recipes"), "draft"));
});

const batch = writeBatch(db);
batch.set(doc(collection(db, "recipes"), "tea"), { title: "Tea" });
batch.update(doc(collection(db, "recipes"), recipeId), { published: true });
batch.delete(doc(collection(db, "recipes"), "draft"));
await batch.commit();
```

### Bulk update

`updateDocs` returns a `BulkUpdate` that chains `where(...)` constraints and is terminated by an async `update(...)`. There is no `.commit()` step.

```ts
import { getOracledb, updateDocs } from "fusabase/oracledb";

const bulk = updateDocs(db, "recipes");
await bulk
  .where("category", "==", "Drinks")
  .update({ archived: true });
```

### Collection-group queries

```ts
import { collectionGroup, getDocs, query, where } from "fusabase/oracledb";

const allReviews = await getDocs(
  query(collectionGroup(db, "reviews"), where("rating", ">=", 4))
);
```

### Duality-view joins

```ts
import { dualityViewCollection, getDocs, join, query } from "fusabase/oracledb";

const orders = dualityViewCollection(db, "order_dv");
const snap = await getDocs(query(orders, join("items")));
```

### Vector search

```ts
import {
  addDoc, collection, deleteVector, denseVector, doc,
  findNearest, getDocs, query, sparseVector, updateDoc
} from "fusabase/oracledb";

// Write a dense embedding.
await updateDoc(doc(collection(db, "recipes"), "tea"), {
  EMB: denseVector([0.12, -0.91, 0.44])
});

// Sparse alternative.
await addDoc(collection(db, "recipes"), {
  title: "vector doc",
  EMB: sparseVector(1000, [3, 40, 777], [0.5, 0.8, 0.33])
});

// Query nearest.
const snap = await getDocs(
  query(
    collection(db, "recipes"),
    findNearest("EMB", { vector: [0.22, 0.93, -0.1] }, { metric: "COSINE", topK: 10 })
  )
);

// Sparse-query form.
const sparseSnap = await getDocs(
  query(
    collection(db, "recipes"),
    findNearest(
      "EMB",
      { sparse: { type: "sparse", dimension: 1000, indices: [2, 7, 900], values: [0.9, 0.3, 0.5] } },
      { metric: "DOT", topK: 5 }
    )
  )
);

// Delete an embedding key.
await updateDoc(doc(collection(db, "recipes"), "tea"), {
  EMB: deleteVector()
});
```

### Live listeners

```ts
import { collection, onSnapshot } from "fusabase/oracledb";

const unsubscribe = onSnapshot(collection(db, "recipes"), (snapshot) => {
  console.log(snapshot.docs.length);
});
```

## Other Public Areas

- Aggregate helpers such as `count`, `sum`, `average`, and `getAggregateFromServer`.
- Field operations such as `arrayRemove`, `arrayUnion`, `deleteField`, `increment`, and `serverTimestamp`.
- Additional query constraints such as `startAt`, `startAfter`, `endAt`, and `endBefore`.

## Related Docs

- `agent_docs/storage.md`
