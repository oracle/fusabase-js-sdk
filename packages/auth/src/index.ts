import { AuthError, ErrorCode } from "./errors.js";
import { beforeAuthStateChanged, getAuth, initializeAuth, setPersistence } from "./internal/core.js";
import { AuthCredential, EmailAuthCredential, SAMLAuthCredential, UserCredential } from "./internal/credential.js";
import { OAuthCredential } from "./internal/phone.js";
import { onIdTokenChanged } from "./internal/token.js";
import { EmailAuthProvider } from "./providers/email.js";
import { FacebookAuthProvider } from "./providers/facebook.js";
import { GithubAuthProvider } from "./providers/github.js";
import { IDCSAuthProvider } from "./providers/idcs.js";
import { GoogleAuthProvider } from "./providers/google.js";
import { OAuthProvider } from "./providers/oauth.js";
import { AuthProvider } from "./providers/provider.js";
import { SAMLAuthProvider } from "./providers/saml.js";
import { onAuthStateChanged } from "./public/common.js";
import { createUserWithEmailAndPassword } from "./public/email.js";
import { confirmPasswordReset, sendPasswordResetEmail, verifyPasswordResetCode } from "./public/password.js";
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signInWithCredential, signOut, updateCurrentUser } from "./public/strategies.js";
import { getRedirectResult } from "./public/token.js";
import { getIdToken, getIdTokenResult, reload, sendEmailVerification, updatePassword, updateProfile } from "./public/user.js";
import { Auth } from "./types/auth.js";
import { IdTokenResult } from "./types/idtoken.js";
import { browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from "./types/persistence.js";
import { Persistence } from "./types/persistence.js";
import { User, UserMetadata } from "./types/user.js";
import { Config, ONPREMConfig, IDCSConfig } from "./helpers/config.js";
import { linkWithCredential, linkWithRedirect, linkWithPopup, unlink } from "./public/user.js";

export {getAuth, initializeAuth, createUserWithEmailAndPassword,
signInWithCredential, signInWithPopup, signInWithRedirect, getRedirectResult,
signInWithEmailAndPassword, onAuthStateChanged, onIdTokenChanged,
setPersistence, sendPasswordResetEmail, verifyPasswordResetCode,
confirmPasswordReset, signOut, updateCurrentUser, getIdToken, getIdTokenResult,
reload, updatePassword, updateProfile, beforeAuthStateChanged,
sendEmailVerification, linkWithCredential, linkWithPopup, linkWithRedirect, unlink,
browserSessionPersistence, inMemoryPersistence, browserLocalPersistence};

export {User};
export type {UserMetadata};
export {Auth};
export {AuthProvider};
export {EmailAuthProvider};
export {GithubAuthProvider};
export {FacebookAuthProvider};
export {GoogleAuthProvider};
export {IDCSAuthProvider};
export {SAMLAuthProvider};
export {OAuthProvider};
export {SAMLAuthCredential};
export {AuthCredential};
export {EmailAuthCredential};
export {OAuthCredential};
export {UserCredential};
export {AuthError};
export {IdTokenResult};
export type {Persistence};
export { Config, ONPREMConfig, IDCSConfig }