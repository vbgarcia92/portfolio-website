// App shell: loads data, wires bottom-nav view switching, boots modules.

const App = (function () {
  const VIEW_TITLES = { home: 'Home', lifts: 'Lifts', workouts: 'Workouts', diet: 'Diet' };

  const api = {
    data: loadData(),

    save() {
      saveData(api.data);
    },

    renderAll() {
      Lifts.render(api.data);
      SeventyFive.render(api.data);
      Workouts.render(api.data);
      Diet.render(api.data);
      Program.render(api.data);
    }
  };

  function showView(viewName) {
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${viewName}`);
    });
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.getElementById('header-title').textContent = VIEW_TITLES[viewName] || '';
  }

  function init() {
    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    });

    Lifts.bind(api);
    SeventyFive.bindEvents(api);
    Workouts.bindEvents(api);
    Diet.bindEvents(api);
    Program.bindEvents(api);

    api.save();
    api.renderAll();
    showView('home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return api;
})();
