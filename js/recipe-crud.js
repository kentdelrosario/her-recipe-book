/*
  RECIPE CRUD — Firestore writes + Storage photo upload
  --------------------------------------------------------
  Mirrors the mobile app's RecipeRepository.kt: every write takes the full
  recipe object already in memory (never re-fetches first), and photo
  uploads go to the same recipe_photos/{uid}/{filename} path so the same
  Storage Security Rules apply here as on mobile.
*/

import {
  doc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { db, storage, ALLOWED_UID } from "./firebase-init.js";

const RECIPES_COLLECTION = "recipes";

function newRecipeId() {
  return `${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
}

/** Uploads a photo file to Storage and returns its public download URL. */
export async function uploadRecipePhoto(file) {
  const fileName = `${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}.jpg`;
  const photoRef = ref(storage, `recipe_photos/${ALLOWED_UID}/${fileName}`);
  await uploadBytes(photoRef, file);
  return getDownloadURL(photoRef);
}

export async function addRecipe(formData) {
  const now = Date.now();
  const id = newRecipeId();
  const recipe = {
    recipeId: id,
    ownerUid: ALLOWED_UID,
    title: formData.title || "",
    description: formData.description || "",
    category: formData.category || "",
    cuisine: formData.cuisine || "",
    difficulty: formData.difficulty || "",
    cookingTimeMinutes: formData.cookingTimeMinutes || 0,
    ingredients: formData.ingredients || [],
    instructions: formData.instructions || [],
    imageURL: formData.imageURL || "",
    favourite: false,
    deleted: false,
    deletedAt: null,
    rating: 0,
    createdAt: now,
    updatedAt: now
  };
  await setDoc(doc(db, RECIPES_COLLECTION, id), recipe);
  return recipe;
}

export async function updateRecipe(existingRecipe, formData) {
  const updated = {
    ...existingRecipe,
    title: formData.title || "",
    description: formData.description || "",
    category: formData.category || "",
    cuisine: formData.cuisine || "",
    difficulty: formData.difficulty || "",
    cookingTimeMinutes: formData.cookingTimeMinutes || 0,
    ingredients: formData.ingredients || [],
    instructions: formData.instructions || [],
    imageURL: formData.imageURL || existingRecipe.imageURL || "",
    updatedAt: Date.now()
  };
  await setDoc(doc(db, RECIPES_COLLECTION, existingRecipe.recipeId), updated);
  return updated;
}

export async function toggleFavourite(recipe) {
  const updated = { ...recipe, favourite: !recipe.favourite };
  await setDoc(doc(db, RECIPES_COLLECTION, recipe.recipeId), updated);
}

export async function updateRating(recipe, newRating) {
  const updated = { ...recipe, rating: newRating };
  await setDoc(doc(db, RECIPES_COLLECTION, recipe.recipeId), updated);
}

export async function softDeleteRecipe(recipe) {
  const updated = { ...recipe, deleted: true, deletedAt: Date.now() };
  await setDoc(doc(db, RECIPES_COLLECTION, recipe.recipeId), updated);
}

export async function restoreRecipe(recipe) {
  const updated = { ...recipe, deleted: false, deletedAt: null };
  await setDoc(doc(db, RECIPES_COLLECTION, recipe.recipeId), updated);
}

export async function permanentlyDeleteRecipe(recipe) {
  await deleteDoc(doc(db, RECIPES_COLLECTION, recipe.recipeId));
}
