const opening = document.getElementById('opening');
const main = document.getElementById('main');
const openButton = document.getElementById('openButton');
const pocket = opening.querySelector('.envelope-pocket');
const petalLayer = document.getElementById('petal-layer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const resetCoverScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pageshow', () => { if (!opened) resetCoverScroll(); });
let gesture = null;
let opened = false;

// Stagger a fixed number of petals so both edges are in motion on arrival.
for (let i = 0; i < 12; i++) {
  const petal = document.createElement('span');
  const side = i % 2 === 0 ? 'left' : 'right';
  petal.className = 'falling-petal';
  petal.style.setProperty(side, (1 + Math.random() * 5) + '%');
  petal.style.setProperty('--duration', (8 + Math.random() * 3) + 's');
  petal.style.setProperty('--delay', (-i * .87) + 's');
  petal.style.setProperty('--size', (8 + Math.random() * 6) + 'px');
  petalLayer.append(petal);
}

function setTearProgress(progress) {
  opening.style.setProperty('--tear-progress', progress);
}

function releaseGesture() {
  gesture = null;
  opening.classList.remove('dragging');
}

const music = document.getElementById('invitationMusic');
const musicToggle = document.getElementById('musicToggle');

function updateMusicButton() {
  musicToggle.hidden = !opened || !!music.error;
  musicToggle.textContent = music.paused || music.ended ? 'Music on' : 'Music off';
}

function startMusic() {
  music.play().catch(updateMusicButton);
}

for (const event of ['playing', 'pause', 'ended', 'error']) {
  music.addEventListener(event, updateMusicButton);
}
musicToggle.addEventListener('click', () => {
  if (music.paused || music.ended) {
    startMusic();
  } else {
    music.pause();
  }
});

function openInvitation() {
  if (opened) return;
  resetCoverScroll();
  opened = true;
  updateMusicButton();
  startMusic();

  const pulled = gesture?.progress || 0;
  if (pulled && !reducedMotion.matches) {
    opening.style.setProperty('--release-time', (900 - 500 * pulled) + 'ms');
    opening.classList.add('from-pull');
  }
  // Commit the finger-driven pose before handing motion back to CSS.
  opening.getBoundingClientRect();
  releaseGesture();
  opening.classList.add('opened');
  if (!pulled) main.classList.add('story-started');
  opening.inert = true;

  const finish = () => {
    opening.hidden = true;
    document.documentElement.classList.remove('invitation-covered');
    resetCoverScroll();
    main.inert = false;
    main.focus({ preventScroll: true });
  };

  if (reducedMotion.matches) {
    finish();
    return;
  }

  const fallback = window.setTimeout(() => {
    pocket.removeEventListener('transitionend', finishOnExit);
    finish();
  }, 1850);

  function finishOnExit(event) {
    if (event.target !== pocket || event.propertyName !== 'transform') return;
    window.clearTimeout(fallback);
    pocket.removeEventListener('transitionend', finishOnExit);
    finish();
  }

  pocket.addEventListener('transitionend', finishOnExit);
}

opening.addEventListener('pointerdown', event => {
  if (opened || gesture || event.button !== 0) return;
  resetCoverScroll();
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
    travel: opening.clientHeight * .64, progress: 0, moved: false };
  opening.classList.add('dragging');
  opening.setPointerCapture(event.pointerId);
});

function followPull(event) {
  const dx = Math.abs(event.clientX - gesture.x);
  const dy = gesture.y - event.clientY;
  if (Math.max(dx, Math.abs(dy)) > 10) gesture.moved = true;
  const progress = Math.min(1, Math.max(dx, dy) / gesture.travel);
  gesture.progress = progress;
  if (reducedMotion.matches) return;

  // Project the hinged tip onto the screen at the finger's current height.
  const degrees = Math.acos(1 - progress) * 180 / Math.PI;
  opening.style.setProperty('--flap-angle', -degrees + 'deg');
  opening.style.setProperty('--seal-rise', -progress * gesture.travel + 'px');
  setTearProgress(progress);
}

opening.addEventListener('pointermove', event => {
  if (event.pointerId === gesture?.id) followPull(event);
});

opening.addEventListener('pointerup', event => {
  if (event.pointerId !== gesture?.id) return;
  followPull(event);
  if (!gesture.moved || gesture.progress * gesture.travel >= Math.min(96, gesture.travel * .2)) {
    openInvitation();
  } else {
    cancelGesture(event);
  }
});

function cancelGesture(event) {
  if (event.pointerId !== gesture?.id) return;
  releaseGesture();
  opening.style.removeProperty('--flap-angle');
  opening.style.removeProperty('--seal-rise');
  setTearProgress(0);
}

opening.addEventListener('pointercancel', cancelGesture);
opening.addEventListener('lostpointercapture', cancelGesture);
openButton.addEventListener('click', openInvitation);

if ('IntersectionObserver' in window) {
  const skyObserver = new IntersectionObserver(([entry]) => {
    entry.target.classList.toggle('is-visible', entry.isIntersecting);
  });
  skyObserver.observe(document.querySelector('.night-scene'));

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('show');
      observer.unobserve(entry.target);
    }
  }, { threshold: .12 });

  main.classList.add('has-scroll-reveals');
  main.querySelectorAll('.section:not(.hero) .reveal, .wedding-rings, .letter-masthead')
    .forEach(element => observer.observe(element));
}

const hero = main.querySelector('.hero');
function updateScrollEffects() {
  const progress = reducedMotion.matches ? 0 : Math.min(1, Math.max(0, window.scrollY / hero.offsetHeight));
  hero.style.setProperty('--portrait-scale', String(1 + progress * .32));
  hero.style.setProperty('--portrait-shift', (progress * -44) + 'px');
}
window.addEventListener('scroll', updateScrollEffects, { passive: true });
window.addEventListener('resize', updateScrollEffects);
reducedMotion.addEventListener?.('change', updateScrollEffects);
updateScrollEffects();

// Ease larger mouse-wheel steps. Touch and fine trackpad gestures keep their native momentum.
let wheelTarget = null;
window.addEventListener('wheel', event => {
  if (main.inert || reducedMotion.matches || !event.cancelable || event.ctrlKey ||
      event.shiftKey || event.deltaX || (event.deltaMode === 0 && Math.abs(event.deltaY) < 80)) {
    wheelTarget = null;
    return;
  }
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  const delta = event.deltaY * unit;
  const start = wheelTarget !== null && (wheelTarget - window.scrollY) * delta > 0
    ? wheelTarget : window.scrollY;
  const limit = document.scrollingElement.scrollHeight - document.documentElement.clientHeight;
  wheelTarget = Math.max(0, Math.min(limit, start + delta));
  event.preventDefault();
  window.scrollTo({ top: wheelTarget, behavior: 'smooth' });
}, { passive: false });
for (const type of ['scrollend', 'pointerdown', 'keydown']) {
  window.addEventListener(type, () => { wheelTarget = null; });
}

main.inert = true;
document.documentElement.classList.add('invitation-covered');
opening.hidden = false;

const weddingDate = new Date('2026-12-31T00:00:00+05:30').getTime();

function updateCountdown() {
  let remaining = Math.max(0, Math.floor((weddingDate - Date.now()) / 1000));
  const units = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
  for (const [id, seconds] of Object.entries(units)) {
    const value = Math.floor(remaining / seconds);
    document.getElementById(id).textContent = String(value).padStart(2, '0');
    remaining %= seconds;
  }
}

updateCountdown();
window.setInterval(updateCountdown, 1000);
