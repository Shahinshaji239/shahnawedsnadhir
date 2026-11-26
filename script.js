const opening = document.getElementById('opening');
const main = document.getElementById('main');
const openButton = document.getElementById('openButton');
const leftPaper = document.getElementById('leftPaper');
const petalLayer = document.getElementById('petal-layer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const resetCoverScroll = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('pageshow', () => { if (!opened) resetCoverScroll(); });
let gesture = null;
let opened = false;

// Both leaves carry the same full-width engraving so it meets at the fold.
const coverArt = document.getElementById('cover-art');
for (const flower of coverArt.content.querySelectorAll('.cover-flower')) {
  for (let petal = 0; petal < 18; petal++) {
    const loop = document.createElement('i');
    loop.style.transform = 'rotate(' + petal * 10 + 'deg)';
    flower.append(loop);
  }
}
for (const leaf of opening.querySelectorAll('.paper')) {
  leaf.append(coverArt.content.cloneNode(true));
}

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
  opening.style.setProperty('--left-pull', -progress * 72 + '%');
  opening.style.setProperty('--right-pull', progress * 72 + '%');
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

  // Keep the paper at the release position before enabling its transition.
  opening.getBoundingClientRect();
  releaseGesture();
  opening.classList.add('opened');
  opening.inert = true;

  const finish = () => {
    opening.hidden = true;
    document.documentElement.classList.remove('invitation-covered');
    resetCoverScroll();
    main.inert = false;
    main.classList.add('story-started');
    main.focus({ preventScroll: true });
  };

  if (reducedMotion.matches) {
    finish();
    return;
  }

  const fallback = window.setTimeout(() => {
    leftPaper.removeEventListener('transitionend', finishOnTear);
    finish();
  }, 750);

  function finishOnTear(event) {
    if (event.target !== leftPaper || event.propertyName !== 'transform') return;
    window.clearTimeout(fallback);
    leftPaper.removeEventListener('transitionend', finishOnTear);
    finish();
  }

  leftPaper.addEventListener('transitionend', finishOnTear);
}

opening.addEventListener('pointerdown', event => {
  if (opened || gesture || event.button !== 0) return;
  resetCoverScroll();
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  opening.classList.add('dragging');
  opening.setPointerCapture(event.pointerId);
});

opening.addEventListener('pointermove', event => {
  if (event.pointerId !== gesture?.id) return;

  const distance = Math.abs(event.clientX - gesture.x);
  const fullPull = Math.min(420, Math.max(90, window.innerWidth * .28));
  if (!reducedMotion.matches) setTearProgress(Math.min(1, distance / fullPull));
  if (distance >= fullPull) {
    gesture.completed = true;
    if (event.pointerType === 'mouse') openInvitation();
  }
});

opening.addEventListener('pointerup', event => {
  if (event.pointerId !== gesture?.id) return;

  const horizontal = Math.abs(event.clientX - gesture.x);
  const vertical = Math.abs(event.clientY - gesture.y);
  const isTap = horizontal <= 10 && vertical <= 10;
  const isTear = horizontal >= 55 && horizontal > vertical;
  if (isTap || isTear || gesture.completed) {
    openInvitation();
  } else {
    releaseGesture();
    setTearProgress(0);
  }
});

function cancelGesture(event) {
  if (event.pointerId !== gesture?.id) return;
  releaseGesture();
  setTearProgress(0);
}

opening.addEventListener('pointercancel', cancelGesture);
opening.addEventListener('lostpointercapture', cancelGesture);
openButton.addEventListener('click', openInvitation);

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('show');
      observer.unobserve(entry.target);
    }
  }, { threshold: .12 });

  main.classList.add('has-scroll-reveals');
  main.querySelectorAll('.section:not(.hero) .reveal').forEach(element => observer.observe(element));
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
