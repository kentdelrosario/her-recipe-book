/*
  RECIPE DATA — LIVE FROM FIRESTORE
  -----------------------------------
  Live listener (onSnapshot) so adds/edits/deletes made while signed in
  appear immediately without a page refresh, and it keeps working offline
  via Firestore's built-in cache, matching the mobile app's offline sync.

  Exposes the FULL recipe set (including deleted, for Recently Deleted)
  via window.ALL_RECIPES, and hands the active set to app.js via
  window.initRecipeBook(). Scoped to the one account this whole PWA
  belongs to.
*/

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { db, ALLOWED_UID } from "./firebase-init.js";

function mapDocToRecipe(docSnap) {
  const data = docSnap.data();
  return {
    recipeId: docSnap.id,
    ownerUid: data.ownerUid || "",
    title: data.title || "Untitled recipe",
    description: data.description || "",
    category: data.category || "Uncategorised",
    cuisine: data.cuisine || "",
    difficulty: data.difficulty || "",
    cookingTimeMinutes: data.cookingTimeMinutes || 0,
    imageURL: data.imageURL || "",
    favourite: !!data.favourite,
    deleted: !!data.deleted,
    deletedAt: data.deletedAt || null,
    rating: data.rating || 0,
    createdAt: data.createdAt || 0,
    updatedAt: data.updatedAt || 0,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    instructions: Array.isArray(data.instructions) ? data.instructions : []
  };
}

const recipesRef = collection(db, "recipes");
const recipesQuery = query(recipesRef, where("ownerUid", "==", ALLOWED_UID));

onSnapshot(
  recipesQuery,
  (snapshot) => {
    const all = snapshot.docs.map(mapDocToRecipe);
    window.ALL_RECIPES = all;
    window.initRecipeBook(all.filter((r) => !r.deleted));
  },
  (error) => {
    console.error("Failed to load recipes:", error);
    window.ALL_RECIPES = [];
    window.initRecipeBook([]);
  }
);
