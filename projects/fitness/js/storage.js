// Data persistence layer: single JSON blob in localStorage.

const STORAGE_KEY = 'fitnessTracker:v1';

function defaultData() {
  return {
    schemaVersion: 1,
    lifts: [],
    workouts: [],
    seventyFive: {
      startDate: null,
      currentDay: 0,
      failed: false,
      days: []
    },
    diet: {
      targetProtein: 170,
      days: []
    },
    program: null,
    programProgress: {}
  };
}

// Renamed 75 Hard task keys, carried across so days already logged under the
// old name stay complete. Without this a finished day would read as unfinished
// and the miss check would reset the streak to Day 1.
const RENAMED_TASKS = { workout2Outdoor: 'itStudy' };

function migrate(data) {
  let changed = false;

  (data.seventyFive && data.seventyFive.days || []).forEach((day) => {
    if (!day.tasks) return;
    Object.entries(RENAMED_TASKS).forEach(([oldKey, newKey]) => {
      if (!(oldKey in day.tasks)) return;
      if (!(newKey in day.tasks)) day.tasks[newKey] = day.tasks[oldKey];
      delete day.tasks[oldKey];
      changed = true;
    });
  });

  return changed;
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);
    const data = { ...defaultData(), ...parsed };
    if (migrate(data)) saveData(data);
    return data;
  } catch (err) {
    console.error('Corrupt fitness tracker data, resetting to defaults.', err);
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
