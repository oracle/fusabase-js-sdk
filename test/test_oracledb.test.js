// test/fusabase.test.js
import * as assert from 'node:assert';
import {App, initializeApp, setLogLevel} from "fusabase/app";
import { 
  getOracledb, 
  collection, 
  doc, 
  LogLevel,
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  addDoc,
  orderBy, 
  limit, 
  limitToLast, 
  serverTimestamp,
  collectionGroup,
  join,
  where,
  Timestamp, 
  startAt, 
  startAfter, 
  endAt, 
  endBefore, 
  updateDoc, 
  deleteField,
  increment,
  arrayRemove,
  arrayUnion,
  deleteDoc, 
  FieldPath,
  initializeOracledb,
  dualityViewCollection,
  dualityViewDoc,
  runTransaction,
  writeBatch,
  getCountFromServer,
  getAggregateFromServer,
  sum
} from 'fusabase/oracledb';
import { expect } from 'chai';

describe('fusabase Integration Tests for version 1', function () {
  this.timeout(30000);

  const options = {}

  let app, db, cityRef, cityRef1, subColPlacesRef, fd1, docRef, docRef1, res9, subDocColPlacesRef;
  const collectionName = "Users";
  let testDocId;
  const testDocData = {
    "_id": 20050, "name": "Alice", "age": 30,
    "about": "Student"
  };

  const cityCol = "city";
  const cityCol1 = "pl";
  const docId = "city_001";
  const initialData = {
    name: "Metropolis",
    population: 500000,
    "mayor.name": "John Doe",
    stats: {
      founded: 1850,
      nicknames: ["Big City", "The Hub"],
      metrics: {
        area_km2: 450,
      }
    }
  };
  
  let testDocId1;
  const initialData1 = {
    "_id": 20051, "name": "Alice", "age": 30,
    "about": "Student"
  };
  

  it('should initialize the app', () => {
    app = initializeApp({...options,appCheckToken:"APP_CHECK_TOKEN"}, "test");
    expect(app.options.ordsHost, options.ords_host);
    expect(app.options.schema, options.schema);
    expect(app.options.appID, options.app_id);
    expect(app.options.objsType, options.objs_type);
    expect(app.options.storageBucket, options.storage_bucket);
    expect(app.options.authType, options.auth_type);
    expect(app.options.authID, options.auth_id);
  });

  it('should set log level', () => {
    setLogLevel(LogLevel.ERROR);
  });

  it('should initialize oracledb', () => {
    db = initializeOracledb(app);
    expect(db.app.options.ordsHost, options.ords_host);
    expect(db.app.options.schema, options.schema);
    expect(db.app.options.appID, options.app_id);
    expect(db.app.options.objsType, options.objs_type);
    expect(db.app.options.storageBucket, options.storage_bucket);
    expect(db.app.options.authType, options.auth_type);
    expect(db.app.options.authID, options.auth_id);
    expect(db.app.config.objsType, options.objs_type);
    expect(db.app.config.storageBucket, options.storage_bucket);
    expect(db.app.config.authType, options.auth_type);
    expect(db.app.config.authID, options.auth_id);
  });

  it('should get city collection reference', () => {
    cityRef = collection(db, "city");
    cityRef1 = collection(db, "pl");
    assert.ok(cityRef);
    assert.ok(cityRef.oracledb);
    expect(cityRef.oracledb.app.name, 'test');
    expect(cityRef.id, 'city');
    expect(cityRef.path, 'city');
    assert.ok(!cityRef.parent);
  });

  it('should add and delete document', async () => {
    const resAddDoc = await collection(db, "city").add({
      name: 'Udaipur',
      country: 'India',
      state: 'Rajasthan',
      capital: false,
      population: 200000,
      regions: ['Mevar'],
    });
    await resAddDoc.delete();
  });

  it('should set multiple docs in city', async () => {
    await setDoc(doc(cityRef, "SF"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 860000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TEST_LA"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 10000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TEST_LA1"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 10000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TOK"), {
      name: 'Tokyo',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
  });

  it('should update a doc', async () => {
    await setDoc(doc(cityRef, "UPDATE_TEST"), {
      name: 'UPDATE_TEST',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
    await updateDoc(doc(cityRef, "UPDATE_TEST"), { population: 1000000 });
  });

  it('setdoc with merge', async () => {
    await setDoc(doc(cityRef1, "surat"), {
      name: 'UPDATE_TEST',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000
    });

    await setDoc(doc(cityRef1, "surat"), {
        population:1
    }, {merge:true});

    let docSnap = await getDoc(doc(cityRef1, "surat"));
    expect(docSnap).to.exist;
    expect(docSnap.data().population).to.equal(1);
  });

  it('should get on query level', async () => {
    const resdoc = await getDocs(collection(getOracledb(), "city"));
    assert.ok(resdoc);
  });

  it('should run a transaction', async () => {
    await setDoc(doc(cityRef, "TRANS_TEST2"), {
      name: 'Tokyo',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
    const sfDocRef = doc(cityRef, "TRANS_TEST2");
    const transRes1 = await runTransaction(db, (transaction) =>
      transaction.get(sfDocRef).then((sfDoc) => {
        assert.ok(sfDoc.exists());
        transaction.update(sfDocRef, { population: 123453 });
        return 123453;
      })
    );
    expect(transRes1, 123453);
  });

  it('should execute WriteBatch', async () => {
    const batch = writeBatch(db);
    const nycRef = doc(cityRef, "BATCH_TEST");;
    batch.set(nycRef, { name: 'New York City' });
    batch.update(nycRef, { population: 11000 });
    batch.delete(nycRef);
    await batch.commit();
    expect(1, 1);
  });

  it('collection group', async () => {
    const nycRef = collectionGroup(db, 'comments');
    const res = await getDocs(nycRef);
    expect(res).to.exist;
    expect(res._docs).to.exist;
    expect(res.query).to.exist;
  });

  it('should get count', async () => {
    const ares1 = await getCountFromServer(cityRef);
    expect(ares1.data().count, 6);
    const ares2 = await getCountFromServer(query(cityRef, orderBy("population")));
    expect(ares2.data().count, 6);
  });

  it('should run aggregate', async () => {
    const ares3 = await getAggregateFromServer(cityRef, {
        totalPopulation: sum('population'),
    });
    expect(ares3.data().totalPopulation).to.equal(11003453);
  });

  it('should aggregate total and final population ordered by population', async function () {
    const ares4 = await getAggregateFromServer(query(cityRef, orderBy("population")), {
        totalPopulation: sum('population'),
        finalPopulation: sum('population')
    });
    expect(ares4.data().totalPopulation).to.equal(11003453);
  });

  it('should get documents from city collection', async function () {
    const res1 = await getDocs(collection(db, "city"));
    expect(res1).to.exist;
    expect(res1._docs).to.exist;
    expect(res1.query).to.exist;
    expect(res1._docs[0].data()).to.exist;
  });

  it('should get documents from city collection with where ==', async function () {
    const res2 = await getDocs(query(collection(db, "city"), where("capital", "==", true)));
    expect(res2).to.exist;
    expect(res2._docs).to.exist;
    expect(res2.query).to.exist;
    expect(res2._docs[0].data()).to.exist;
  });

  it("should get documents from city collection with where >=", async function () {
    const q = query(collection(db, "city"), where("population", ">=", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where <=", async function () {
    const q = query(collection(db, "city"), where("population", "<=", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where >", async function () {
    const q = query(collection(db, "city"), where("population", ">", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where <", async function () {
    const q = query(collection(db, "city"), where("population", "<", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where in", async function () {
    const q = query(collection(db, "city"), where("country", "in", ["USA"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where not-in", async function () {
    const q = query(collection(db, "city"), where("country", "not-in", ["USA"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where !=", async function () {
    const q = query(collection(db, "city"), where("country", "!=", "USA"));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where array-contains", async function () {
    const q = query(collection(db, "city"), where("regions", "array-contains", "west_coast"));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where array-contains-any", async function () {
    const q = query(collection(db, "city"), where("regions", "array-contains-any", ["west_coast","honshu"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(6);
  });

  it('should get documents from city collection with orderBy', async function () {
    const res3 = await getDocs(query(collection(db, "city"), orderBy("name", "desc")));
    expect(res3).to.exist;
    expect(res3._docs).to.exist;
    expect(res3.query).to.exist;
    expect(res3._docs[0].data()).to.exist;
  });

  it('should get documents from city collection with limit', async function () {
    const res4 = await getDocs(query(collection(db, "city"), limit(1)));
    expect(res4).to.exist;
    expect(res4._docs).to.exist;
    expect(res4.query).to.exist;
    expect(res4._docs.length).to.equal(1);
    expect(res4._docs[0].data()).to.exist;
  });

  it('should delete document TEMP from city collection', async function () {
    await setDoc(doc(getOracledb(), "city", "TEMP"), {
      name: "San Francisco", state: "CA", country: "USA",
      capital: false, population: 860000,
      regions: ["west_coast", "norcal"]
    });
    await deleteDoc(doc(getOracledb(), "city", "TEMP"));
  });

  it('should create correct document reference for SF', function () {
    docRef = doc(getOracledb(), "city", "SF");
    expect(docRef).to.exist;
    expect(docRef.oracledb).to.exist;
    expect(docRef.oracledb.app.name).to.equal("test");
    expect(docRef.id).to.equal("SF");
    expect(docRef.path).to.equal("city/SF");
    expect(docRef.parent.id).to.equal("city");
  });

  it('should get document data from SF docRef', async function () {
    const res5 = await getDoc(docRef);
    expect(res5.data()).to.exist;
    expect(res5.ref).to.exist;
    expect(res5.ref.id).to.equal('SF');
  });

  it('should create correct subcollection reference for SF/places', function () {
    subColPlacesRef = collection(doc(getOracledb(), "city", "SF"), "places");
    expect(subColPlacesRef).to.exist;
    expect(subColPlacesRef.oracledb).to.exist;
    expect(subColPlacesRef.oracledb.app.name).to.equal("test");
    expect(subColPlacesRef.id).to.equal("places");
    expect(subColPlacesRef.path).to.equal("city/SF/places");
    expect(subColPlacesRef.parent.id).to.equal("SF");
  });

  it('should set documents in SF/places subcollection', async function () {
    await setDoc(doc(subColPlacesRef, "P1"), {
      name: "P11", state: "P12", country: "P13"
    });
    await setDoc(doc(subColPlacesRef, "P2"), {
      name: "P21", state: "P22", country: "P23"
    });
  });

  it('should create correct document reference for SF/places/P1', function () {
    subDocColPlacesRef = doc(subColPlacesRef, "P1");
    expect(subDocColPlacesRef).to.exist;
    expect(subDocColPlacesRef.oracledb).to.exist;
    expect(subDocColPlacesRef.oracledb.app.name).to.equal("test");
    expect(subDocColPlacesRef.id).to.equal("P1");
    expect(subDocColPlacesRef.path).to.equal("city/SF/places/P1");
    expect(subDocColPlacesRef.parent.id).to.equal("places");
  });

  it('should verify QuerySnapshot from city collection', async function () {
    const res7 = await getDocs(collection(getOracledb(), "city"));
    expect(res7.docs).to.exist;
    expect(res7.empty).to.be.false;
    expect(res7.query).to.exist;
    expect(res7.query.id).to.equal("city");
    expect(res7.metadata).to.exist;
    expect(res7.size).to.be.greaterThan(0);
  });

  it('should iterate through QuerySnapshot documents', async function () {
    const res7 = await getDocs(collection(getOracledb(), "city"));
    res7.forEach(res => {
      expect(res.exists()).to.be.true;
      expect(res.id).to.exist;
      expect(res.metadata).to.exist;
      expect(res.ref).to.exist;
      expect(res).to.exist;
      expect(res.data).to.exist;
    });
  });

  it('should limit results with limitToLast', async function () {
    const res8 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population", "desc"), limit(3)));
    expect(res8._docs.length).to.equal(3);
  });

  it('should return correct result for startAt', async function () {
    const res9 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(860000)));
    expect(res9._docs[0].data().population).to.equal(860000);
  });

  it('should return correct result for startAfter', async function () {
    const res10 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAfter(860000)));
    expect(res10._docs[0].data().population).to.be.greaterThan(860000);
  });

  it('should return correct result for endAt', async function () {
    const res11 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endAt(860000)));
    expect(res11._docs[res11._docs.length - 1].data().population).to.equal(860000);
  });

  it('should return correct result for endBefore', async function () {
    const res12 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endBefore(860000)));
    expect(res12._docs[res12._docs.length - 1].data().population).to.be.lessThan(860000);
  });

  it('should work with startAt and FieldPath', async function () {
    const res13 = await getDocs(query(collection(getOracledb(), "city"), orderBy(new FieldPath("population")), startAt(860000)));
    expect(res13._docs[0].data().population).to.equal(860000);
  });

  it('should work with where and FieldPath', async function () {
    const res14 = await getDocs(query(collection(getOracledb(), "city"), where(new FieldPath("capital"), "==", true)));
    expect(res14).to.exist;
    expect(res14._docs).to.exist;
    expect(res14.query).to.exist;
    expect(res14._docs[0].data()).to.exist;
  });

  it('should verify FieldPath properties', function () {
    fd1 = new FieldPath("population");
    expect(fd1.fullPath).to.equal("population");
    expect(FieldPath.documentId().fullPath).to.equal("OID");
    const fd2 = new FieldPath("population", "place1");
    expect(fd2.fullPath).to.equal("population.place1");
  });

  it('should work with startAt using DocumentSnapshot', async function () {
    const res9 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(860000)));
    const res15 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(res9.docs[0])));
    expect(res15._docs[0].data().population).to.equal(860000);
  });

  it('should work with startAfter using DocumentSnapshot', async function () {
    const res16 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAfter(860000)));
    expect(res16._docs[0].data().population).to.be.greaterThan(860000);
  });

  it('should work with endAt using DocumentSnapshot', async function () {
    const res17 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endAt(860000)));
    expect(res17._docs[res17._docs.length - 1].data().population).to.equal(860000);
  });

  it('should work with endBefore using DocumentSnapshot', async function () {
    const res18 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endBefore(860000)));
    expect(res18._docs[res18._docs.length - 1].data().population).to.be.lessThan(860000);
  });

  it('should update document population', async function () {
    await updateDoc(docRef, { population: 800000 });
    const res19 = await getDoc(docRef);
    expect(res19.data().population).to.equal(800000);
    expect(res19.data()).to.exist;
    expect(res19.ref).to.exist;
    expect(res19.ref.id).to.equal('SF');
  });

  it('should update document population using FieldPath', async function () {
    fd1 = new FieldPath("population");
    await updateDoc(docRef, { [fd1]: 810000 });
    const res20 = await getDoc(docRef);
    expect(res20.data().population).to.equal(810000);
    expect(res20.data()).to.exist;
    expect(res20.ref).to.exist;
    expect(res20.ref.id).to.equal('SF');
    expect(res20.get(fd1)).to.equal(810000);
  });

  it("should update a field with a dot in its name using FieldPath", async () => {
    await setDoc(doc(db, cityCol, docId), initialData);
    const mayorNamePath = new FieldPath("mayor.name");

    await updateDoc(doc(db, cityCol, docId), {
        [mayorNamePath]: "Jane Smith"
    });

    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data()["mayor.name"]).to.equal("Jane Smith");
  });

  it("should set nested document", async () => {
    docRef1 = doc(db, "pl", "alice");
    await setDoc(docRef1, {
      profile: {
        name: "Alice",
        stats: { age: 30, score: 10 },
        hobbies: ["reading", "chess"],
      },
      nestedJson: {
        level1: {
          level2: {
            deepKey: "original",
            anotherKey: 123,
          },
        },
      },
      lastLogin: Timestamp.now(),
    });
  });

  it("should update nested field using FieldPath", async () => {
    const fieldPath = new FieldPath("profile", "stats", "score");
    await updateDoc(docRef1, { [fieldPath]: 42 });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.score).to.equal(42);
  });

  it("should increment numeric field with FieldValue.increment", async () => {
    await updateDoc(docRef1, {
      "profile.stats.age": increment(5),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.age).to.equal(35);
  });

  it("should add new items to an array with FieldValue.arrayUnion", async () => {
    await updateDoc(docRef1, {
      "profile.hobbies": arrayUnion("coding", "travel"),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.hobbies).to.include.members([
      "reading",
      "chess",
      "coding",
      "travel",
    ]);
  });

  it("should remove items from an array with FieldValue.arrayRemove", async () => {
    await updateDoc(docRef1, {
      "profile.hobbies": arrayRemove("chess"),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.hobbies).to.not.include("chess");
  });

  it("should delete a nested field with FieldValue.delete", async () => {
    await updateDoc(docRef1, {
      "profile.stats.score": deleteField(),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats).to.not.have.property("score");
  });

  it("should combine multiple operations in a single update", async () => {
    await updateDoc(docRef1, {
      "profile.newField": "test",
      "profile.stats.age": increment(-10),
      "profile.hobbies": arrayUnion("gaming")
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.age).to.equal(25);
    expect(snapshot.data().profile.hobbies).to.include("gaming");
    expect(snapshot.data().profile.newField).to.equal("test");
  });

  // it("should update using a FieldPath with special characters", async () => {
  //   const weirdFieldRef = doc(db, "pl", "settings");
  //   await setDoc(weirdFieldRef, {
  //     "key.with.dot": { enabled: true },
  //   });

  //   const path = new FieldPath("key.with.dot", "enabled");
  //   await updateDoc(weirdFieldRef, { [path]: false });

  //   const snapshot = await getDoc(weirdFieldRef);
  //   expect(snapshot.data()["key.with.dot"].enabled).to.equal(false);
  // });

  //
  // EXTRA: Nested JSON FieldPath Tests
  //
  it("should update a deeply nested JSON key using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "deepKey");
    await updateDoc(docRef1, { [fieldPath]: "updatedValue" });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2.deepKey).to.equal("updatedValue");
  });

  it("should increment numeric value in deeply nested JSON using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "anotherKey");
    await updateDoc(docRef1, { [fieldPath]: increment(10) });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2.anotherKey).to.equal(133);
  });

  it("should delete a deeply nested key using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "deepKey");
    await updateDoc(docRef1, { [fieldPath]: deleteField() });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2).to.not.have.property("deepKey");
  });

  it("should update a deeply nested field using FieldPath", async () => {
    await setDoc(doc(db, cityCol, docId), initialData);
    const areaPath = new FieldPath("stats", "metrics", "area_km2");

    // update the nested field
    await updateDoc(doc(db, cityCol, docId), {
        [areaPath]: 500
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.metrics.area_km2).to.equal(500);
  });

  it("should delete a deeply nested field using FieldPath + FieldValue.delete", async () => {
    const foundedPath = new FieldPath("stats", "founded");

    // delete the field
    await updateDoc(doc(db, cityCol, docId), {
    [foundedPath]: deleteField()
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats).to.not.have.property("founded");
  });

  //FieldValue
  it("should increment population using FieldValue.increment", async () => {
    await updateDoc(doc(db, cityCol, docId), {
        population: increment(50000)
    });

    // read the document
    const docSnap  = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().population).to.equal(550000);
  });

  it("should add new nickname using FieldValue.arrayUnion", async () => {
    const nicknamesPath = new FieldPath("stats", "nicknames");

    // update using arrayUnion
    await updateDoc(doc(db, cityCol, docId), {
    [nicknamesPath]: arrayUnion("City of Lights")
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.nicknames).to.include("City of Lights");
  });

  it("should remove a nickname using FieldValue.arrayRemove", async () => {
    const nicknamesPath = new FieldPath("stats", "nicknames");

    // update using arrayRemove
    await updateDoc(doc(db, cityCol, docId), {
    [nicknamesPath]: arrayRemove("Big City")
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.nicknames).to.not.include("Big City");
  });

  //relational
  it("relational: should create a document", async () => {
    // add the document
    let res = await addDoc(collection(db, collectionName), testDocData);
    testDocId = res.id;

    // get the document back
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data()).to.deep.equal(testDocData);
  });

  it("relational: should read a document", async () => {
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data()).to.have.property("name", "Alice");
  });

  it("relational: should update a document", async () => {
    await updateDoc(doc(db, collectionName, testDocId), { age: 31 });
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(31);
  });

  it("relational: should increment age using FieldValue.increment", async () => {
    await updateDoc(doc(db, collectionName, testDocId), {
        age: increment(1),
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(32);
  });

  it("relational: should store a custom Timestamp and retrieve it correctly", async () => {
    const customTimestamp = Timestamp.fromDate(new Date("2025-01-01T00:00:00Z"));

    // update the document with the timestamp
    await updateDoc(doc(db, collectionName, testDocId), {
    about: customTimestamp,
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    const ts = docSnap.data().about;
    expect(ts).to.be.instanceof(Timestamp);
    expect(ts.toDate().toISOString()).to.equal("2025-01-01T00:00:00.000Z");
  });

  it("relational: should safely update age using a transaction", async () => {
    await runTransaction(db, async (transaction) => {
    const ref = doc(db, collectionName, testDocId);

    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw "Document does not exist";

    const newAge = 35;
    transaction.update(ref, { age: newAge });
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(35);
  });

  it("relational: should update about and reset age in a batch", async () => {
    const batch = writeBatch(db);

    // document reference
    const userRef = doc(db, collectionName, testDocId);

    // add update to the batch
    batch.update(userRef, { about: "Graduated", age: 30 });

    // commit the batch
    await batch.commit();

    // get the document
    const userDoc = await getDoc(doc(db, collectionName, testDocId));
    expect(userDoc.data().about).to.equal("Graduated");
    expect(userDoc.data().age).to.equal(30);
  });

  it("relational: should delete a document", async () => {
    await deleteDoc(doc(db, collectionName, testDocId));

    // get the (now deleted) document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.false;
  });

  it('relational: setdoc with merge', async () => {
    let setMergeRes = await addDoc(collection(db, collectionName), initialData1);
    testDocId1 = setMergeRes.id;
    await setDoc(setMergeRes, {
        age:1
    }, {merge:true});
    let docSnap = await getDoc(setMergeRes);
    expect(docSnap).to.exist;
    expect(docSnap.data().age).to.equal(1);
  });

  //joins
  it("joins: should fetch", async () => {
    const q = query(collection(db,""),join("TEST_1"));
    let resJoins = await getDocs(q);
    expect(resJoins.empty).to.be.false;
  });

  //duality view
  let testColRef;
  let testDocRef = null;
  let testDocRefId = null;
  let data = {
    "_id": 28,
    "departmentName": "DBAl",
    "location": "ww",
    "employees": [{ "employeeNumber": 12, "employeeName": "P32RATIK", "job": "CLERK", "salary": 12 }]
  }

  it("duality view: should create a document", async () => {
    // insert test data
    testColRef = dualityViewCollection(db, "department_dv")
    let res = await addDoc(testColRef, data);
    testDocRefId = res.id;
    testDocRef = dualityViewDoc(db, "department_dv/" + testDocRefId);
  });

  it("duality view: should read collection docs", async () => {
    const querySnapshot = await getDocs(testColRef);
  });

  it("duality view: should read a document", async () => {
    // read a document
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data().employees[0].employeeName).to.equal(data.employees[0].employeeName);
    expect(docSnap.data().employees[0].employeeNumber).to.equal(data.employees[0].employeeNumber);
    expect(docSnap.data().employees[0].job).to.equal(data.employees[0].job);
    expect(docSnap.data().employees[0].salary).to.equal(data.employees[0].salary);
  });

  it("duality view: should update a document", async () => {
    await updateDoc(testDocRef, { departmentName: "Chirag" });
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.data().departmentName).to.equal("Chirag");
  });

  it("duality view: should delete a document", async () => {
    await deleteDoc(testDocRef);
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.exists()).to.be.false;
  });

  after(async () => {
    await deleteDoc(doc(db, "city", "SF"));
    await deleteDoc(doc(db, "city", "TEST_LA"));
    await deleteDoc(doc(db, "city", "TOK"));
    await deleteDoc(doc(db, "city", "TEST_LA1"));
    await deleteDoc(doc(db, "city", "TRANS_TEST2"));
    await deleteDoc(doc(db, "pl", "surat"));
    await deleteDoc(doc(db, collectionName, testDocId1));
    await deleteDoc(doc(db, cityCol, docId));
    if (subColPlacesRef) {
      await deleteDoc(doc(db, "city", "SF", "places", "P1"));
      await deleteDoc(doc(db, "city", "SF", "places", "P2"));
    }
    await deleteDoc(doc(db, "city", "UPDATE_TEST"));
  });
});

describe('fusabase Integration Tests for version 2', function () {
  this.timeout(30000);

  const options = {}

  let app, db, cityRef, cityRef1, subColPlacesRef, fd1, docRef, docRef1, res9, subDocColPlacesRef;
  const collectionName = "Users";
  let testDocId;
  const testDocData = {
    "_id": 20050, "name": "Alice", "age": 30,
    "about": "Student"
  };

  const cityCol = "city";
  const cityCol1 = "pl";
  const docId = "city_001";
  const initialData = {
    name: "Metropolis",
    population: 500000,
    "mayor.name": "John Doe",
    stats: {
      founded: 1850,
      nicknames: ["Big City", "The Hub"],
      metrics: {
        area_km2: 450,
      }
    }
  };

  let testDocId1;
  const initialData1 = {
    "_id": 20051, "name": "Alice", "age": 30,
    "about": "Student"
  };
  

  it('should initialize the app', () => {
    app = initializeApp({...options,appCheckToken:"APP_CHECK_TOKEN"}, "test");
    expect(app.options.ordsHost, options.ords_host);
    expect(app.options.schema, options.schema);
    expect(app.options.appID, options.app_id);
    expect(app.options.objsType, options.objs_type);
    expect(app.options.storageBucket, options.storage_bucket);
    expect(app.options.authType, options.auth_type);
    expect(app.options.authID, options.auth_id);
  });

  it('should set log level', () => {
    setLogLevel(LogLevel.ERROR);
  });

  it('should initialize oracledb', () => {
    db = initializeOracledb(app);
    expect(db.app.options.ordsHost, options.ords_host);
    expect(db.app.options.schema, options.schema);
    expect(db.app.options.appID, options.app_id);
    expect(db.app.options.objsType, options.objs_type);
    expect(db.app.options.storageBucket, options.storage_bucket);
    expect(db.app.options.authType, options.auth_type);
    expect(db.app.options.authID, options.auth_id);
    expect(db.app.config.objsType, options.objs_type);
    expect(db.app.config.storageBucket, options.storage_bucket);
    expect(db.app.config.authType, options.auth_type);
    expect(db.app.config.authID, options.auth_id);
  });

  it('should get city collection reference', () => {
    cityRef = collection(db, "city");
    cityRef1 = collection(db, "pl");
    assert.ok(cityRef);
    assert.ok(cityRef.oracledb);
    expect(cityRef.oracledb.app.name, 'test');
    expect(cityRef.id, 'city');
    expect(cityRef.path, 'city');
    assert.ok(!cityRef.parent);
  });

  it('should add and delete document', async () => {
    const resAddDoc = await collection(db, "city").add({
      name: 'Udaipur',
      country: 'India',
      state: 'Rajasthan',
      capital: false,
      population: 200000,
      regions: ['Mevar'],
    });
    await resAddDoc.delete();
  });

  it('should set multiple docs in city', async () => {
    await setDoc(doc(cityRef, "SF"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 860000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TEST_LA"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 10000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TEST_LA1"), {
      name: 'San Francisco',
      state: 'CA',
      country: 'USA',
      capital: false,
      population: 10000,
      regions: ['west_coast', 'norcal'],
    });
    await setDoc(doc(cityRef, "TOK"), {
      name: 'Tokyo',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
  });

  it('should update a doc', async () => {
    await setDoc(doc(cityRef, "UPDATE_TEST"), {
      name: 'UPDATE_TEST',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
    await updateDoc(doc(cityRef, "UPDATE_TEST"), { population: 1000000 });
  });

  it('setdoc with merge', async () => {
    await setDoc(doc(cityRef1, "surat"), {
      name: 'UPDATE_TEST',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000
    });

    await setDoc(doc(cityRef1, "surat"), {
        population:1
    }, {merge:true});

    let docSnap = await getDoc(doc(cityRef1, "surat"));
    expect(docSnap).to.exist;
    expect(docSnap.data().population).to.equal(1);
  });

  it('should get on query level', async () => {
    const resdoc = await getDocs(collection(getOracledb(), "city"));
    assert.ok(resdoc);
  });

  it('should run a transaction', async () => {
    await setDoc(doc(cityRef, "TRANS_TEST2"), {
      name: 'Tokyo',
      state: null,
      country: 'Japan',
      capital: true,
      population: 9000000,
      regions: ['kanto', 'honshu'],
    });
    const sfDocRef = doc(cityRef, "TRANS_TEST2");
    const transRes1 = await runTransaction(db, (transaction) =>
      transaction.get(sfDocRef).then((sfDoc) => {
        assert.ok(sfDoc.exists());
        transaction.update(sfDocRef, { population: 123453 });
        return 123453;
      })
    );
    expect(transRes1, 123453);
  });

  it('should execute WriteBatch', async () => {
    const batch = writeBatch(db);
    const nycRef = doc(cityRef, "BATCH_TEST");;
    batch.set(nycRef, { name: 'New York City' });
    batch.update(nycRef, { population: 11000 });
    batch.delete(nycRef);
    await batch.commit();
    expect(1, 1);
  });

  it('collection group', async () => {
    const nycRef = collectionGroup(db, 'comments');
    const res = await getDocs(nycRef);
    expect(res).to.exist;
    expect(res._docs).to.exist;
    expect(res.query).to.exist;
  });

  it('should get count', async () => {
    const ares1 = await getCountFromServer(cityRef);
    expect(ares1.data().count, 6);
    const ares2 = await getCountFromServer(query(cityRef, orderBy("population")));
    expect(ares2.data().count, 6);
  });

  it('should run aggregate', async () => {
    const ares3 = await getAggregateFromServer(cityRef, {
        totalPopulation: sum('population'),
    });
    expect(ares3.data().totalPopulation).to.equal(11003453);
  });

  it('should aggregate total and final population ordered by population', async function () {
    const ares4 = await getAggregateFromServer(query(cityRef, orderBy("population")), {
        totalPopulation: sum('population'),
        finalPopulation: sum('population')
    });
    expect(ares4.data().totalPopulation).to.equal(11003453);
  });

  it('should get documents from city collection', async function () {
    const res1 = await getDocs(collection(db, "city"));
    expect(res1).to.exist;
    expect(res1._docs).to.exist;
    expect(res1.query).to.exist;
    expect(res1._docs[0].data()).to.exist;
  });

  it('should get documents from city collection with where ==', async function () {
    const res2 = await getDocs(query(collection(db, "city"), where("capital", "==", true)));
    expect(res2).to.exist;
    expect(res2._docs).to.exist;
    expect(res2.query).to.exist;
    expect(res2._docs[0].data()).to.exist;
  });

  it("should get documents from city collection with where >=", async function () {
    const q = query(collection(db, "city"), where("population", ">=", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where <=", async function () {
    const q = query(collection(db, "city"), where("population", "<=", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where >", async function () {
    const q = query(collection(db, "city"), where("population", ">", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where <", async function () {
    const q = query(collection(db, "city"), where("population", "<", 200000));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where in", async function () {
    const q = query(collection(db, "city"), where("country", "in", ["USA"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where not-in", async function () {
    const q = query(collection(db, "city"), where("country", "not-in", ["USA"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where !=", async function () {
    const q = query(collection(db, "city"), where("country", "!=", "USA"));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where array-contains", async function () {
    const q = query(collection(db, "city"), where("regions", "array-contains", "west_coast"));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(3);
  });

  it("should get documents from city collection with where array-contains-any", async function () {
    const q = query(collection(db, "city"), where("regions", "array-contains-any", ["west_coast","honshu"]));
    const res2 = await getDocs(q);
    expect(res2).to.exist;
    expect(res2.docs).to.exist;
    expect(q).to.exist;
    expect(res2.docs.length).to.equal(6);
  });

  it('should get documents from city collection with orderBy', async function () {
    const res3 = await getDocs(query(collection(db, "city"), orderBy("name", "desc")));
    expect(res3).to.exist;
    expect(res3._docs).to.exist;
    expect(res3.query).to.exist;
    expect(res3._docs[0].data()).to.exist;
  });

  it('should get documents from city collection with limit', async function () {
    const res4 = await getDocs(query(collection(db, "city"), limit(1)));
    expect(res4).to.exist;
    expect(res4._docs).to.exist;
    expect(res4.query).to.exist;
    expect(res4._docs.length).to.equal(1);
    expect(res4._docs[0].data()).to.exist;
  });

  it('should delete document TEMP from city collection', async function () {
    await setDoc(doc(getOracledb(), "city", "TEMP"), {
      name: "San Francisco", state: "CA", country: "USA",
      capital: false, population: 860000,
      regions: ["west_coast", "norcal"]
    });
    await deleteDoc(doc(getOracledb(), "city", "TEMP"));
  });

  it('should create correct document reference for SF', function () {
    docRef = doc(getOracledb(), "city", "SF");
    expect(docRef).to.exist;
    expect(docRef.oracledb).to.exist;
    expect(docRef.oracledb.app.name).to.equal("test");
    expect(docRef.id).to.equal("SF");
    expect(docRef.path).to.equal("city/SF");
    expect(docRef.parent.id).to.equal("city");
  });

  it('should get document data from SF docRef', async function () {
    const res5 = await getDoc(docRef);
    expect(res5.data()).to.exist;
    expect(res5.ref).to.exist;
    expect(res5.ref.id).to.equal('SF');
  });

  it('should create correct subcollection reference for SF/places', function () {
    subColPlacesRef = collection(doc(getOracledb(), "city", "SF"), "places");
    expect(subColPlacesRef).to.exist;
    expect(subColPlacesRef.oracledb).to.exist;
    expect(subColPlacesRef.oracledb.app.name).to.equal("test");
    expect(subColPlacesRef.id).to.equal("places");
    expect(subColPlacesRef.path).to.equal("city/SF/places");
    expect(subColPlacesRef.parent.id).to.equal("SF");
  });

  it('should set documents in SF/places subcollection', async function () {
    await setDoc(doc(subColPlacesRef, "P1"), {
      name: "P11", state: "P12", country: "P13"
    });
    await setDoc(doc(subColPlacesRef, "P2"), {
      name: "P21", state: "P22", country: "P23"
    });
  });

  it('should create correct document reference for SF/places/P1', function () {
    subDocColPlacesRef = doc(subColPlacesRef, "P1");
    expect(subDocColPlacesRef).to.exist;
    expect(subDocColPlacesRef.oracledb).to.exist;
    expect(subDocColPlacesRef.oracledb.app.name).to.equal("test");
    expect(subDocColPlacesRef.id).to.equal("P1");
    expect(subDocColPlacesRef.path).to.equal("city/SF/places/P1");
    expect(subDocColPlacesRef.parent.id).to.equal("places");
  });

  it('should verify QuerySnapshot from city collection', async function () {
    const res7 = await getDocs(collection(getOracledb(), "city"));
    expect(res7.docs).to.exist;
    expect(res7.empty).to.be.false;
    expect(res7.query).to.exist;
    expect(res7.query.id).to.equal("city");
    expect(res7.metadata).to.exist;
    expect(res7.size).to.be.greaterThan(0);
  });

  it('should iterate through QuerySnapshot documents', async function () {
    const res7 = await getDocs(collection(getOracledb(), "city"));
    res7.forEach(res => {
      expect(res.exists()).to.be.true;
      expect(res.id).to.exist;
      expect(res.metadata).to.exist;
      expect(res.ref).to.exist;
      expect(res).to.exist;
      expect(res.data).to.exist;
    });
  });

  it('should limit results with limitToLast', async function () {
    const res8 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population", "desc"), limit(3)));
    expect(res8._docs.length).to.equal(3);
  });

  it('should return correct result for startAt', async function () {
    const res9 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(860000)));
    expect(res9._docs[0].data().population).to.equal(860000);
  });

  it('should return correct result for startAfter', async function () {
    const res10 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAfter(860000)));
    expect(res10._docs[0].data().population).to.be.greaterThan(860000);
  });

  it('should return correct result for endAt', async function () {
    const res11 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endAt(860000)));
    expect(res11._docs[res11._docs.length - 1].data().population).to.equal(860000);
  });

  it('should return correct result for endBefore', async function () {
    const res12 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endBefore(860000)));
    expect(res12._docs[res12._docs.length - 1].data().population).to.be.lessThan(860000);
  });

  it('should work with startAt and FieldPath', async function () {
    const res13 = await getDocs(query(collection(getOracledb(), "city"), orderBy(new FieldPath("population")), startAt(860000)));
    expect(res13._docs[0].data().population).to.equal(860000);
  });

  it('should work with where and FieldPath', async function () {
    const res14 = await getDocs(query(collection(getOracledb(), "city"), where(new FieldPath("capital"), "==", true)));
    expect(res14).to.exist;
    expect(res14._docs).to.exist;
    expect(res14.query).to.exist;
    expect(res14._docs[0].data()).to.exist;
  });

  it('should verify FieldPath properties', function () {
    fd1 = new FieldPath("population");
    expect(fd1.fullPath).to.equal("population");
    expect(FieldPath.documentId().fullPath).to.equal("OID");
    const fd2 = new FieldPath("population", "place1");
    expect(fd2.fullPath).to.equal("population.place1");
  });

  it('should work with startAt using DocumentSnapshot', async function () {
    const res9 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(860000)));
    const res15 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAt(res9.docs[0])));
    expect(res15._docs[0].data().population).to.equal(860000);
  });

  it('should work with startAfter using DocumentSnapshot', async function () {
    const res16 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), startAfter(860000)));
    expect(res16._docs[0].data().population).to.be.greaterThan(860000);
  });

  it('should work with endAt using DocumentSnapshot', async function () {
    const res17 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endAt(860000)));
    expect(res17._docs[res17._docs.length - 1].data().population).to.equal(860000);
  });

  it('should work with endBefore using DocumentSnapshot', async function () {
    const res18 = await getDocs(query(collection(getOracledb(), "city"), orderBy("population"), endBefore(860000)));
    expect(res18._docs[res18._docs.length - 1].data().population).to.be.lessThan(860000);
  });

  it('should update document population', async function () {
    await updateDoc(docRef, { population: 800000 });
    const res19 = await getDoc(docRef);
    expect(res19.data().population).to.equal(800000);
    expect(res19.data()).to.exist;
    expect(res19.ref).to.exist;
    expect(res19.ref.id).to.equal('SF');
  });

  it('should update document population using FieldPath', async function () {
    fd1 = new FieldPath("population");
    await updateDoc(docRef, { [fd1]: 810000 });
    const res20 = await getDoc(docRef);
    expect(res20.data().population).to.equal(810000);
    expect(res20.data()).to.exist;
    expect(res20.ref).to.exist;
    expect(res20.ref.id).to.equal('SF');
    expect(res20.get(fd1)).to.equal(810000);
  });

  it("should update a field with a dot in its name using FieldPath", async () => {
    await setDoc(doc(db, cityCol, docId), initialData);
    const mayorNamePath = new FieldPath("mayor.name");

    await updateDoc(doc(db, cityCol, docId), {
      [mayorNamePath]: "Jane Smith"
    });

    const snapshot = await getDoc(doc(db, cityCol, docId));
    expect(snapshot.data()["mayor.name"]).to.equal("Jane Smith");
  });

  it("should set nested document", async () => {
    docRef1 = doc(db, "pl", "alice");
    await setDoc(docRef1, {
      profile: {
        name: "Alice",
        stats: { age: 30, score: 10 },
        hobbies: ["reading", "chess"],
      },
      nestedJson: {
        level1: {
          level2: {
            deepKey: "original",
            anotherKey: 123,
          },
        },
      },
      lastLogin: Timestamp.now(),
    });
  });

  it("should update nested field using FieldPath", async () => {
    const fieldPath = new FieldPath("profile", "stats", "score");
    await updateDoc(docRef1, { [fieldPath]: 42 });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.score).to.equal(42);
  });

  it("should increment numeric field with FieldValue.increment", async () => {
    await updateDoc(docRef1, {
      "profile.stats.age": increment(5),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.age).to.equal(35);
  });

  it("should add new items to an array with FieldValue.arrayUnion", async () => {
    await updateDoc(docRef1, {
      "profile.hobbies": arrayUnion("coding", "travel"),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.hobbies).to.include.members([
      "reading",
      "chess",
      "coding",
      "travel",
    ]);
  });

  it("should remove items from an array with FieldValue.arrayRemove", async () => {
    await updateDoc(docRef1, {
      "profile.hobbies": arrayRemove("chess"),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.hobbies).to.not.include("chess");
  });

  it("should delete a nested field with FieldValue.delete", async () => {
    await updateDoc(docRef1, {
      "profile.stats.score": deleteField(),
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats).to.not.have.property("score");
  });

  it("should combine multiple operations in a single update", async () => {
    await updateDoc(docRef1, {
      "profile.newField": "test",
      "profile.stats.age": increment(-10),
      "profile.hobbies": arrayUnion("gaming")
    });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().profile.stats.age).to.equal(25);
    expect(snapshot.data().profile.hobbies).to.include("gaming");
    expect(snapshot.data().profile.newField).to.equal("test");
  });

  // it("should update using a FieldPath with special characters", async () => {
  //   const weirdFieldRef = doc(db, "pl", "settings");
  //   await setDoc(weirdFieldRef, {
  //     "key.with.dot": { enabled: true },
  //   });

  //   const path = new FieldPath("key.with.dot", "enabled");
  //   await updateDoc(weirdFieldRef, { [path]: false });

  //   const snapshot = await getDoc(weirdFieldRef);
  //   expect(snapshot.data()["key.with.dot"].enabled).to.equal(false);
  // });

  //
  // EXTRA: Nested JSON FieldPath Tests
  //
  it("should update a deeply nested JSON key using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "deepKey");
    await updateDoc(docRef1, { [fieldPath]: "updatedValue" });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2.deepKey).to.equal("updatedValue");
  });

  it("should increment numeric value in deeply nested JSON using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "anotherKey");
    await updateDoc(docRef1, { [fieldPath]: increment(10) });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2.anotherKey).to.equal(133);
  });

  it("should delete a deeply nested key using FieldPath", async () => {
    const fieldPath = new FieldPath("nestedJson", "level1", "level2", "deepKey");
    await updateDoc(docRef1, { [fieldPath]: deleteField() });

    const snapshot = await getDoc(docRef1);
    expect(snapshot.data().nestedJson.level1.level2).to.not.have.property("deepKey");
  });

  it("should update a deeply nested field using FieldPath", async () => {
    await setDoc(doc(db, cityCol, docId), initialData);
    const areaPath = new FieldPath("stats", "metrics", "area_km2");

    // update the nested field
    await updateDoc(doc(db, cityCol, docId), {
        [areaPath]: 500
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.metrics.area_km2).to.equal(500);
  });

  it("should delete a deeply nested field using FieldPath + FieldValue.delete", async () => {
    const foundedPath = new FieldPath("stats", "founded");

    // delete the field
    await updateDoc(doc(db, cityCol, docId), {
    [foundedPath]: deleteField()
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats).to.not.have.property("founded");
  });

  //FieldValue
  it("should increment population using FieldValue.increment", async () => {
    await updateDoc(doc(db, cityCol, docId), {
        population: increment(50000)
    });

    // read the document
    const docSnap  = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().population).to.equal(550000);
  });

  it("should set field with FieldValue.serverTimestamp", async () => {
    await updateDoc(doc(db, cityCol, docId), {
        name: serverTimestamp(),
    });

    const snapshot = await getDoc(doc(db, cityCol, docId));
    const data = snapshot.data();

    expect(data.name).to.be.instanceof(Timestamp);
  });

  it("should add new nickname using FieldValue.arrayUnion", async () => {
    const nicknamesPath = new FieldPath("stats", "nicknames");

    // update using arrayUnion
    await updateDoc(doc(db, cityCol, docId), {
    [nicknamesPath]: arrayUnion("City of Lights")
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.nicknames).to.include("City of Lights");
  });

  it("should remove a nickname using FieldValue.arrayRemove", async () => {
    const nicknamesPath = new FieldPath("stats", "nicknames");

    // update using arrayRemove
    await updateDoc(doc(db, cityCol, docId), {
    [nicknamesPath]: arrayRemove("Big City")
    });

    // read the document
    const docSnap = await getDoc(doc(db, cityCol, docId));
    expect(docSnap.data().stats.nicknames).to.not.include("Big City");
  });

  //joins
  it("joins: should fetch", async () => {
    const q = query(collection(db,""),join("TEST_1"));
    let resJoins = await getDocs(q);
    expect(resJoins.empty).to.be.false;
  });

  //relational
  it("relational: should create a document", async () => {
    // add the document
    let res = await addDoc(collection(db, collectionName), testDocData);
    testDocId = res.id;

    // get the document back
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data()).to.deep.equal(testDocData);
  });

  it("relational: should read a document", async () => {
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data()).to.have.property("name", "Alice");
  });

  it("relational: should update a document", async () => {
    await updateDoc(doc(db, collectionName, testDocId), { age: 31 });
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(31);
  });

  it("relational: should increment age using FieldValue.increment", async () => {
    await updateDoc(doc(db, collectionName, testDocId), {
        age: increment(1),
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(32);
  });

  it("relational: should store a custom Timestamp and retrieve it correctly", async () => {
    const customTimestamp = Timestamp.fromDate(new Date("2025-01-01T00:00:00Z"));

    // update the document with the timestamp
    await updateDoc(doc(db, collectionName, testDocId), {
    about: customTimestamp,
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    const ts = docSnap.data().about;
    expect(ts).to.be.instanceof(Timestamp);
    expect(ts.toDate().toISOString()).to.equal("2025-01-01T00:00:00.000Z");
  });

  it("relational: should safely update age using a transaction", async () => {
    await runTransaction(db, async (transaction) => {
    const ref = doc(db, collectionName, testDocId);

    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw "Document does not exist";

    const newAge = 35;
    transaction.update(ref, { age: newAge });
    });

    // get the document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.data().age).to.equal(35);
  });

  it("relational: should update about and reset age in a batch", async () => {
    const batch = writeBatch(db);

    // document reference
    const userRef = doc(db, collectionName, testDocId);

    // add update to the batch
    batch.update(userRef, { about: "Graduated", age: 30 });

    // commit the batch
    await batch.commit();

    // get the document
    const userDoc = await getDoc(doc(db, collectionName, testDocId));
    expect(userDoc.data().about).to.equal("Graduated");
    expect(userDoc.data().age).to.equal(30);
  });

  it("relational: should delete a document", async () => {
    await deleteDoc(doc(db, collectionName, testDocId));

    // get the (now deleted) document
    const docSnap = await getDoc(doc(db, collectionName, testDocId));
    expect(docSnap.exists()).to.be.false;
  });

  it('relational: setdoc with merge', async () => {
    let setMergeRes = await addDoc(collection(db, collectionName), initialData1);
    testDocId1 = setMergeRes.id;
    await setDoc(setMergeRes, {
        age:1
    }, {merge:true});
    let docSnap = await getDoc(setMergeRes);
    expect(docSnap).to.exist;
    expect(docSnap.data().age).to.equal(1);
  });

  //duality view
  let testColRef;
  let testDocRef = null;
  let testDocRefId = null;
  let data = {
    "_id": 28,
    "departmentName": "DBAl",
    "location": "ww",
    "employees": [{ "employeeNumber": 12, "employeeName": "P32RATIK", "job": "CLERK", "salary": 12 }]
  }

  it("duality view: should create a document", async () => {
    // insert test data
    testColRef = dualityViewCollection(db, "department_dv")
    let res = await addDoc(testColRef, data);
    testDocRefId = res.id;
    testDocRef = dualityViewDoc(db, "department_dv/" + testDocRefId);
  });

  it("duality view: should read collection docs", async () => {
    const querySnapshot = await getDocs(testColRef);
  });

  it("duality view: should read a document", async () => {
    // read a document
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.exists()).to.be.true;
    expect(docSnap.data().employees[0].employeeName).to.equal(data.employees[0].employeeName);
    expect(docSnap.data().employees[0].employeeNumber).to.equal(data.employees[0].employeeNumber);
    expect(docSnap.data().employees[0].job).to.equal(data.employees[0].job);
    expect(docSnap.data().employees[0].salary).to.equal(data.employees[0].salary);
  });

  it("duality view: should update a document", async () => {
    await updateDoc(testDocRef, { departmentName: "Chirag" });
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.data().departmentName).to.equal("Chirag");
  });

  it("duality view: should delete a document", async () => {
    await deleteDoc(testDocRef);
    const docSnap = await getDoc(testDocRef);
    expect(docSnap.exists()).to.be.false;
  });

  after(async () => {
    await deleteDoc(doc(db, "city", "SF"));
    await deleteDoc(doc(db, "city", "TEST_LA"));
    await deleteDoc(doc(db, "city", "TOK"));
    await deleteDoc(doc(db, "city", "TEST_LA1"));
    await deleteDoc(doc(db, "city", "TRANS_TEST2"));
    await deleteDoc(doc(db, "pl", "surat"));
    await deleteDoc(doc(db, collectionName, testDocId1));
    await deleteDoc(doc(db, cityCol, docId));
    if (subColPlacesRef) {
      await deleteDoc(doc(db, "city", "SF", "places", "P1"));
      await deleteDoc(doc(db, "city", "SF", "places", "P2"));
    }
    await deleteDoc(doc(db, "city", "UPDATE_TEST"));
  });
});
