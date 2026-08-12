// Welcome splash: shows the mascot on load, then hands over to the app.
//
// Dismisses on its own after HOLD_MS, or immediately on tap/click/keypress.
// If the mascot image is missing the overlay still works — it falls back to an
// emoji stand-in rather than showing a broken image.

const Splash = {

  HOLD_MS: 2200,     // how long the splash stays up on its own
  FADE_MS: 400,      // fade-out duration, keep in sync with the CSS transition

  dismissed: false,

  reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  dismiss(splash) {
    if (this.dismissed) return;
    this.dismissed = true;

    splash.classList.add('is-leaving');
    document.body.classList.remove('splash-open');

    window.setTimeout(() => splash.remove(), this.FADE_MS);
  },

  init() {
    const splash = document.getElementById('splash');
    if (!splash) return;

    const img = document.getElementById('mascot-img');

    // Swap in the fallback if the mascot file isn't there yet.
    if (img) {
      img.addEventListener('error', () => splash.classList.add('no-mascot'));
      if (img.complete && img.naturalWidth === 0) splash.classList.add('no-mascot');
    }

    document.body.classList.add('splash-open');

    const hold = this.reducedMotion() ? 900 : this.HOLD_MS;
    const timer = window.setTimeout(() => this.dismiss(splash), hold);

    const skip = () => {
      window.clearTimeout(timer);
      this.dismiss(splash);
    };

    splash.addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
  }
};

document.addEventListener('DOMContentLoaded', () => Splash.init());
