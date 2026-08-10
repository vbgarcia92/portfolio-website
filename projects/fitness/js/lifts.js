// Lifts module: add lifts, log entries, track PRs and history.

const Lifts = {

  // --- helpers -------------------------------------------------------

  // Newest entry wins for "current"; ties broken by position in history.
  latestEntry(lift) {
    if (!lift.history.length) return null;
    return lift.history.reduce((best, e) =>
      (!best || e.date >= best.date) ? e : best, null);
  },

  prWeight(lift) {
    if (!lift.history.length) return null;
    return lift.history.reduce((max, e) => Math.max(max, e.weight), 0);
  },

  isPr(lift, weight) {
    const pr = this.prWeight(lift);
    return pr === null || weight > pr;
  },

  // Epley. The formula is only meaningful above a single, so a 1-rep set is
  // returned as-is rather than inflated to weight * 31/30.
  estimatedOneRm(weight, reps) {
    if (!weight || !reps || reps < 1) return null;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
  },

  // Best estimated 1RM across all logged entries — a heavy triple can beat
  // a heavier single, so this is not always the PR weight.
  bestOneRm(lift) {
    if (!lift.history.length) return null;
    return lift.history.reduce((best, e) => {
      const est = this.estimatedOneRm(e.weight, e.reps);
      return est !== null && (best === null || est > best) ? est : best;
    }, null);
  },

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  today() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  formatWeight(w) {
    return Number.isInteger(w) ? String(w) : w.toFixed(1);
  },

  formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // --- mutations -----------------------------------------------------

  addLift(data, name, weight, reps) {
    const lift = {
      id: this.newId(),
      name: name,
      unit: 'kg',
      currentWeight: weight,
      history: [{ date: this.today(), weight: weight, reps: reps }]
    };
    data.lifts.push(lift);
    return lift;
  },

  logEntry(data, liftId, weight, reps, date) {
    const lift = data.lifts.find((l) => l.id === liftId);
    if (!lift) return null;
    const wasPr = this.isPr(lift, weight);
    lift.history.push({ date: date, weight: weight, reps: reps });
    lift.currentWeight = this.latestEntry(lift).weight;
    return wasPr;
  },

  removeLift(data, liftId) {
    const i = data.lifts.findIndex((l) => l.id === liftId);
    if (i !== -1) data.lifts.splice(i, 1);
  },

  // --- rendering -----------------------------------------------------

  liftCardHtml(lift) {
    const latest = this.latestEntry(lift);
    const pr = this.prWeight(lift);
    const name = this.escape(lift.name);

    const reps = latest && latest.reps ? ` <span class="lift-meta">× ${latest.reps}</span>` : '';
    const current = latest
      ? `${this.formatWeight(lift.currentWeight)} kg${reps}`
      : '<span class="lift-meta">No entries yet</span>';
    const prBadge = pr !== null
      ? `<div class="lift-pr">PR ${this.formatWeight(pr)} kg</div>`
      : '';

    const bestOrm = this.bestOneRm(lift);
    const ormLine = bestOrm !== null
      ? `<p class="lift-orm">Best est. 1RM ${this.formatWeight(Math.round(bestOrm * 10) / 10)} kg</p>`
      : '';

    const historyRows = [...lift.history]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => {
        const isPrRow = e.weight === pr;
        const est = this.estimatedOneRm(e.weight, e.reps);
        const estLabel = est !== null
          ? `<span class="h-orm">1RM ~${this.formatWeight(Math.round(est * 10) / 10)}</span>`
          : '';
        return `<li class="history-row${isPrRow ? ' is-pr' : ''}">
            <span class="h-date">${this.formatDate(e.date)}</span>
            <span class="h-weight">${this.formatWeight(e.weight)} kg × ${e.reps}</span>
            ${estLabel}
            ${isPrRow ? '<span class="h-badge">PR</span>' : ''}
          </li>`;
      })
      .join('');

    return `
      <div class="card lift-card" data-lift-id="${lift.id}">
        <div class="lift-head">
          <div class="lift-info">
            <h3 class="lift-name">${name}</h3>
            <p class="lift-current">${current}</p>
            ${ormLine}
          </div>
          ${prBadge}
        </div>

        <div class="lift-actions">
          <button class="btn btn-small" data-action="log">+ Log</button>
          <button class="btn btn-ghost btn-small" data-action="history">
            History (${lift.history.length})
          </button>
          <button class="btn btn-ghost btn-small btn-danger" data-action="delete">Delete</button>
        </div>

        <form class="inline-form log-form hidden" data-role="log-form">
          <div class="form-row">
            <input type="number" data-role="log-weight" placeholder="Weight (kg)" min="0" step="0.5" />
            <input type="number" data-role="log-reps" placeholder="Reps" min="1" step="1" />
          </div>
          <input type="date" data-role="log-date" value="${this.today()}" />
          <p class="form-error hidden" data-role="log-error"></p>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" data-action="cancel-log">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Entry</button>
          </div>
        </form>

        <ul class="history-list hidden" data-role="history-list">
          ${historyRows || '<li class="empty-state">No entries logged.</li>'}
        </ul>
      </div>`;
  },

  render(data) {
    const container = document.getElementById('lifts-container');
    if (container) {
      container.innerHTML = data.lifts.length
        ? data.lifts.map((l) => this.liftCardHtml(l)).join('')
        : '<div class="card"><p class="empty-state">No lifts yet. Tap <strong>+ Add</strong> to create your first one.</p></div>';
    }
    this.renderHomeSummary(data);
  },

  renderHomeSummary(data) {
    const el = document.getElementById('home-lifts-container');
    if (!el) return;

    if (!data.lifts.length) {
      el.innerHTML = '<p class="empty-state">No lifts yet.</p>';
      return;
    }

    el.innerHTML = `<ul class="mini-lift-list">${
      data.lifts.slice(0, 4).map((lift) => `
        <li class="mini-lift">
          <span class="mini-name">${this.escape(lift.name)}</span>
          <span class="mini-weight">${this.formatWeight(lift.currentWeight)} kg</span>
        </li>`).join('')
    }</ul>`;
  },

  // --- input validation ----------------------------------------------

  validate(weightRaw, repsRaw) {
    const weight = parseFloat(weightRaw);
    const reps = parseInt(repsRaw, 10);

    if (!weightRaw || Number.isNaN(weight) || weight <= 0) {
      return { error: 'Enter a weight greater than 0.' };
    }
    if (weight > 1000) {
      return { error: 'That weight looks too high (max 1000 kg).' };
    }
    if (!repsRaw || Number.isNaN(reps) || reps < 1) {
      return { error: 'Enter at least 1 rep.' };
    }
    if (reps > 100) {
      return { error: 'That rep count looks too high (max 100).' };
    }
    return { weight: weight, reps: reps };
  },

  // --- events ---------------------------------------------------------

  showError(el, message) {
    el.textContent = message;
    el.classList.remove('hidden');
  },

  clearError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  },

  bind(App) {
    const toggle = document.getElementById('add-lift-toggle');
    const form = document.getElementById('add-lift-form');
    const cancel = document.getElementById('cancel-lift-btn');
    const nameInput = document.getElementById('new-lift-name');
    const weightInput = document.getElementById('new-lift-weight');
    const repsInput = document.getElementById('new-lift-reps');
    const errorEl = document.getElementById('add-lift-error');

    const closeAddForm = () => {
      form.classList.add('hidden');
      form.reset();
      this.clearError(errorEl);
    };

    toggle.addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) nameInput.focus();
    });

    cancel.addEventListener('click', closeAddForm);

    // Don't leave a stale message up while the user is fixing the problem.
    form.addEventListener('input', () => this.clearError(errorEl));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return this.showError(errorEl, 'Give the lift a name.');

      const duplicate = App.data.lifts
        .some((l) => l.name.toLowerCase() === name.toLowerCase());
      if (duplicate) return this.showError(errorEl, 'You already have a lift with that name.');

      const parsed = this.validate(weightInput.value, repsInput.value);
      if (parsed.error) return this.showError(errorEl, parsed.error);

      this.addLift(App.data, name, parsed.weight, parsed.reps);
      App.save();
      App.renderAll();
      closeAddForm();
    });

    // Delegated handlers for the dynamically rendered lift cards.
    const container = document.getElementById('lifts-container');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const card = btn.closest('.lift-card');
      const liftId = card.dataset.liftId;
      const action = btn.dataset.action;

      if (action === 'log' || action === 'cancel-log') {
        const logForm = card.querySelector('[data-role="log-form"]');
        logForm.classList.toggle('hidden', action === 'cancel-log');
        if (action === 'log') card.querySelector('[data-role="log-weight"]').focus();
        if (action === 'cancel-log') {
          logForm.reset();
          this.clearError(card.querySelector('[data-role="log-error"]'));
        }
      }

      if (action === 'history') {
        card.querySelector('[data-role="history-list"]').classList.toggle('hidden');
      }

      if (action === 'delete') {
        const lift = App.data.lifts.find((l) => l.id === liftId);
        if (confirm(`Delete "${lift.name}" and all its history?`)) {
          this.removeLift(App.data, liftId);
          App.save();
          App.renderAll();
        }
      }
    });

    container.addEventListener('submit', (e) => {
      const logForm = e.target.closest('[data-role="log-form"]');
      if (!logForm) return;
      e.preventDefault();

      const card = logForm.closest('.lift-card');
      const liftId = card.dataset.liftId;
      const errEl = logForm.querySelector('[data-role="log-error"]');

      const parsed = this.validate(
        logForm.querySelector('[data-role="log-weight"]').value,
        logForm.querySelector('[data-role="log-reps"]').value
      );
      if (parsed.error) return this.showError(errEl, parsed.error);

      const date = logForm.querySelector('[data-role="log-date"]').value || this.today();

      this.logEntry(App.data, liftId, parsed.weight, parsed.reps, date);
      App.save();
      App.renderAll();
    });
  }
};
