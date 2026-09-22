// 90 Day Challenge module: daily checklist, day counter, and a consistency
// dashboard broken down per habit.
//
// Rules encoded here:
//   - Fixed start date; the challenge runs for 90 days from there.
//   - Six tasks a day; all six ticked marks the day complete.
//   - Nothing ever resets. Missing a task costs that day's tick and nothing
//     else, which is why the per-task percentages below are the real score:
//     they show how consistent each individual habit has actually been.
//   - Any day that has already begun stays editable, so an evening session
//     logged the next morning still lands on the day it belongs to.

const Challenge = {

  TOTAL_DAYS: 90,
  START_DATE: '2026-09-22',

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

  WEEKDAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

  // Which day the checklist is pointed at. Null means "follow today", so a
  // reload always opens on today no matter how far back you browsed.
  _selectedDay: null,

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

  formatDayLabel(iso) {
    const weekday = this.WEEKDAYS[new Date(this.toUtc(iso)).getUTCDay()];
    return `${weekday} ${this.formatShort(iso)}`;
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

  // The day the checklist is currently pointed at, clamped to the days that
  // actually exist. `latest` is today while the challenge runs, and day 90
  // once it is over.
  selectedDay(result) {
    const latest = result.elapsedDays;
    if (latest < 1) return 0;
    const n = this._selectedDay === null ? latest : this._selectedDay;
    return Math.min(Math.max(n, 1), latest);
  },

  // Landing back on the latest day clears the pin, so an app left open
  // overnight rolls onto the new day by itself.
  selectDay(n, result) {
    this._selectedDay = n >= result.elapsedDays ? null : Math.max(1, n);
  },

  toggleTask(data, dayNumber, taskKey, value) {
    const day = this.dayAt(data.challenge, dayNumber);
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
    const selected = this.selectedDay(result);

    this.renderCounter(data, result, stats);
    this.renderNav(result, selected);
    this.renderChecklist(data, result, selected);
    this.renderConsistency(result, stats, selected);
  },

  // The counter always reports today, even while the checklist below it is
  // pointed at an earlier day.
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

  // Arrows for stepping back through days already logged. Nothing to steer
  // before the challenge starts, so the whole strip stays hidden.
  renderNav(result, selected) {
    const nav = document.getElementById('day-nav');
    if (!nav) return;

    if (result.status === 'upcoming') {
      nav.classList.add('hidden');
      return;
    }
    nav.classList.remove('hidden');

    // Built once, then updated in place: rebuilding the markup on every tap
    // would drop focus off the arrow being pressed.
    if (!nav.querySelector('.day-nav-row')) {
      nav.innerHTML = `
        <div class="day-nav-row">
          <button type="button" class="day-nav-btn" data-nav="prev"
                  aria-label="Previous day">&lsaquo;</button>
          <div class="day-nav-mid">
            <span class="day-nav-day"></span>
            <span class="day-nav-date"></span>
          </div>
          <button type="button" class="day-nav-btn" data-nav="next"
                  aria-label="Next day">&rsaquo;</button>
        </div>
        <div class="past-note hidden">
          <span>Catching up on an earlier day</span>
          <button type="button" class="btn btn-ghost btn-small" data-nav="latest"></button>
        </div>`;
    }

    const date = this.addDays(this.START_DATE, selected - 1);
    // How long ago the open day was is measured against the real today; how
    // far the arrows can go is measured against the last editable day. Once
    // the challenge is over those are different days.
    const behind = result.dayNumber - selected;
    const atLatest = selected >= result.elapsedDays;
    const latest = result.status === 'finished' ? 'day 90' : 'today';
    const when = behind === 0 ? 'Today'
      : behind === 1 ? 'Yesterday'
      : `${behind} days ago`;

    nav.querySelector('.day-nav-day').textContent = `Day ${selected}`;
    nav.querySelector('.day-nav-date').textContent =
      `${this.formatDayLabel(date)} · ${when}`;
    nav.querySelector('[data-nav="prev"]').disabled = selected <= 1;
    nav.querySelector('[data-nav="next"]').disabled = atLatest;
    nav.querySelector('[data-nav="latest"]').textContent = `Back to ${latest}`;
    nav.querySelector('.past-note').classList.toggle('hidden', atLatest);
  },

  renderChecklist(data, result, selected) {
    const container = document.getElementById('checklist-container');
    if (!container) return;

    if (result.status === 'upcoming') {
      container.innerHTML = `
        <p class="empty-state">Kicks off ${this.formatDate(this.START_DATE)}. Six habits,
           every day, for 90 days — nothing resets if you slip.</p>
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

    const day = this.dayAt(data.challenge, selected);
    if (!day) return;

    // Update in place when the rows already exist, so ticking a box — or
    // stepping to another day — doesn't rebuild the DOM and throw away focus.
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
  renderConsistency(result, stats, selected) {
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
      <div class="day-grid">${this.gridCells(result, stats, selected)}</div>
      <p class="stat-caption grid-caption">
        One square per day, shaded by tasks completed. Tap one to edit it.
      </p>`;
  },

  gridCells(result, stats, selected) {
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
      const label = `Day ${n} · ${this.formatDate(date)} · ${ticked} of 6`;
      const selectedClass = n === selected ? ' is-selected' : '';
      cells.push(
        `<button type="button" class="grid-cell lvl-${level}${selectedClass}" ` +
        `data-day="${n}" title="${label}" aria-label="${label}"></button>`);
    }
    return cells.join('');
  },

  // --- events -----------------------------------------------------------

  bindEvents(App) {
    this._app = App;

    const container = document.getElementById('checklist-container');
    if (container) {
      container.addEventListener('change', (e) => {
        const box = e.target.closest('[data-task]');
        if (!box) return;
        const result = this.sync(App.data);
        this.toggleTask(App.data, this.selectedDay(result), box.dataset.task, box.checked);
        App.save();
        App.renderAll();
      });
    }

    const nav = document.getElementById('day-nav');
    if (nav) {
      nav.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-nav]');
        if (!btn) return;
        const result = this.sync(App.data);
        const current = this.selectedDay(result);

        if (btn.dataset.nav === 'prev') this.selectDay(current - 1, result);
        else if (btn.dataset.nav === 'next') this.selectDay(current + 1, result);
        else this._selectedDay = null;

        App.renderAll();
      });
    }

    const consistency = document.getElementById('consistency-container');
    if (consistency) {
      consistency.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-day]');
        if (!cell) return;
        this.selectDay(Number(cell.dataset.day), this.sync(App.data));
        App.renderAll();
        // The checklist is above the grid — bring it back into view.
        if (nav) nav.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }
};
