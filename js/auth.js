/*
  AUTH — Google Sign-In
  --------------------------------------
  TEMPORARILY using signInWithPopup as a diagnostic test, to isolate
  whether redirect's storage-correlation is the actual failure point.
  (Normally redirect is preferred for installed iOS PWAs — see the
  note below once we know popup actually works.)

  Restricted to one account (ALLOWED_UID), matching the mobile app's
  AuthRepository.kt exactly — anyone else who signs in is immediately
  signed back out with the same message.
*/

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { auth, ALLOWED_UID } from "./firebase-init.js";

const provider = new GoogleAuthProvider();

export function signIn() {
  signInWithPopup(auth, provider).catch((error) => {
    console.error("Sign-in popup error:", error);
  });
}

export function signOutUser() {
  return signOut(auth);
}

/**
 * Subscribes to sign-in state. callback receives (user, errorMessage) —
 * user is null if signed out (or rejected for being the wrong account),
 * in which case errorMessage explains why (or is null for a plain sign-out).
 */
export function watchAuthState(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user && user.uid !== ALLOWED_UID) {
      await signOut(auth);
      callback(null, "This app's cloud sync is only for the love of my life — but you're welcome to just browse.");
      return;
    }
    callback(user, null);
  });
}