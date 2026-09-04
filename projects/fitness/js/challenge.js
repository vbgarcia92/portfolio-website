// 90 Day Challenge module: daily checklist, day counter, and a consistency
// dashboard broken down per habit.
//
// Rules encoded here:
//   - Fixed start date; the challenge runs for 90 days from there.
//   - Six tasks a day; all six ticked marks the day complete.
//   - Nothing ever resets. Missing a task costs that day's tick and nothing
//     else, which is why the per-task percentages below are the real score:
//     they show how consistent each individual habit has actually been.

const Challenge = {

  TOTAL_DAYS: 90,
  START_DATE: '2026-09-07',

  TASKS: [
    { key: 'workout', label: 'Workout',          detail: 'One session' },
    { key: 'water',   label: 'Drink water',      detail: '3 L' },
    { key: 'protein', label: 'Protein',          detail: '160 g' },
    { key: 'reading', label: 'Read',             detail: '10 pages' },
    { key: 'project', label: 'Personal project', detail: '1 hour' },
    { key: 'floss',   label: 'Floss & creatine', detail: 'Both, daily' }
  ],

  MONTHS: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  // --- date helpers (UTC math so DST can't shift day counts) ------------

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

  dayDiff(fromIso, toIso) {
    return Math.round((this.toUtc(toIso) - this.toUtc(fromIso)) / 86400000);
  },

  formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${this.MONTHS[m - 1]} ${y}`;
  },

  formatShort(iso) {
    const [, m, d] = iso.split('-').map(Number);
    return `${d} ${this.MONTHS[m - 1]}`;
  },

  // --- day records ------------------------------------------------------

  emptyTasks() {
    const tasks = {};
    this.TASKS.forEach((t) => { tasks[t.key] = false; });
    return tasks;
  },

  newDay(date) {
    return { date: date, tasks: this.emptyTasks(), complete: false };
  },

  // Day number (1-based) -> its record, or null if that day was never opened.
  dayAt(s, n) {
    const date = this.addDays(this.START_DATE, n - 1);
    return s.days.find((d) => d.date === date) || null;
  },

  isComplete(day) {
    return this.TASKS.every((t) => day.tasks[t.key] === true);
  },

  // --- lifecycle --------------------------------------------------------

  // Brings stored state in line with the current date: every day that has
  // already begun gets a record, so an untouched day counts as a real zero in
  // the dashboard rather than quietly vanishing from the denominator.
  sync(data) {
    const s = data.challenge;
    const today = this.todayISO();
    const dayNumber = this.dayDiff(this.START_DATE, today) + 1;

    if (dayNumber < 1) {
      return {
        status: 'upcoming',
        dayNumber: 0,
        elapsedDays: 0,
        daysUntilStart: this.dayDiff(today, this.START_DATE),
        changed: false
      };
    }

    const elapsedDays = Math.min(dayNumber, this.TOTAL_DAYS);

    let changed = false;
    for (let n = 1; n <= elapsedDays; n++) {
      if (!this.dayAt(s, n)) {
        s.days.push(this.newDay(this.addDays(this.START_DATE, n - 1)));
        changed = true;
      }
    }
    if (changed) s.days.sort((a, b) => a.date.localeCompare(b.date));

    return {
      status: dayNumber > this.TOTAL_DAYS ? 'finished' : 'active',
      dayNumber: dayNumber,
      elapsedDays: elapsedDays,
      changed: changed
    };
  },

  // Tally of how many of the elapsed days each task was ticked on, plus how
  // many days were fully complete.
  stats(data, elapsedDays) {
    const s = data.challenge;
    const perTask = {};
    this.TASKS.forEach((t) => { perTask[t.key] = 0; });

    let completeDays = 0;
    const perDay = [];

    for (let n = 1; n <= elapsedDays; n++) {
      const record = this.dayAt(s, n);
      let ticked = 0;
      if (record) {
        this.TASKS.forEach((t) => {
          if (record.tasks[t.key]) { perTask[t.key]++; ticked++; }
        });
        if (record.complete) completeDays++;
      }
      perDay.push(ticked);
    }

    return { perTask: perTask, completeDays: completeDays, perDay: perDay };
  },

  toggleTask(data, taskKey, value) {
    const day = data.challenge.days.find((d) => d.date === this.todayISO());
    if (!day) return;

    day.tasks[taskKey] = value;
    day.complete = this.isComplete(day);
  },

  // --- rendering --------------------------------------------------------

  render(data) {
    const result = this.sync(data);
    // sync() materialises newly elapsed days — persist that immediately.
    if (result.changed && this._app) this._app.save();

    const stats = this.stats(data, result.elapsedDays);

    this.renderCounter(data, result, stats);
    this.renderChecklist(data, result);
    this.renderConsistency(result, stats);
  },

  renderCounter(data, result, stats) {
    const numberEl = document.getElementById('day-number');
    const subEl = document.getElementById('day-sub');
    const barEl = document.getElementById('day-progress-bar');
    if (!numberEl) return;

    if (result.status === 'upcoming') {
      const days = result.daysUntilStart;
      numberEl.textContent = this.formatShort(this.START_DATE);
      subEl.textContent = days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
    } else if (result.status === 'finished') {
      numberEl.textContent = 'Day 90';
      subEl.textContent =
        `Challenge complete 🎉 · ${stats.completeDays} of 90 perfect days`;
    } else {
      const today = this.dayAt(data.challenge, result.dayNumber);
      const ticked = today
        ? this.TASKS.filter((t) => today.tasks[t.key]).length
        : 0;
      numberEl.textContent = `Day ${result.dayNumber}`;
      subEl.textContent = today && today.complete
        ? `Day complete · ${stats.completeDays} of 90 perfect days`
        : `${ticked} of 6 tasks today · ${stats.completeDays} of 90 perfect days`;
    }

    if (barEl) {
      const pct = (result.elapsedDays / this.TOTAL_DAYS) * 100;
      barEl.style.width = `${Math.min(100, pct)}%`;
    }
  },

  renderChecklist(data, result) {
    const container = document.getElementById('checklist-container');
    if (!container) return;

    if (result.status !== 'active') {
      const intro = result.status === 'upcoming'
        ? `Kicks off ${this.formatDate(this.START_DATE)}. Six habits, every day, for 90 days — nothing resets if you slip.`
        : 'All 90 days are behind you. Nice work.';

      container.innerHTML = `
        <p class="empty-state">${intro}</p>
        <ul class="task-list is-preview">${
          this.TASKS.map((t) => `
            <li class="task-row">
              <span class="task-label">
                <span class="task-box" aria-hidden="true"></span>
                <span class="task-text">
                  <span class="task-name">${t.label}</span>
                  <span class="task-detail">${t.detail}</span>
                </span>
              </span>
            </li>`).join('')
        }</ul>`;
      return;
    }

    const day = this.dayAt(data.challenge, result.dayNumber);
    if (!day) return;

    // Update in place when the rows already exist, so ticking a box doesn't
    // rebuild the DOM and throw away keyboard focus.
    if (container.querySelector('.task-list:not(.is-preview)')) {
      this.TASKS.forEach((t) => {
        const box = container.querySelector(`[data-task="${t.key}"]`);
        if (!box) return;
        box.checked = day.tasks[t.key] === true;
        box.closest('.task-row').classList.toggle('is-done', box.checked);
      });
      return;
    }

    container.innerHTML = `<ul class="task-list">${
      this.TASKS.map((t) => {
        const checked = day.tasks[t.key] ? 'checked' : '';
        return `
          <li class="task-row${day.tasks[t.key] ? ' is-done' : ''}">
            <label class="task-label">
              <input type="checkbox" data-task="${t.key}" ${checked} />
              <span class="task-box" aria-hidden="true"></span>
              <span class="task-text">
                <span class="task-name">${t.label}</span>
                <span class="task-detail">${t.detail}</span>
              </span>
            </label>
          </li>`;
      }).join('')
    }</ul>`;
  },

  // Per-habit completion rate plus a 90-square grid of the whole challenge, so
  // a habit that keeps slipping is obvious at a glance.
  renderConsistency(result, stats) {
    const container = document.getElementById('consistency-container');
    if (!container) return;

    if (result.elapsedDays === 0) {
      container.innerHTML =
        `<p class="empty-state">Tracking begins ${this.formatDate(this.START_DATE)}.</p>`;
      return;
    }

    const total = result.elapsedDays;
    const dayWord = total === 1 ? 'day' : 'days';

    const rows = this.TASKS.map((t) => {
      const done = stats.perTask[t.key];
      const pct = Math.round((done / total) * 100);
      return `
        <li class="stat-row">
          <div class="stat-head">
            <span class="stat-name">${t.label}</span>
            <span class="stat-pct">${pct}%</span>
          </div>
          <div class="stat-track">
            <div class="stat-fill" style="width:${pct}%"></div>
          </div>
          <p class="stat-sub">${done} of ${total} ${dayWord}</p>
        </li>`;
    }).join('');

    container.innerHTML = `
      <p class="stat-caption">Across ${total} ${dayWord} so far</p>
      <ul class="stat-list">${rows}</ul>
      <div class="day-grid">${this.gridCells(result, stats)}</div>
      <p class="stat-caption grid-caption">
        One square per day, shaded by tasks completed.
      </p>`;
  },

  gridCells(result, stats) {
    const cells = [];
    for (let n = 1; n <= this.TOTAL_DAYS; n++) {
      const date = this.addDays(this.START_DATE, n - 1);
      if (n > result.elapsedDays) {
        cells.push(
          `<span class="grid-cell is-future" title="Day ${n} · ${this.formatDate(date)}"></span>`);
        continue;
      }
      const ticked = stats.perDay[n - 1];
      const level = ticked === 0 ? 0 : ticked === 6 ? 4 : ticked >= 5 ? 3 : ticked >= 3 ? 2 : 1;
      const today = n === result.dayNumber ? ' is-today' : '';
      cells.push(
        `<span class="grid-cell lvl-${level}${today}" ` +
        `title="Day ${n} · ${this.formatDate(date)} · ${ticked} of 6"></span>`);
    }
    return cells.join('');
  },

  // --- events -----------------------------------------------------------

  bindEvents(App) {
    this._app = App;

    const container = document.getElementById('checklist-container');
    if (!container) return;

    container.addEventListener('change', (e) => {
      const box = e.target.closest('[data-task]');
      if (!box) return;
      this.toggleTask(App.data, box.dataset.task, box.checked);
      App.save();
      App.renderAll();
    });
  }
};
