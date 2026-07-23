/*
  HER RECIPE BOOK — PWA APP LOGIC
  -----------------------------------
  Renders the recipe grid from live Firestore data (recipe-data.js), the
  category chips, search, the All/Favourites/Recently Deleted view toggle
  (owner-only), and the recipe detail modal — including the ingredient
  checklist (session-only, resets every time a recipe is opened, matching
  the mobile app's RecipeDetailsScreen.kt exactly), tap-to-rate stars, and
  the Edit/Delete/Favourite controls that only appear while signed in.

  Account sign-in/out is wired here too rather than a separate module,
  keeping this a single self-contained app file.
*/

import { signIn, signOutUser, watchAuthState } from "./auth.js";
import { toggleFavourite, updateRating, softDeleteRecipe, restoreRecipe } from "./recipe-crud.js";

const ICONS = {
  heartOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFilled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  circleOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
  bookPlaceholder: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M32 18c-4-4-10-6-18-6v34c8 0 14 2 18 6"/><path d="M32 18c4-4 10-6 18-6v34c-8 0-14 2-18 6"/><path d="M32 18v34"/><path d="M18 22h8"/><path d="M18 28h8"/><path d="M18 34h6"/><path d="M38 22h8"/><path d="M38 28h8"/><path d="M38 34h6"/></svg>'
};

(function () {
  let RECIPES = [];
  let currentUser = null;
  let currentView = "all"; // "all" | "favourites" | "deleted"
  let checkedIngredients = {}; // session-only, keyed by ingredient index — reset per modal open

  const state = { category: "All", query: "" };

  const chipsEl = document.getElementById("category-chips");
  const searchEl = document.getElementById("recipe-search");
  const gridEl = document.getElementById("recipe-grid");
  const emptyStateEl = document.getElementById("empty-state");
  const viewTogglesEl = document.getElementById("view-toggles");
  const addRecipeBtn = document.getElementById("add-recipe-btn");
  const accountArea = document.getElementById("account-area");

  const modalEl = document.getElementById("recipe-modal");
  const modalBodyEl = document.getElementById("recipe-modal-body");
  const modalCloseEl = document.getElementById("recipe-modal-close");

  // ---------- Account UI ----------

  function renderAccountArea() {
    accountArea.innerHTML = "";
    if (currentUser) {
      const status = document.createElement("span");
      status.className = "account-status";
      status.textContent = currentUser.displayName || currentUser.email || "Signed in";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "account-btn";
      btn.textContent = "Sign out";
      btn.addEventListener("click", () => signOutUser());
      accountArea.appendChild(status);
      accountArea.appendChild(btn);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "account-btn";
      btn.textContent = "Sign in";
      btn.addEventListener("click", () => signIn());
      accountArea.appendChild(btn);
    }
  }

  watchAuthState((user, errorMessage) => {
    currentUser = user;
    renderAccountArea();
    if (errorMessage) {
      const errEl = document.createElement("span");
      errEl.className = "account-error";
      errEl.textContent = errorMessage;
      accountArea.appendChild(errEl);
    }
    addRecipeBtn.hidden = !currentUser;
    if (!currentUser) currentView = "all";
    renderViewToggles();
    renderChips();
    renderGrid();
  });

  // ---------- Data helpers ----------

  function getCategories() {
    const set = new Set(RECIPES.map((r) => r.category));
    return ["All", ...Array.from(set)];
  }

  function getFilteredRecipes() {
    let source;
    if (currentView === "deleted") {
      source = (window.ALL_RECIPES || []).filter((r) => r.deleted);
    } else if (currentView === "favourites") {
      source = RECIPES.filter((r) => r.favourite);
    } else {
      source = RECIPES;
    }
    const query = state.query.trim().toLowerCase();
    return source.filter((r) => {
      const matchesCategory = currentView === "deleted" || state.category === "All" || r.category === state.category;
      const matchesQuery = !query || r.title.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }

  function daysRemainingLabel(deletedAt) {
    if (!deletedAt) return "";
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const remaining = (deletedAt + sevenDaysMs) - Date.now();
    const daysLeft = Math.max(0, Math.floor(remaining / (24 * 60 * 60 * 1000)));
    return daysLeft === 0 ? "Expires soon" : daysLeft + " day(s) left to restore";
  }

  function frameContent(recipe) {
    if (recipe.imageURL) {
      const img = document.createElement("img");
      img.src = recipe.imageURL;
      img.alt = recipe.title;
      return img;
    }
    const wrap = document.createElement("div");
    wrap.className = "placeholder-illustration";
    wrap.innerHTML = ICONS.bookPlaceholder;
    return wrap;
  }

  // ---------- Rendering: chips / toggles ----------

  function renderChips() {
    if (currentView === "deleted") {
      chipsEl.innerHTML = "";
      chipsEl.hidden = true;
      return;
    }
    chipsEl.hidden = false;
    chipsEl.innerHTML = "";
    getCategories().forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (cat === state.category ? " active" : "");
      btn.textContent = cat;
      btn.addEventListener("click", () => {
        state.category = cat;
        renderChips();
        renderGrid();
      });
      chipsEl.appendChild(btn);
    });
  }

  function renderViewToggles() {
    if (!currentUser) {
      viewTogglesEl.hidden = true;
      return;
    }
    viewTogglesEl.hidden = false;
    viewTogglesEl.innerHTML = "";
    [
      { key: "all", label: "All Recipes" },
      { key: "favourites", label: "Favourites" },
      { key: "deleted", label: "Recently Deleted" }
    ].forEach(({ key, label }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-toggle-btn" + (currentView === key ? " active" : "");
      btn.textContent = label;
      btn.addEventListener("click", () => {
        currentView = key;
        renderChips();
        renderViewToggles();
        renderGrid();
      });
      viewTogglesEl.appendChild(btn);
    });
  }

  // ---------- Rendering: grid ----------

  function renderGrid() {
    const filtered = getFilteredRecipes();
    gridEl.innerHTML = "";

    if (filtered.length === 0) {
      emptyStateEl.textContent = currentView === "deleted"
        ? "Nothing in Recently Deleted."
        : currentView === "favourites"
          ? "No favourites yet — tap the heart on a recipe to save it here."
          : "No recipes match that search just yet.";
      emptyStateEl.hidden = false;
      return;
    }
    emptyStateEl.hidden = true;

    filtered.forEach((recipe) => {
      const card = document.createElement("div");
      card.className = "recipe-card";

      const frameWrap = document.createElement("div");
      frameWrap.className = "card-frame";
      frameWrap.appendChild(frameContent(recipe));

      const badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = recipe.category;
      frameWrap.appendChild(badge);

      if (recipe.rating > 0) {
        const ratingBadge = document.createElement("span");
        ratingBadge.className = "card-rating-badge";
        ratingBadge.innerHTML = ICONS.starFilled.replace("<svg ", '<svg style="width:11px;height:11px;" ') + recipe.rating;
        frameWrap.appendChild(ratingBadge);
      }
      if (recipe.favourite && currentView !== "deleted") {
        const heart = document.createElement("span");
        heart.className = "card-favourite-badge";
        heart.style.color = "white";
        heart.innerHTML = ICONS.heartFilled.replace("<svg ", '<svg style="width:16px;height:16px;" ');
        frameWrap.appendChild(heart);
      }

      const body = document.createElement("div");
      body.className = "card-body";

      const title = document.createElement("h3");
      title.className = "card-title";
      title.textContent = recipe.title;
      body.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "card-meta";

      if (currentView === "deleted") {
        meta.textContent = daysRemainingLabel(recipe.deletedAt);
        body.appendChild(meta);
        const restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "owner-btn";
        restoreBtn.style.marginTop = "8px";
        restoreBtn.textContent = "Restore";
        restoreBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          restoreRecipe(recipe).catch((err) => console.error("Restore failed:", err));
        });
        body.appendChild(restoreBtn);
      } else {
        const parts = [];
        if (recipe.cookingTimeMinutes) parts.push(recipe.cookingTimeMinutes + " min");
        if (recipe.difficulty) parts.push(recipe.difficulty);
        meta.textContent = parts.join(" · ");
        body.appendChild(meta);
        card.addEventListener("click", () => openModal(recipe));
      }

      card.appendChild(frameWrap);
      card.appendChild(body);
      gridEl.appendChild(card);
    });
  }

  // ---------- Rendering: detail modal ----------

  function buildStarRating(recipe) {
    const wrap = document.createElement("div");
    wrap.className = "star-rating";
    for (let i = 1; i <= 5; i++) {
      const starSpan = document.createElement("span");
      starSpan.innerHTML = i <= recipe.rating ? ICONS.starFilled : ICONS.starOutline;
      starSpan.style.cursor = currentUser ? "pointer" : "default";
      if (currentUser) {
        starSpan.addEventListener("click", () => {
          updateRating(recipe, i).catch((err) => console.error("Rating update failed:", err));
          recipe.rating = i;
          wrap.querySelectorAll("span").forEach((el, idx) => {
            if (idx < 5) el.innerHTML = idx < i ? ICONS.starFilled : ICONS.starOutline;
          });
        });
      }
      wrap.appendChild(starSpan);
    }
    if (recipe.rating > 0) {
      const label = document.createElement("span");
      label.className = "rating-label";
      label.textContent = recipe.rating + "/5";
      wrap.appendChild(label);
    }
    return wrap;
  }

  function openModal(recipe) {
    checkedIngredients = {}; // reset every time a recipe is opened — session-only, matches native app
    modalBodyEl.innerHTML = "";

    const header = document.createElement("div");
    header.className = "modal-frame";
    header.appendChild(frameContent(recipe));
    modalBodyEl.appendChild(header);

    const title = document.createElement("h2");
    title.className = "modal-title";
    title.textContent = recipe.title;
    modalBodyEl.appendChild(title);

    modalBodyEl.appendChild(buildStarRating(recipe));

    const tagsRow = document.createElement("div");
    tagsRow.className = "tags-row";
    [recipe.difficulty, recipe.cuisine, recipe.category, recipe.cookingTimeMinutes ? recipe.cookingTimeMinutes + " min" : null]
      .filter(Boolean)
      .forEach((label) => {
        const tag = document.createElement("span");
        tag.className = "info-tag";
        tag.textContent = label;
        tagsRow.appendChild(tag);
      });
    modalBodyEl.appendChild(tagsRow);

    if (recipe.description) {
      const desc = document.createElement("p");
      desc.className = "modal-description";
      desc.textContent = recipe.description;
      modalBodyEl.appendChild(desc);
    }

    if (currentUser) {
      const controls = document.createElement("div");
      controls.className = "modal-owner-controls";

      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "owner-btn";
      favBtn.textContent = recipe.favourite ? "♥ Favourited" : "♡ Favourite";
      favBtn.addEventListener("click", () => {
        toggleFavourite(recipe).catch((err) => console.error("Favourite toggle failed:", err));
        recipe.favourite = !recipe.favourite;
        favBtn.textContent = recipe.favourite ? "♥ Favourited" : "♡ Favourite";
      });

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "owner-btn";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", async () => {
        const { openEditForm } = await import("./recipe-form.js");
        openEditForm(recipe, () => {});
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "owner-btn owner-btn-danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        if (!confirm(`"${recipe.title}" will move to Recently Deleted and be permanently removed after 7 days. Continue?`)) return;
        softDeleteRecipe(recipe).catch((err) => console.error("Delete failed:", err));
        closeModal();
      });

      controls.appendChild(favBtn);
      controls.appendChild(editBtn);
      controls.appendChild(deleteBtn);
      modalBodyEl.appendChild(controls);
    }

    if (recipe.ingredients.length > 0) {
      const headingRow = document.createElement("div");
      headingRow.className = "section-heading-row";
      const heading = document.createElement("h3");
      heading.className = "section-heading";
      heading.textContent = "Ingredients";
      headingRow.appendChild(heading);
      const progress = document.createElement("span");
      progress.className = "progress-label";
      headingRow.appendChild(progress);
      modalBodyEl.appendChild(headingRow);

      const list = document.createElement("div");
      list.className = "ingredients-checklist";

      function updateProgress() {
        const checkedCount = Object.values(checkedIngredients).filter(Boolean).length;
        progress.textContent = checkedCount + " / " + recipe.ingredients.length + " gathered";
      }

      recipe.ingredients.forEach((ing, i) => {
        const row = document.createElement("div");
        row.className = "ingredient-row";
        row.innerHTML = `<span class="check-icon">${ICONS.circleOutline}</span><span class="ingredient-text">${ing}</span>`;
        row.addEventListener("click", () => {
          checkedIngredients[i] = !checkedIngredients[i];
          row.classList.toggle("checked", !!checkedIngredients[i]);
          row.querySelector(".check-icon").innerHTML = checkedIngredients[i] ? ICONS.checkCircle : ICONS.circleOutline;
          updateProgress();
        });
        list.appendChild(row);
      });
      modalBodyEl.appendChild(list);
      updateProgress();

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "reset-checklist-btn";
      resetBtn.textContent = "Reset Checklist";
      resetBtn.addEventListener("click", () => {
        checkedIngredients = {};
        list.querySelectorAll(".ingredient-row").forEach((row) => {
          row.classList.remove("checked");
          row.querySelector(".check-icon").innerHTML = ICONS.circleOutline;
        });
        updateProgress();
      });
      modalBodyEl.appendChild(resetBtn);
    }

    if (recipe.instructions.length > 0) {
      const stepsHeading = document.createElement("h3");
      stepsHeading.className = "section-heading";
      stepsHeading.style.margin = "22px 20px 8px";
      stepsHeading.textContent = "Instructions";
      modalBodyEl.appendChild(stepsHeading);

      const stepsList = document.createElement("ol");
      stepsList.className = "steps-list";
      recipe.instructions.forEach((step) => {
        const li = document.createElement("li");
        li.textContent = step;
        stepsList.appendChild(li);
      });
      modalBodyEl.appendChild(stepsList);
    }

    modalEl.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modalEl.classList.remove("open");
    document.body.style.overflow = "";
  }

  modalCloseEl.addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.classList.contains("open")) closeModal();
  });

  searchEl.addEventListener("input", (e) => {
    state.query = e.target.value;
    renderGrid();
  });

  addRecipeBtn.addEventListener("click", async () => {
    const { openAddForm } = await import("./recipe-form.js");
    openAddForm(() => {});
  });

  emptyStateEl.textContent = "Loading your recipes...";
  emptyStateEl.hidden = false;

  window.initRecipeBook = function (recipes) {
    RECIPES = recipes;
    renderChips();
    renderViewToggles();
    renderGrid();
  };

  document.querySelectorAll("[data-icon]").forEach((el) => {
    const iconName = el.getAttribute("data-icon");
    if (ICONS[iconName]) el.innerHTML = ICONS[iconName];
  });
})();
