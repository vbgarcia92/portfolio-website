// 75 Hard module: daily checklist, day counter, and miss/reset logic.
//
// Rules encoded here:
//   - Six tasks per day; all six must be ticked for the day to count.
//   - A day can only fail once it is over. Today is never failed early.
//   - Any gap or incomplete day before today resets the challenge to Day 1.
//   - 75 complete days finishes the challenge.

const SeventyFive = {

  TOTAL_DAYS: 75,

  // Tailored rather than stock 75 Hard: the second workout is an IT study
  // block, and the diet rule is protein plus creatine.
  TASKS: [
    { key: 'workout1', label: 'Workout',         detail: '45 minutes' },
    { key: 'itStudy',  label: 'IT study',        detail: '45 minutes' },
    { key: 'diet',     label: 'Follow diet',     detail: '160 g protein + creatine' },
    { key: 'water',    label: 'Drink water',     detail: '3.8 L' },
    { key: 'reading',  label: 'Read',            detail: '10 pages, non-fiction' },
    { key: 'photo',    label: 'Progress photo',  detail: 'Taken today' }
  ],

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
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
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

  findDay(s, date) {
    return s.days.find((d) => d.date === date) || null;
  },

  isComplete(day) {
    return this.TASKS.every((t) => day.tasks[t.key] === true);
  },

  // --- lifecycle --------------------------------------------------------

  start(data, date) {
    const s = data.seventyFive;
    s.startDate = date;
    s.currentDay = 1;
    s.failed = false;
    s.days = [this.newDay(date)];
  },

  // Restart at Day 1, recording which day broke the streak so the UI can
  // explain the reset rather than silently wiping progress.
  resetToDayOne(data, missedDate, missedDayNumber) {
    const today = this.todayISO();
    data.seventyFive = {
      startDate: today,
      currentDay: 1,
      failed: true,
      failedInfo: { date: missedDate, day: missedDayNumber },
      days: [this.newDay(today)]
    };
  },

  completedCount(s) {
    return s.days.filter((d) => d.complete).length;
  },

  // Brings stored state in line with the current date. Returns a status
  // describing what the UI should show. Mutates + reports whether it saved.
  sync(data) {
    const s = data.seventyFive;
    const today = this.todayISO();

    if (!s.startDate) return { status: 'not-started', changed: false };

    // Clock moved backwards (timezone/manual change) — leave state alone.
    if (this.dayDiff(s.startDate, today) < 0) {
      return { status: 'active', changed: false };
    }

    if (this.completedCount(s) >= this.TOTAL_DAYS) {
      return { status: 'finished', changed: false };
    }

    // Every day before today must exist and be complete.
    for (let cursor = s.startDate; cursor !== today; cursor = this.addDays(cursor, 1)) {
      const record = this.findDay(s, cursor);
      if (!record || !record.complete) {
        const missedDay = this.dayDiff(s.startDate, cursor) + 1;
        this.resetToDayOne(data, cursor, missedDay);
        return { status: 'reset', changed: true };
      }
    }

    // Streak intact — make sure today has a record.
    let changed = false;
    if (!this.findDay(s, today)) {
      s.days.push(this.newDay(today));
      changed = true;
    }

    const day = this.dayDiff(s.startDate, today) + 1;
    if (s.currentDay !== day) {
      s.currentDay = day;
      changed = true;
    }

    return { status: 'active', changed: changed };
  },

  toggleTask(data, taskKey, value) {
    const s = data.seventyFive;
    const today = this.todayISO();
    const day = this.findDay(s, today);
    if (!day) return;

    day.tasks[taskKey] = value;
    day.complete = this.isComplete(day);
  },

  // --- rendering --------------------------------------------------------

  render(data) {
    const result = this.sync(data);
    // sync() can advance the day or trigger a reset — persist that immediately.
    if (result.changed && this._app) this._app.save();

    // Read state *after* sync: a reset swaps in a whole new seventyFive object.
    this.renderCounter(data, result.status);
    this.renderBanner(data.seventyFive, result.status);
    this.renderChecklist(data, result.status);
  },

  renderCounter(data, status) {
    const s = data.seventyFive;
    const numberEl = document.getElementById('day-number');
    const subEl = document.getElementById('day-sub');
    const barEl = document.getElementById('day-progress-bar');
    if (!numberEl) return;

    const done = this.completedCount(s);

    if (status === 'not-started') {
      numberEl.textContent = '—';
      subEl.textContent = 'Not started';
    } else if (status === 'finished') {
      numberEl.textContent = '75';
      subEl.textContent = 'Challenge complete 🎉';
    } else {
      const today = this.findDay(s, this.todayISO());
      const ticked = today
        ? this.TASKS.filter((t) => today.tasks[t.key]).length
        : 0;
      numberEl.textContent = `Day ${s.currentDay}`;
      subEl.textContent = today && today.complete
        ? `Day complete · ${done} of 75 done`
        : `${ticked} of 6 tasks today · ${done} of 75 done`;
    }

    if (barEl) {
      barEl.style.width = `${Math.min(100, (done / this.TOTAL_DAYS) * 100)}%`;
    }
  },

  renderBanner(s, status) {
    const banner = document.getElementById('reset-banner');
    const text = document.getElementById('reset-banner-text');
    if (!banner) return;

    if (s.failed && s.failedInfo) {
      text.textContent =
        `Day ${s.failedInfo.day} (${this.formatDate(s.failedInfo.date)}) wasn't completed. Back to Day 1.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  },

  renderChecklist(data, status) {
    const container = document.getElementById('checklist-container');
    if (!container) return;

    if (status === 'not-started') {
      container.innerHTML = `
        <p class="empty-state">Ready when you are — 75 days, six tasks a day.</p>
        <button id="start-75-btn" class="btn btn-primary">Start Day 1</button>`;
      return;
    }

    if (status === 'finished') {
      container.innerHTML =
        '<p class="empty-state">All 75 days complete. Outstanding.</p>';
      return;
    }

    const s = data.seventyFive;
    const day = this.findDay(s, this.todayISO());
    if (!day) return;

    // Update in place when the rows already exist, so ticking a box doesn't
    // rebuild the DOM and throw away keyboard focus.
    if (container.querySelector('.task-list')) {
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

    container.addEventListener('click', (e) => {
      if (!e.target.closest('#start-75-btn')) return;
      this.start(App.data, this.todayISO());
      App.save();
      App.renderAll();
    });

    const dismiss = document.getElementById('reset-banner-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', () => {
        App.data.seventyFive.failed = false;
        delete App.data.seventyFive.failedInfo;
        App.save();
        App.renderAll();
      });
    }
  }
};
