// Program module: import a training plan as JSON, walk it day by day, and log
// what actually happened in the gym.
//
// The imported plan is stored verbatim under `data.program` and treated as
// read-only. Everything the athlete logs lives separately in
// `data.programProgress`, keyed by item, so re-importing a corrected plan
// never wipes logged work.

const Program = {

  // --- storage keys -----------------------------------------------------

  // Stable identity for one item within the whole plan.
  itemKey(session, section, itemIndex) {
    return `${session.id}::${section.label}::${itemIndex}`;
  },

  entry(data, key) {
    return data.programProgress[key] || null;
  },

  ensureEntry(data, key) {
    if (!data.programProgress[key]) data.programProgress[key] = { done: false };
    return data.programProgress[key];
  },

  // --- date helpers -----------------------------------------------------

  todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  shortDate(iso) {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  // --- plan traversal ---------------------------------------------------

  weeks(program) {
    if (!program || !program.blocks) return [];
    return program.blocks.flatMap((b) => b.weeks || []);
  },

  allDays(program) {
    return this.weeks(program).flatMap((w) => w.days || []);
  },

  weekContaining(program, date) {
    return this.weeks(program).find((w) => (w.days || []).some((d) => d.date === date)) || null;
  },

  dayByDate(program, date) {
    return this.allDays(program).find((d) => d.date === date) || null;
  },

  // Today if the plan covers it, otherwise the first day of the plan.
  defaultDate(program) {
    const today = this.todayISO();
    if (this.dayByDate(program, today)) return today;
    const days = this.allDays(program);
    return days.length ? days[0].date : null;
  },

  sectionsOf(day) {
    if (!day) return [];
    return (day.sessions || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .flatMap((session) => (session.sections || []).map((section) => ({ session, section })));
  },

  // --- progress ---------------------------------------------------------

  dayStats(data, day) {
    let total = 0;
    let done = 0;

    this.sectionsOf(day).forEach(({ session, section }) => {
      (section.items || []).forEach((item, i) => {
        total++;
        const e = this.entry(data, this.itemKey(session, section, i));
        if (e && e.done) done++;
      });
    });

    return { total: total, done: done, complete: total > 0 && done === total };
  },

  sectionStats(data, session, section) {
    const items = section.items || [];
    const done = items.filter((_, i) => {
      const e = this.entry(data, this.itemKey(session, section, i));
      return e && e.done;
    }).length;
    return { total: items.length, done: done };
  },

  // --- prescription formatting -----------------------------------------

  // Turns the item's sets/reps/duration/tempo into one readable line.
  prescription(item) {
    const bits = [];

    if (item.sets && item.reps) bits.push(`${item.sets} × ${item.reps}`);
    else if (item.sets && item.duration) bits.push(`${item.sets} × ${item.duration}`);
    else if (item.sets) bits.push(`${item.sets} sets`);
    else if (item.reps) bits.push(`${item.reps} reps`);

    if (!item.sets && item.duration) bits.push(item.duration);
    else if (item.sets && item.reps && item.duration) bits.push(item.duration);

    if (item.perSide) bits.push('each side');
    if (item.tempo) bits.push(`tempo ${item.tempo}`);
    if (item.restSec) bits.push(`rest ${item.restSec}s`);

    const load = item.load;
    if (load && load.startingSuggestionKg) bits.push(`start ~${load.startingSuggestionKg} kg`);
    else if (load && load.progressionFromPreviousWeekKg) {
      bits.push(`+${load.progressionFromPreviousWeekKg} kg on last week`);
    }
    if (load && load.rpe) bits.push(`RPE ${load.rpe}`);

    return bits.join(' · ');
  },

  // What to show for each trackingField the plan asks for.
  FIELD_SPECS: {
    loadKg:        { label: 'kg',    type: 'number', step: '0.5', min: '0' },
    addedLoadKg:   { label: '+kg',   type: 'number', step: '0.5', min: '0' },
    repsCompleted: { label: 'reps',  type: 'number', step: '1',   min: '0' },
    repsPerSet:    { label: 'reps/set', type: 'text' },
    rpe:           { label: 'RPE',   type: 'number', step: '0.5', min: '0', max: '10' },
    holdSeconds:   { label: 'sec',   type: 'number', step: '1',   min: '0' },
    bodyweightKg:  { label: 'kg',    type: 'number', step: '0.1', min: '0' },
    boolean:       null   // the tick itself is the record
  },

  trackedFields(item) {
    return (item.trackingFields || []).filter((f) => this.FIELD_SPECS[f]);
  },

  // --- rendering --------------------------------------------------------

  render(data) {
    const wrap = document.getElementById('program-container');
    if (!wrap) return;

    if (!data.program) {
      wrap.innerHTML = `
        <div class="card">
          <p class="empty-state">No program loaded. Import a plan below to see your
          sessions here.</p>
        </div>`;
      this.renderTimeline(data);
      return;
    }

    if (!this.selectedDate || !this.dayByDate(data.program, this.selectedDate)) {
      this.selectedDate = this.defaultDate(data.program);
    }

    this.renderTimeline(data);
    this.renderDay(data);
  },

  renderTimeline(data) {
    const bar = document.getElementById('program-timeline');
    if (!bar) return;

    if (!data.program) {
      bar.innerHTML = '';
      return;
    }

    const week = this.weekContaining(data.program, this.selectedDate);
    if (!week) { bar.innerHTML = ''; return; }

    const today = this.todayISO();
    const weekList = this.weeks(data.program);
    const idx = weekList.indexOf(week);

    const chips = (week.days || []).map((day) => {
      const stats = this.dayStats(data, day);
      const classes = [
        'day-chip',
        day.date === this.selectedDate ? 'is-selected' : '',
        day.date === today ? 'is-today' : '',
        stats.complete ? 'is-complete' : '',
        day.isRestDay ? 'is-rest' : ''
      ].filter(Boolean).join(' ');

      return `
        <button class="${classes}" data-date="${day.date}">
          <span class="chip-dow">${this.escape((day.dayOfWeek || '').slice(0, 3))}</span>
          <span class="chip-date">${this.shortDate(day.date)}</span>
          <span class="chip-meter">${
            day.isRestDay ? '·' : `${stats.done}/${stats.total}`
          }</span>
        </button>`;
    }).join('');

    bar.innerHTML = `
      <div class="week-head">
        <button class="week-nav" data-week-step="-1" ${idx <= 0 ? 'disabled' : ''}
                aria-label="Previous week">‹</button>
        <div class="week-label">
          <span class="week-name">Week ${week.weekNumber}</span>
          <span class="week-scheme">${this.escape(week.mainLiftScheme || '')}</span>
        </div>
        <button class="week-nav" data-week-step="1" ${idx >= weekList.length - 1 ? 'disabled' : ''}
                aria-label="Next week">›</button>
      </div>
      <div class="day-strip">${chips}</div>
      ${week.focus ? `<p class="week-focus">${this.escape(week.focus)}</p>` : ''}`;

    // A mid-week day can sit outside the visible strip — bring it into view.
    const selected = bar.querySelector('.day-chip.is-selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  },

  renderDay(data) {
    const wrap = document.getElementById('program-container');
    const day = this.dayByDate(data.program, this.selectedDate);
    if (!day) { wrap.innerHTML = ''; return; }

    const stats = this.dayStats(data, day);
    const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

    const header = `
      <div class="card day-header">
        <div class="day-title-row">
          <h2 class="day-title">${this.escape(day.title || '')}</h2>
          ${day.isRestDay ? '<span class="rest-tag">Rest</span>' : ''}
        </div>
        <p class="day-meta">${this.escape(day.dayOfWeek || '')} · ${this.shortDate(day.date)}</p>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <p class="day-progress">${stats.done} of ${stats.total} done${
          stats.complete ? ' — session complete 🎉' : ''}</p>
        ${day.notes ? `<p class="day-note">${this.escape(day.notes)}</p>` : ''}
      </div>`;

    const sessions = (day.sessions || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((session) => this.sessionHtml(data, session))
      .join('');

    wrap.innerHTML = header + sessions;
  },

  sessionHtml(data, session) {
    const sections = (session.sections || [])
      .map((section) => this.sectionHtml(data, session, section))
      .join('');

    const meta = [
      session.durationMin ? `${session.durationMin} min` : '',
      session.effortCap ? `cap ${session.effortCap}` : ''
    ].filter(Boolean).join(' · ');

    return `
      <div class="session-block">
        <div class="session-head">
          <h3 class="session-name">${this.escape(session.name || '')}</h3>
          ${meta ? `<span class="session-meta">${this.escape(meta)}</span>` : ''}
        </div>
        ${session.timing ? `<p class="session-timing">${this.escape(session.timing)}</p>` : ''}
        ${sections}
      </div>`;
  },

  sectionHtml(data, session, section) {
    const stats = this.sectionStats(data, session, section);
    const items = (section.items || [])
      .map((item, i) => this.itemHtml(data, session, section, item, i))
      .join('');

    return `
      <div class="card section-card${section.priority === 'optional' ? ' is-optional' : ''}">
        <div class="section-head">
          ${section.label ? `<span class="section-label">${this.escape(section.label)}</span>` : ''}
          <h4 class="section-name">${this.escape(section.name || '')}</h4>
          <span class="section-count">${stats.done}/${stats.total}</span>
        </div>
        ${section.priority === 'optional'
          ? '<span class="optional-tag">Optional — cut this first</span>' : ''}
        ${section.notes ? `<p class="section-note">${this.escape(section.notes)}</p>` : ''}
        <ul class="prog-item-list">${items}</ul>
      </div>`;
  },

  itemHtml(data, session, section, item, index) {
    const key = this.itemKey(session, section, index);
    const rec = this.entry(data, key) || {};
    const presc = this.prescription(item);
    const fields = this.trackedFields(item);

    const inputs = fields.length
      ? `<div class="track-row">${fields.map((f) => {
          const spec = this.FIELD_SPECS[f];
          const attrs = [
            `type="${spec.type}"`,
            spec.step ? `step="${spec.step}"` : '',
            spec.min !== undefined ? `min="${spec.min}"` : '',
            spec.max !== undefined ? `max="${spec.max}"` : ''
          ].filter(Boolean).join(' ');
          const val = rec[f] !== undefined && rec[f] !== null ? String(rec[f]) : '';
          return `
            <label class="track-field">
              <span class="track-label">${spec.label}</span>
              <input ${attrs} data-key="${key}" data-field="${f}"
                     value="${this.escape(val)}" placeholder="–" />
            </label>`;
        }).join('')}</div>`
      : '';

    return `
      <li class="prog-item${rec.done ? ' is-done' : ''}">
        <label class="prog-check">
          <input type="checkbox" data-key="${key}" data-toggle="done" ${rec.done ? 'checked' : ''} />
          <span class="check-circle" aria-hidden="true"></span>
          <span class="prog-text">
            <span class="prog-name">${this.escape(item.name || '')}</span>
            ${presc ? `<span class="prog-presc">${this.escape(presc)}</span>` : ''}
          </span>
        </label>
        ${item.notes ? `<p class="prog-note">${this.escape(item.notes)}</p>` : ''}
        ${item.scaling ? `<p class="prog-scaling">Scale: ${this.escape(item.scaling)}</p>` : ''}
        ${inputs}
      </li>`;
  },

  // --- import -----------------------------------------------------------

  // Confirms the file really is a plan in the expected shape before it
  // replaces whatever is already loaded.
  validate(parsed) {
    if (!parsed || typeof parsed !== 'object') return 'That file is not a JSON object.';
    if (!parsed.program || !parsed.program.name) return 'Missing a "program" object with a name.';
    if (!Array.isArray(parsed.blocks) || !parsed.blocks.length) return 'Missing a "blocks" array.';

    const weeks = parsed.blocks.flatMap((b) => b.weeks || []);
    if (!weeks.length) return 'No weeks found inside the blocks.';

    const days = weeks.flatMap((w) => w.days || []);
    if (!days.length) return 'No days found inside the weeks.';
    if (!days.every((d) => d.date)) return 'Every day needs a "date".';

    const sessions = days.flatMap((d) => d.sessions || []);
    if (!sessions.every((s) => s.id)) return 'Every session needs an "id".';

    return null;
  },

  summarise(parsed) {
    const weeks = parsed.blocks.flatMap((b) => b.weeks || []);
    const days = weeks.flatMap((w) => w.days || []);
    const items = days
      .flatMap((d) => d.sessions || [])
      .flatMap((s) => s.sections || [])
      .flatMap((sec) => sec.items || []);
    return { weeks: weeks.length, days: days.length, items: items.length };
  },

  importJson(data, text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { error: 'That file is not valid JSON.' };
    }

    const problem = this.validate(parsed);
    if (problem) return { error: problem };

    data.program = parsed;
    this.selectedDate = this.defaultDate(parsed);
    return { summary: this.summarise(parsed) };
  },

  clear(data) {
    data.program = null;
    data.programProgress = {};
    this.selectedDate = null;
  },

  // --- events -----------------------------------------------------------

  bindEvents(App) {
    this._app = App;

    const fileInput = document.getElementById('program-file');
    const status = document.getElementById('import-status');
    const clearBtn = document.getElementById('clear-program-btn');
    const timeline = document.getElementById('program-timeline');
    const container = document.getElementById('program-container');
    if (!fileInput || !container) return;

    const say = (message, isError) => {
      status.textContent = message;
      status.classList.toggle('is-error', !!isError);
      status.classList.remove('hidden');
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onerror = () => say('Could not read that file.', true);
      reader.onload = () => {
        const result = this.importJson(App.data, String(reader.result));
        fileInput.value = '';   // let the same file be picked again

        if (result.error) return say(result.error, true);

        App.save();
        App.renderAll();
        say(`Imported "${App.data.program.program.name}" — ${result.summary.weeks} weeks, ` +
            `${result.summary.days} days, ${result.summary.items} items.`, false);
      };
      reader.readAsText(file);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!App.data.program) return;
        if (!confirm('Remove the loaded program and everything you logged against it?')) return;
        this.clear(App.data);
        App.save();
        App.renderAll();
        say('Program cleared.', false);
      });
    }

    if (timeline) {
      timeline.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-date]');
        if (chip) {
          this.selectedDate = chip.dataset.date;
          this.render(App.data);
          return;
        }

        const nav = e.target.closest('[data-week-step]');
        if (!nav || nav.disabled) return;

        const weekList = this.weeks(App.data.program);
        const current = this.weekContaining(App.data.program, this.selectedDate);
        const next = weekList[weekList.indexOf(current) + Number(nav.dataset.weekStep)];
        if (!next || !next.days || !next.days.length) return;

        this.selectedDate = next.days[0].date;
        this.render(App.data);
      });
    }

    // Ticking an item off.
    container.addEventListener('change', (e) => {
      const box = e.target.closest('[data-toggle="done"]');
      if (box) {
        const rec = this.ensureEntry(App.data, box.dataset.key);
        rec.done = box.checked;
        App.save();
        this.render(App.data);
        return;
      }

      const field = e.target.closest('[data-field]');
      if (!field) return;

      const rec = this.ensureEntry(App.data, field.dataset.key);
      const raw = field.value.trim();

      if (raw === '') {
        delete rec[field.dataset.field];
      } else if (field.type === 'number') {
        const n = parseFloat(raw);
        rec[field.dataset.field] = Number.isNaN(n) ? raw : n;
      } else {
        rec[field.dataset.field] = raw;
      }

      App.save();
      // No re-render here: it would steal focus mid-entry.
    });
  }
};
