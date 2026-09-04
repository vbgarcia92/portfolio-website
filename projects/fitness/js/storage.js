// Data persistence layer: single JSON blob in localStorage.

const STORAGE_KEY = 'fitnessTracker:v1';

function defaultData() {
  return {
    schemaVersion: 1,
    lifts: [],
    workouts: [],
    challenge: {
      days: []
    },
    diet: {
      targetProtein: 160,
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
    // Any `seventyFive` blob from the old 75 Hard tracker rides along
    // untouched. Its days all predate the 90-day challenge's start date, so
    // there is nothing to carry over — but it is kept rather than deleted.
    const data = { ...defaultData(), ...parsed };
    if (!data.challenge || !Array.isArray(data.challenge.days)) {
      data.challenge = { days: [] };
      saveData(data);
    }
    return data;
  } catch (err) {
    console.error('Corrupt fitness tracker data, resetting to defaults.', err);
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
