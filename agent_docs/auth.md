# Auth Module

Use `fusabase/auth` for user authentication, auth-state observation, token access, persistence, and account management.

## Primary Imports

```ts
import {
  EmailAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  IDCSAuthProvider,
  OAuthProvider,
  SAMLAuthProvider,
  browserLocalPersistence,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "fusabase/auth";
```

## Common Patterns

### Email and password

```ts
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword
} from "fusabase/auth";

const auth = getAuth(app);
await createUserWithEmailAndPassword(auth, email, password);
await signInWithEmailAndPassword(auth, email, password);
```

### Observe auth state

```ts
import { getAuth, onAuthStateChanged } from "fusabase/auth";

const auth = getAuth(app);
onAuthStateChanged(auth, (user) => {
  console.log(user?.email ?? "signed out");
});
```

### Provider sign-in

```ts
import { GoogleAuthProvider, getAuth, signInWithPopup } from "fusabase/auth";

const auth = getAuth(app);
await signInWithPopup(auth, new GoogleAuthProvider());
```

### Persistence

```ts
import {
  browserLocalPersistence,
  getAuth,
  setPersistence
} from "fusabase/auth";

const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
```

### IDCS sign-in

```ts
import { IDCSAuthProvider, getAuth, signInWithCredential } from "fusabase/auth";

const credential = IDCSAuthProvider.credential(idToken, accessToken);
await signInWithCredential(getAuth(app), credential);
```

### Generic OAuth (OIDC)

```ts
import { OAuthProvider, getAuth, signInWithCredential } from "fusabase/auth";

const provider = new OAuthProvider("oidc.my-provider");
const credential = OAuthProvider.credential(idToken, accessToken);
await signInWithCredential(getAuth(app), credential);
```

### SAML sign-in

```ts
import { SAMLAuthProvider, getAuth, signInWithCredential } from "fusabase/auth";

const provider = new SAMLAuthProvider("saml.my-provider");
const credential = SAMLAuthProvider.credential(samlAccessToken);
await signInWithCredential(getAuth(app), credential);
```

## Other Public Areas

- Password reset and verification helpers.
- `getIdToken` and `getIdTokenResult`.
- `updateProfile`, `updatePassword`, and `sendEmailVerification`.
- User-linking helpers such as `linkWithCredential`, `linkWithPopup`, and `linkWithRedirect`.

## Related Docs

- `agent_docs/ui.md`
- `agent_docs/app-trust.md`
