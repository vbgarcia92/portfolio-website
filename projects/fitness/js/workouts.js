// Workouts module: schedule sessions, list them by status, mark them done.

const Workouts = {

  // --- helpers ----------------------------------------------------------

  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  formatDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  },

  // Friendly relative label for the date badge.
  dateLabel(iso) {
    const today = this.todayISO();
    if (iso === today) return 'Today';

    const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    const diff = Math.round((toUtc(iso) - toUtc(today)) / 86400000);

    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return this.formatDate(iso);
  },

  formatWeight(w) {
    return Number.isInteger(w) ? String(w) : w.toFixed(1);
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // --- mutations --------------------------------------------------------

  addWorkout(data, name, date, exercises) {
    const workout = {
      id: this.newId(),
      date: date,
      name: name,
      exercises: exercises,
      done: false
    };
    data.workouts.push(workout);
    return workout;
  },

  setDone(data, id, done) {
    const w = data.workouts.find((x) => x.id === id);
    if (w) w.done = done;
  },

  removeWorkout(data, id) {
    const i = data.workouts.findIndex((x) => x.id === id);
    if (i !== -1) data.workouts.splice(i, 1);
  },

  // --- grouping ---------------------------------------------------------

  group(data) {
    const today = this.todayISO();
    const pending = data.workouts.filter((w) => !w.done);

    return {
      overdue: pending.filter((w) => w.date < today).sort((a, b) => (a.date < b.date ? 1 : -1)),
      upcoming: pending.filter((w) => w.date >= today).sort((a, b) => (a.date > b.date ? 1 : -1)),
      completed: data.workouts.filter((w) => w.done).sort((a, b) => (a.date < b.date ? 1 : -1))
    };
  },

  // --- rendering --------------------------------------------------------

  exerciseLine(ex) {
    const bits = [];
    if (ex.sets && ex.reps) bits.push(`${ex.sets} × ${ex.reps}`);
    else if (ex.reps) bits.push(`${ex.reps} reps`);
    if (ex.weight) bits.push(`${this.formatWeight(ex.weight)} kg`);

    return `<li class="ex-row">
        <span class="ex-name">${this.escape(ex.name)}</span>
        <span class="ex-detail">${bits.join(' · ')}</span>
      </li>`;
  },

  workoutCardHtml(workout, status) {
    const exercises = workout.exercises.length
      ? `<ul class="ex-list">${workout.exercises.map((e) => this.exerciseLine(e)).join('')}</ul>`
      : '<p class="empty-state">No exercises listed.</p>';

    const badgeClass = status === 'overdue' ? ' is-overdue' : '';
    const badge = status === 'overdue'
      ? `Missed · ${this.formatDate(workout.date)}`
      : this.dateLabel(workout.date);

    return `
      <div class="card workout-card${workout.done ? ' is-done' : ''}" data-workout-id="${workout.id}">
        <div class="workout-head">
          <h3 class="workout-name">${this.escape(workout.name)}</h3>
          <span class="workout-date${badgeClass}">${badge}</span>
        </div>

        ${exercises}

        <div class="workout-actions">
          <button class="btn btn-small" data-action="${workout.done ? 'undo' : 'done'}">
            ${workout.done ? 'Reopen' : '✓ Mark done'}
          </button>
          <button class="btn btn-ghost btn-small btn-danger" data-action="delete">Delete</button>
        </div>
      </div>`;
  },

  render(data) {
    const container = document.getElementById('workouts-container');
    if (!container) return;

    const groups = this.group(data);

    if (!data.workouts.length) {
      container.innerHTML =
        '<div class="card"><p class="empty-state">Nothing scheduled yet. Tap <strong>+ Add</strong> to plan a session.</p></div>';
      return;
    }

    const section = (title, list, status) => {
      if (!list.length) return '';
      return `<h3 class="group-title">${title}</h3>${
        list.map((w) => this.workoutCardHtml(w, status)).join('')}`;
    };

    container.innerHTML =
      section('Missed', groups.overdue, 'overdue') +
      section('Upcoming', groups.upcoming, 'upcoming') +
      section('Completed', groups.completed, 'completed');
  },

  // --- add form ---------------------------------------------------------

  exerciseRowHtml() {
    return `
      <div class="exercise-row">
        <div class="form-row">
          <input type="text" data-role="ex-name" placeholder="Exercise" maxlength="40" autocomplete="off" />
          <button type="button" class="btn btn-ghost btn-small btn-danger" data-action="remove-exercise"
                  aria-label="Remove exercise">×</button>
        </div>
        <div class="form-row">
          <input type="number" data-role="ex-sets" placeholder="Sets" min="1" step="1" />
          <input type="number" data-role="ex-reps" placeholder="Reps" min="1" step="1" />
          <input type="number" data-role="ex-weight" placeholder="kg" min="0" step="0.5" />
        </div>
      </div>`;
  },

  // Reads the exercise rows. Blank rows are ignored; partly filled rows error.
  collectExercises(wrap) {
    const exercises = [];

    for (const row of wrap.querySelectorAll('.exercise-row')) {
      const name = row.querySelector('[data-role="ex-name"]').value.trim();
      const setsRaw = row.querySelector('[data-role="ex-sets"]').value;
      const repsRaw = row.querySelector('[data-role="ex-reps"]').value;
      const weightRaw = row.querySelector('[data-role="ex-weight"]').value;

      if (!name && !setsRaw && !repsRaw && !weightRaw) continue;

      if (!name) return { error: 'Every exercise needs a name.' };

      const sets = setsRaw ? parseInt(setsRaw, 10) : null;
      const reps = repsRaw ? parseInt(repsRaw, 10) : null;
      const weight = weightRaw ? parseFloat(weightRaw) : null;

      if (setsRaw && (Number.isNaN(sets) || sets < 1)) return { error: `"${name}": sets must be at least 1.` };
      if (repsRaw && (Number.isNaN(reps) || reps < 1)) return { error: `"${name}": reps must be at least 1.` };
      if (weightRaw && (Number.isNaN(weight) || weight < 0)) return { error: `"${name}": weight can't be negative.` };

      exercises.push({ name: name, sets: sets, reps: reps, weight: weight });
    }

    return { exercises: exercises };
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
    const toggle = document.getElementById('add-workout-toggle');
    const form = document.getElementById('add-workout-form');
    const cancel = document.getElementById('cancel-workout-btn');
    const nameInput = document.getElementById('new-workout-name');
    const dateInput = document.getElementById('new-workout-date');
    const rowsWrap = document.getElementById('exercise-rows');
    const addRowBtn = document.getElementById('add-exercise-row');
    const errorEl = document.getElementById('add-workout-error');
    if (!toggle) return;

    const resetForm = () => {
      form.reset();
      rowsWrap.innerHTML = this.exerciseRowHtml();
      dateInput.value = this.todayISO();
      this.clearError(errorEl);
    };

    const closeForm = () => {
      form.classList.add('hidden');
      resetForm();
    };

    resetForm();

    toggle.addEventListener('click', () => {
      form.classList.toggle('hidden');
      if (!form.classList.contains('hidden')) nameInput.focus();
    });

    cancel.addEventListener('click', closeForm);

    // Don't leave a stale message up while the user is fixing the problem.
    form.addEventListener('input', () => this.clearError(errorEl));

    addRowBtn.addEventListener('click', () => {
      rowsWrap.insertAdjacentHTML('beforeend', this.exerciseRowHtml());
    });

    rowsWrap.addEventListener('click', (e) => {
      if (!e.target.closest('[data-action="remove-exercise"]')) return;
      const rows = rowsWrap.querySelectorAll('.exercise-row');
      if (rows.length === 1) {
        rowsWrap.innerHTML = this.exerciseRowHtml();   // keep one blank row
      } else {
        e.target.closest('.exercise-row').remove();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      if (!name) return this.showError(errorEl, 'Give the workout a name.');
      if (!dateInput.value) return this.showError(errorEl, 'Pick a date.');

      const collected = this.collectExercises(rowsWrap);
      if (collected.error) return this.showError(errorEl, collected.error);

      this.addWorkout(App.data, name, dateInput.value, collected.exercises);
      App.save();
      App.renderAll();
      closeForm();
    });

    // Delegated actions on the rendered workout cards.
    const container = document.getElementById('workouts-container');

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const card = btn.closest('.workout-card');
      const id = card.dataset.workoutId;
      const action = btn.dataset.action;

      if (action === 'done' || action === 'undo') {
        this.setDone(App.data, id, action === 'done');
        App.save();
        App.renderAll();
      }

      if (action === 'delete') {
        const w = App.data.workouts.find((x) => x.id === id);
        if (confirm(`Delete "${w.name}"?`)) {
          this.removeWorkout(App.data, id);
          App.save();
          App.renderAll();
        }
      }
    });
  }
};
