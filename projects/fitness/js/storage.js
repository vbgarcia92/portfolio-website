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

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultData(), ...parsed };
  } catch (err) {
    console.error('Corrupt fitness tracker data, resetting to defaults.', err);
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
