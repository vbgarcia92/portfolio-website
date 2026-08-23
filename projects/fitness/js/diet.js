// Diet module: log meals and their items, auto-calculate protein, and keep a
// rolling 7-day history.

const Diet = {

  HISTORY_DAYS: 7,

  MEAL_TYPES: [
    { key: 'breakfast',    label: 'Breakfast',    color: '#4ade80' },
    { key: 'snack',        label: 'Snack',        color: '#38bdf8' },
    { key: 'preWorkout',   label: 'Pre-workout',  color: '#a78bfa' },
    { key: 'lunch',        label: 'Lunch',        color: '#fbbf24' },
    { key: 'postWorkout',  label: 'Post-workout', color: '#f472b6' },
    { key: 'dinner',       label: 'Dinner',       color: '#fb7185' }
  ],

  // --- helpers ----------------------------------------------------------

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  toUtc(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  },

  addDays(iso, n) {
    const d = new Date(this.toUtc(iso) + n * 86400000);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  },

  weekdayLabel(iso) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return names[new Date(this.toUtc(iso)).getUTCDay()];
  },

  mealType(key) {
    return this.MEAL_TYPES.find((m) => m.key === key) || { key: key, label: key, color: '#8b93a5' };
  },

  round1(n) {
    return Math.round(n * 10) / 10;
  },

  formatNum(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // --- protein maths ----------------------------------------------------

  // Grams of protein for `amount` of a food, measured in grams or in units.
  proteinFor(food, amount, unit) {
    if (!food || !amount || amount <= 0) return 0;
    if (unit === 'unit') {
      if (!food.unitGrams) return 0;
      return food.per100g * (food.unitGrams / 100) * amount;
    }
    return food.per100g * (amount / 100);
  },

  mealProtein(meal) {
    return meal.items.reduce((sum, i) => sum + i.protein, 0);
  },

  dayProtein(day) {
    if (!day) return 0;
    return day.meals.reduce((sum, m) => sum + this.mealProtein(m), 0);
  },

  // --- day records ------------------------------------------------------

  findDay(diet, date) {
    return diet.days.find((d) => d.date === date) || null;
  },

  ensureDay(diet, date) {
    let day = this.findDay(diet, date);
    if (!day) {
      day = { date: date, meals: [] };
      diet.days.push(day);
    }
    return day;
  },

  // Drop anything older than the rolling window. Returns true if it changed.
  prune(diet) {
    const cutoff = this.addDays(this.todayISO(), -(this.HISTORY_DAYS - 1));
    const before = diet.days.length;
    diet.days = diet.days.filter((d) => d.date >= cutoff);
    diet.days.sort((a, b) => (a.date > b.date ? 1 : -1));
    return diet.days.length !== before;
  },

  // --- mutations --------------------------------------------------------

  addMeal(data, type) {
    const day = this.ensureDay(data.diet, this.todayISO());
    const meal = { id: this.newId(), type: type, items: [] };
    day.meals.push(meal);
    return meal;
  },

  removeMeal(data, mealId) {
    const day = this.findDay(data.diet, this.todayISO());
    if (!day) return;
    const i = day.meals.findIndex((m) => m.id === mealId);
    if (i !== -1) day.meals.splice(i, 1);
  },

  addItem(data, mealId, item) {
    const day = this.findDay(data.diet, this.todayISO());
    if (!day) return;
    const meal = day.meals.find((m) => m.id === mealId);
    if (meal) meal.items.push({ id: this.newId(), ...item });
  },

  removeItem(data, mealId, itemId) {
    const day = this.findDay(data.diet, this.todayISO());
    if (!day) return;
    const meal = day.meals.find((m) => m.id === mealId);
    if (!meal) return;
    const i = meal.items.findIndex((x) => x.id === itemId);
    if (i !== -1) meal.items.splice(i, 1);
  },

  setTarget(data, grams) {
    data.diet.targetProtein = grams;
  },

  // --- donut ------------------------------------------------------------

  // Segments are sized against the target, so a full ring means goal reached.
  // Once the total passes the target the ring is scaled by the total instead,
  // which keeps it full while still showing every meal's share.
  donutSvg(day, target) {
    const R = 54;
    const C = 2 * Math.PI * R;
    const total = this.dayProtein(day);
    const meals = day ? day.meals.filter((m) => this.mealProtein(m) > 0) : [];
    const denominator = Math.max(target, total);

    let offset = 0;
    const segments = meals.map((meal) => {
      const grams = this.mealProtein(meal);
      let len = (grams / denominator) * C;
      if (offset + len > C) len = C - offset;   // guard against float drift
      if (len <= 0) return '';

      const seg = `<circle class="donut-seg" data-meal-id="${meal.id}"
          cx="60" cy="60" r="${R}" fill="none"
          stroke="${this.mealType(meal.type).color}" stroke-width="12"
          stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}"
          stroke-linecap="butt" />`;
      offset += len;
      return seg;
    }).join('');

    return `
      <svg class="donut" viewBox="0 0 120 120" role="img"
           aria-label="${this.formatNum(this.round1(total))} of ${target} grams of protein today">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--bg)" stroke-width="12" />
        <g transform="rotate(-90 60 60)">${segments}</g>
      </svg>`;
  },

  // --- rendering --------------------------------------------------------

  render(data) {
    if (!data.diet) return;
    if (this.prune(data.diet) && this._app) this._app.save();

    this.renderSummary(data);
    this.renderMeals(data);
    this.renderHistory(data);
  },

  renderSummary(data) {
    const wrap = document.getElementById('protein-summary');
    if (!wrap) return;

    const target = data.diet.targetProtein;
    const day = this.findDay(data.diet, this.todayISO());
    const total = this.round1(this.dayProtein(day));
    const remaining = this.round1(Math.max(0, target - total));
    const pct = Math.round((total / target) * 100);

    wrap.innerHTML = `
      <div class="donut-wrap">
        ${this.donutSvg(day, target)}
        <div class="donut-center" id="donut-center">
          <span class="donut-total">${this.formatNum(total)}<span class="donut-unit">g</span></span>
          <span class="donut-target">of ${target} g</span>
        </div>
      </div>
      <p class="protein-note" id="protein-note">
        ${total >= target
          ? `Target hit — ${this.formatNum(this.round1(total - target))} g over.`
          : `${this.formatNum(remaining)} g to go · ${pct}%`}
      </p>`;
  },

  renderMeals(data) {
    const container = document.getElementById('meals-container');
    if (!container) return;

    const day = this.findDay(data.diet, this.todayISO());
    if (!day || !day.meals.length) {
      container.innerHTML =
        '<div class="card"><p class="empty-state">No meals logged today. Pick a meal above to start.</p></div>';
      return;
    }

    const order = this.MEAL_TYPES.map((m) => m.key);
    const meals = [...day.meals].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

    container.innerHTML = meals.map((meal) => {
      const type = this.mealType(meal.type);
      const grams = this.round1(this.mealProtein(meal));

      const items = meal.items.length
        ? `<ul class="item-list">${meal.items.map((item) => `
            <li class="item-row">
              <span class="item-name">${this.escape(item.name)}</span>
              <span class="item-amount">${this.formatNum(item.amount)}${item.unit === 'unit' ? '×' : ' g'}</span>
              <span class="item-protein">${this.formatNum(this.round1(item.protein))} g</span>
              <button class="item-remove" data-action="remove-item" data-item-id="${item.id}"
                      aria-label="Remove ${this.escape(item.name)}">×</button>
            </li>`).join('')}</ul>`
        : '<p class="empty-state">Nothing added yet.</p>';

      return `
        <div class="card meal-card" data-meal-id="${meal.id}">
          <div class="meal-head">
            <span class="meal-dot" style="background:${type.color}"></span>
            <h3 class="meal-name">${type.label}</h3>
            <span class="meal-total">${this.formatNum(grams)} g</span>
          </div>

          ${items}

          <div class="meal-actions">
            <button class="btn btn-small" data-action="add-item">+ Add food</button>
            <button class="btn btn-ghost btn-small btn-danger" data-action="delete-meal">Delete meal</button>
          </div>

          <form class="inline-form item-form hidden" data-role="item-form">
            <select data-role="food-select">
              <option value="">Choose a food…</option>
              ${FOODS.map((f) => `<option value="${f.id}">${this.escape(f.name)}</option>`).join('')}
              <option value="__custom">Custom (enter protein myself)</option>
            </select>

            <div class="form-row" data-role="std-fields">
              <input type="number" data-role="amount" placeholder="Amount" min="0" step="0.1" />
              <select data-role="unit">
                <option value="g">grams</option>
                <option value="unit">units</option>
              </select>
            </div>

            <div class="form-row hidden" data-role="custom-fields">
              <input type="text" data-role="custom-name" placeholder="Food name" maxlength="40" />
              <input type="number" data-role="custom-protein" placeholder="Protein (g)" min="0" step="0.1" />
            </div>

            <p class="protein-preview" data-role="preview"></p>
            <p class="form-error hidden" data-role="item-error"></p>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" data-action="cancel-item">Cancel</button>
              <button type="submit" class="btn btn-primary">Add</button>
            </div>
          </form>
        </div>`;
    }).join('');
  },

  renderHistory(data) {
    const wrap = document.getElementById('protein-history');
    if (!wrap) return;

    const target = data.diet.targetProtein;
    const today = this.todayISO();
    const days = [];
    for (let i = this.HISTORY_DAYS - 1; i >= 0; i--) {
      const date = this.addDays(today, -i);
      days.push({ date: date, total: this.round1(this.dayProtein(this.findDay(data.diet, date))) });
    }

    const peak = Math.max(target, ...days.map((d) => d.total));
    const hits = days.filter((d) => d.total >= target).length;

    wrap.innerHTML = `
      <div class="chart" style="--target-pct:${(target / peak) * 100}%">
        <div class="target-line"><span class="target-tag">${target} g</span></div>
        ${days.map((d) => `
          <div class="chart-col">
            <div class="bar-track">
              <div class="bar${d.total >= target ? ' is-hit' : ''}${d.date === today ? ' is-today' : ''}"
                   style="height:${peak ? (d.total / peak) * 100 : 0}%"
                   title="${this.formatNum(d.total)} g"></div>
            </div>
            <span class="chart-label${d.date === today ? ' is-today' : ''}">${this.weekdayLabel(d.date)}</span>
            <span class="chart-value">${d.total ? this.formatNum(d.total) : '–'}</span>
          </div>`).join('')}
      </div>
      <p class="chart-note">${hits} of ${this.HISTORY_DAYS} days on target</p>`;
  },

  // --- add-item form helpers -------------------------------------------

  isCustom(form) {
    return form.querySelector('[data-role="food-select"]').value === '__custom';
  },

  // Reads the form and returns either { item } or { error }.
  readItem(form) {
    const custom = this.isCustom(form);

    if (custom) {
      const name = form.querySelector('[data-role="custom-name"]').value.trim();
      const proteinRaw = form.querySelector('[data-role="custom-protein"]').value;
      const protein = parseFloat(proteinRaw);

      if (!name) return { error: 'Give the food a name.' };
      if (!proteinRaw || Number.isNaN(protein) || protein < 0) return { error: 'Enter the protein in grams.' };
      if (protein > 500) return { error: 'That protein figure looks too high (max 500 g).' };

      return { item: { name: name, amount: 1, unit: 'unit', protein: protein } };
    }

    const foodId = form.querySelector('[data-role="food-select"]').value;
    if (!foodId) return { error: 'Choose a food.' };

    const food = FOODS_BY_ID[foodId];
    const unit = form.querySelector('[data-role="unit"]').value;
    const amountRaw = form.querySelector('[data-role="amount"]').value;
    const amount = parseFloat(amountRaw);

    if (!amountRaw || Number.isNaN(amount) || amount <= 0) return { error: 'Enter an amount above 0.' };
    if (unit === 'unit' && !food.unitGrams) {
      return { error: `${food.name} has no per-unit size — enter grams instead.` };
    }
    if (unit === 'g' && amount > 5000) return { error: 'That amount looks too high (max 5000 g).' };
    if (unit === 'unit' && amount > 50) return { error: 'That many units looks too high (max 50).' };

    return {
      item: {
        name: food.name,
        amount: amount,
        unit: unit,
        protein: this.round1(this.proteinFor(food, amount, unit))
      }
    };
  },

  // Live "≈ 24 g protein" hint under the inputs.
  updatePreview(form) {
    const preview = form.querySelector('[data-role="preview"]');
    const result = this.readItem(form);
    preview.textContent = result.item
      ? `≈ ${this.formatNum(this.round1(result.item.protein))} g protein`
      : '';
  },

  // Swap between the standard picker and the custom fields.
  syncFormMode(form) {
    const custom = this.isCustom(form);
    form.querySelector('[data-role="std-fields"]').classList.toggle('hidden', custom);
    form.querySelector('[data-role="custom-fields"]').classList.toggle('hidden', !custom);

    if (!custom) {
      const food = FOODS_BY_ID[form.querySelector('[data-role="food-select"]').value];
      const unitOpt = form.querySelector('[data-role="unit"] option[value="unit"]');
      if (food && food.unitGrams) {
        unitOpt.disabled = false;
        unitOpt.textContent = `${food.unitLabel} (${food.unitGrams} g)`;
      } else {
        unitOpt.disabled = true;
        unitOpt.textContent = 'units (n/a)';
        form.querySelector('[data-role="unit"]').value = 'g';
      }
    }
  },

  // --- events -----------------------------------------------------------

  showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  },

  clearError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  },

  bindEvents(App) {
    this._app = App;

    const picker = document.getElementById('meal-picker');
    const container = document.getElementById('meals-container');
    const summary = document.getElementById('protein-summary');
    const targetBtn = document.getElementById('edit-target-btn');
    if (!picker || !container) return;

    picker.innerHTML = this.MEAL_TYPES.map((m) => `
      <button class="meal-chip" data-meal-type="${m.key}">
        <span class="meal-dot" style="background:${m.color}"></span>${m.label}
      </button>`).join('');

    picker.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-meal-type]');
      if (!chip) return;
      this.addMeal(App.data, chip.dataset.mealType);
      App.save();
      App.renderAll();
    });

    if (targetBtn) {
      targetBtn.addEventListener('click', () => {
        const current = App.data.diet.targetProtein;
        const answer = prompt('Daily protein target in grams:', current);
        if (answer === null) return;
        const grams = parseFloat(answer);
        if (Number.isNaN(grams) || grams <= 0 || grams > 1000) {
          alert('Enter a target between 1 and 1000 g.');
          return;
        }
        this.setTarget(App.data, grams);
        App.save();
        App.renderAll();
      });
    }

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const card = btn.closest('.meal-card');
      const mealId = card.dataset.mealId;
      const action = btn.dataset.action;
      const form = card.querySelector('[data-role="item-form"]');

      if (action === 'add-item') {
        form.classList.remove('hidden');
        this.syncFormMode(form);
        form.querySelector('[data-role="food-select"]').focus();
      }

      if (action === 'cancel-item') {
        form.classList.add('hidden');
        form.reset();
        this.clearError(form.querySelector('[data-role="item-error"]'));
        form.querySelector('[data-role="preview"]').textContent = '';
      }

      if (action === 'delete-meal') {
        const label = this.mealType(
          App.data.diet.days.find((d) => d.date === this.todayISO())
            .meals.find((m) => m.id === mealId).type
        ).label;
        if (confirm(`Delete ${label} and everything in it?`)) {
          this.removeMeal(App.data, mealId);
          App.save();
          App.renderAll();
        }
      }

      if (action === 'remove-item') {
        this.removeItem(App.data, mealId, btn.dataset.itemId);
        App.save();
        App.renderAll();
      }
    });

    container.addEventListener('change', (e) => {
      const form = e.target.closest('[data-role="item-form"]');
      if (!form) return;
      if (e.target.matches('[data-role="food-select"]')) this.syncFormMode(form);
      this.updatePreview(form);
    });

    container.addEventListener('input', (e) => {
      const form = e.target.closest('[data-role="item-form"]');
      if (!form) return;
      this.clearError(form.querySelector('[data-role="item-error"]'));
      this.updatePreview(form);
    });

    container.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-role="item-form"]');
      if (!form) return;
      e.preventDefault();

      const mealId = form.closest('.meal-card').dataset.mealId;
      const result = this.readItem(form);
      if (result.error) {
        return this.showError(form.querySelector('[data-role="item-error"]'), result.error);
      }

      this.addItem(App.data, mealId, result.item);
      App.save();
      App.renderAll();
    });

    // Tapping a donut segment names the meal it belongs to.
    if (summary) {
      summary.addEventListener('click', (e) => {
        const seg = e.target.closest('.donut-seg');
        const note = document.getElementById('protein-note');
        if (!note) return;

        if (!seg) {
          this.render(App.data);
          return;
        }

        const day = this.findDay(App.data.diet, this.todayISO());
        const meal = day && day.meals.find((m) => m.id === seg.dataset.mealId);
        if (!meal) return;

        const type = this.mealType(meal.type);
        note.textContent = `${type.label}: ${this.formatNum(this.round1(this.mealProtein(meal)))} g`;
        note.style.color = type.color;
      });
    }
  }
};
