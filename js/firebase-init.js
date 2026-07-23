/*
  FIREBASE INIT — single shared source
  --------------------------------------
  Firebase's SDK throws if initializeApp() is called more than once with
  the same config, so every other module imports the shared app/db/auth/
  storage instances from here instead of initializing their own.
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBv9l5ctk9E8V-yrqvBZEhSKv_W906nrKs",
  authDomain: "her-recipe-book.firebaseapp.com",
  projectId: "her-recipe-book",
  storageBucket: "her-recipe-book.firebasestorage.app",
  messagingSenderId: "618471646625",
  appId: "1:618471646625:web:cae04e7b945cd0af6e17e0",
  measurementId: "G-GR3VKQ9QK3"
};

// The one account allowed to sign in and manage recipes — matches the
// same restriction (and the same UID) as the mobile app's AuthRepository.kt.
export const ALLOWED_UID = "o7XBkJmtnORaNiPOrU3dH441MuD2";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
