/*
  RECIPE FORM — Add/Edit modal
  ------------------------------
  Builds the form UI in JS so the same code serves both "Add Recipe"
  (blank) and "Edit Recipe" (pre-filled). Dynamic ingredient/instruction
  rows mirror the mobile app's RecipeForm.kt.
*/

import { addRecipe, updateRecipe, uploadRecipePhoto } from "./recipe-crud.js";

const CATEGORY_OPTIONS = [
  "Breakfast", "Lunch", "Dinner", "Dessert",
  "Snacks", "Drinks", "Healthy", "Vegetarian", "Seafood"
];
const CUISINE_OPTIONS = [
  "Japanese", "Italian", "Filipino", "Mexican", "Chinese",
  "Thai", "Indian", "Korean", "Vietnamese", "French",
  "Greek", "Mediterranean", "American", "Spanish",
  "Middle Eastern", "Indonesian", "Malaysian", "Caribbean"
];
const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard"];

let overlayEl = null;
let pickedPhotoFile = null;
let onSavedCallback = null;

function ensureOverlay() {
  if (overlayEl) return overlayEl;

  overlayEl = document.createElement("div");
  overlayEl.className = "modal-overlay";
  overlayEl.id = "recipe-form-modal";
  overlayEl.innerHTML = `
    <div class="modal-panel" role="dialog" aria-modal="true" aria-label="Recipe form">
      <button type="button" class="modal-close" id="recipe-form-close" aria-label="Close">&times;</button>
      <div id="recipe-form-body"></div>
    </div>
  `;
  document.body.appendChild(overlayEl);

  overlayEl.querySelector("#recipe-form-close").addEventListener("click", closeForm);
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) closeForm();
  });

  return overlayEl;
}

function closeForm() {
  if (overlayEl) overlayEl.classList.remove("open");
  document.body.style.overflow = "";
  pickedPhotoFile = null;
}

function selectOptionsHTML(options, selectedValue) {
  return options
    .map((opt) => `<option value="${opt}" ${opt === selectedValue ? "selected" : ""}>${opt}</option>`)
    .join("");
}

function buildIngredientRow(value) {
  const row = document.createElement("div");
  row.className = "form-row-dynamic";
  row.innerHTML = `
    <input type="text" class="ingredient-input" placeholder="e.g. Garlic" value="${value ? value.replace(/"/g, "&quot;") : ""}">
    <button type="button" class="remove-row-btn" aria-label="Remove">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  return row;
}

function buildInstructionRow(value) {
  const row = document.createElement("div");
  row.className = "form-row-dynamic";
  row.innerHTML = `
    <input type="text" class="instruction-input" placeholder="Step" value="${value ? value.replace(/"/g, "&quot;") : ""}">
    <button type="button" class="remove-row-btn" aria-label="Remove">&times;</button>
  `;
  row.querySelector(".remove-row-btn").addEventListener("click", () => row.remove());
  return row;
}

function renderForm(existingRecipe) {
  const overlay = ensureOverlay();
  const body = overlay.querySelector("#recipe-form-body");
  const isEditing = !!existingRecipe;

  body.innerHTML = `
    <h2 class="modal-title" style="margin-top:44px;">${isEditing ? "Edit Recipe" : "Add Recipe"}</h2>

    <label class="form-label">Recipe name</label>
    <input type="text" id="form-title" class="form-input" value="${isEditing ? existingRecipe.title.replace(/"/g, "&quot;") : ""}">

    <label class="form-label">Photo</label>
    <div class="photo-picker-row">
      <img id="form-photo-preview" class="photo-preview" ${isEditing && existingRecipe.imageURL ? `src="${existingRecipe.imageURL}"` : ""} ${isEditing && existingRecipe.imageURL ? "" : "hidden"}>
      <input type="file" id="form-photo-input" accept="image/*" capture="environment">
    </div>

    <label class="form-label">Description</label>
    <textarea id="form-description" class="form-input" rows="3">${isEditing ? existingRecipe.description : ""}</textarea>

    <label class="form-label">Difficulty</label>
    <select id="form-difficulty" class="form-input">${selectOptionsHTML(DIFFICULTY_OPTIONS, isEditing ? existingRecipe.difficulty : DIFFICULTY_OPTIONS[0])}</select>

    <label class="form-label">Cuisine</label>
    <select id="form-cuisine" class="form-input">${selectOptionsHTML(CUISINE_OPTIONS, isEditing ? existingRecipe.cuisine : CUISINE_OPTIONS[0])}</select>

    <label class="form-label">Category</label>
    <select id="form-category" class="form-input">${selectOptionsHTML(CATEGORY_OPTIONS, isEditing ? existingRecipe.category : CATEGORY_OPTIONS[0])}</select>

    <label class="form-label">Cooking time (minutes)</label>
    <input type="number" id="form-cooking-time" class="form-input" placeholder="e.g. 30" value="${isEditing && existingRecipe.cookingTimeMinutes ? existingRecipe.cookingTimeMinutes : ""}">

    <label class="form-label">Ingredients</label>
    <div id="form-ingredients-list"></div>
    <button type="button" class="add-row-btn" id="add-ingredient-btn">+ Add Ingredient</button>

    <label class="form-label">Instructions</label>
    <div id="form-instructions-list"></div>
    <button type="button" class="add-row-btn" id="add-instruction-btn">+ Add Step</button>

    <button type="button" class="save-recipe-btn" id="form-submit-btn">${isEditing ? "Update Recipe" : "Save Recipe"}</button>
  `;

  const ingredientsList = body.querySelector("#form-ingredients-list");
  const instructionsList = body.querySelector("#form-instructions-list");

  const initialIngredients = isEditing && existingRecipe.ingredients.length ? existingRecipe.ingredients : [""];
  const initialInstructions = isEditing && existingRecipe.instructions.length ? existingRecipe.instructions : [""];
  initialIngredients.forEach((val) => ingredientsList.appendChild(buildIngredientRow(val)));
  initialInstructions.forEach((val) => instructionsList.appendChild(buildInstructionRow(val)));

  body.querySelector("#add-ingredient-btn").addEventListener("click", () => {
    ingredientsList.appendChild(buildIngredientRow(""));
  });
  body.querySelector("#add-instruction-btn").addEventListener("click", () => {
    instructionsList.appendChild(buildInstructionRow(""));
  });

  const photoInput = body.querySelector("#form-photo-input");
  const photoPreview = body.querySelector("#form-photo-preview");
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pickedPhotoFile = file;
    photoPreview.src = URL.createObjectURL(file);
    photoPreview.hidden = false;
  });

  body.querySelector("#form-submit-btn").addEventListener("click", async () => {
    const submitBtn = body.querySelector("#form-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      let imageURL = isEditing ? existingRecipe.imageURL : "";
      if (pickedPhotoFile) {
        imageURL = await uploadRecipePhoto(pickedPhotoFile);
      }

      const formData = {
        title: body.querySelector("#form-title").value.trim(),
        description: body.querySelector("#form-description").value.trim(),
        difficulty: body.querySelector("#form-difficulty").value,
        cuisine: body.querySelector("#form-cuisine").value,
        category: body.querySelector("#form-category").value,
        cookingTimeMinutes: parseInt(body.querySelector("#form-cooking-time").value, 10) || 0,
        ingredients: Array.from(ingredientsList.querySelectorAll(".ingredient-input"))
          .map((el) => el.value.trim())
          .filter((v) => v.length > 0),
        instructions: Array.from(instructionsList.querySelectorAll(".instruction-input"))
          .map((el) => el.value.trim())
          .filter((v) => v.length > 0),
        imageURL
      };

      if (isEditing) {
        await updateRecipe(existingRecipe, formData);
      } else {
        await addRecipe(formData);
      }

      pickedPhotoFile = null;
      closeForm();
      if (onSavedCallback) onSavedCallback();
    } catch (error) {
      console.error("Failed to save recipe:", error);
      submitBtn.disabled = false;
      submitBtn.textContent = isEditing ? "Update Recipe" : "Save Recipe";
      alert("Couldn't save the recipe — please try again.");
    }
  });

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function openAddForm(onSaved) {
  onSavedCallback = onSaved;
  renderForm(null);
}

export function openEditForm(recipe, onSaved) {
  onSavedCallback = onSaved;
  renderForm(recipe);
}
