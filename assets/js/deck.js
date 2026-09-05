/* =========================================================
   Deck runtime: navigation, counters, and the auto-fit guard.
   ========================================================= */

const slides = [...document.querySelectorAll('.slide')];
const segs = [...document.querySelectorAll('.seg b')];
const count = document.querySelector('#count');
const sectionLabel = document.querySelector('#section');
const live = document.querySelector('#live');

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = window.matchMedia('(max-width: 820px)');

const SECTIONS = [
  { name: 'Dasar', start: 0, end: 3 },
  { name: 'Anatomi rantai', start: 4, end: 9 },
  { name: 'Studi kasus', start: 10, end: 16 },
  { name: 'Langkah & sikap', start: 17, end: 21 }
];

let current = 0;
let locked = false;

/* ---------------------------------------------------------
   Auto-fit guard

   Type and spacing all derive from --u, which already responds
   to viewport height. When a slide still runs long (long copy,
   a 10-row list, an unusual aspect ratio) this shrinks --u for
   that slide only, until the content clears the padding box.
   Scaling the type keeps text crisp; a transform would blur it
   and fight the slide transition.
   --------------------------------------------------------- */

const FIT_MIN = 0.48;
const FIT_STEP = 0.96;
const SKIP = ['silhouette', 'hero-route'];

function overflowAmount(slide) {
  const cs = getComputedStyle(slide);
  const box = slide.getBoundingClientRect();
  const safeTop = box.top + parseFloat(cs.paddingTop);
  let safeBottom = box.bottom - parseFloat(cs.paddingBottom);

  let worst = 0;

  /* The citation line owns the last row. Content above it must clear it,
     otherwise a tall .copy gets centred straight through the citation
     while poking out of the top of the slide. */
  const source = slide.querySelector(':scope > .source');
  if (source) {
    const sb = source.getBoundingClientRect();
    if (sb.height > 0) {
      worst = Math.max(worst, sb.bottom - safeBottom);
      safeBottom = Math.min(safeBottom, sb.top - 6);
    }
  }

  for (const el of slide.children) {
    if (el === source) continue;
    if (SKIP.some(cls => el.classList.contains(cls))) continue;
    /* corner art is placed deliberately and does not respond to --u */
    if (getComputedStyle(el).position === 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.height < 1) continue;
    worst = Math.max(worst, r.bottom - safeBottom, safeTop - r.top);
  }
  return Math.max(worst, 0);
}

function fitSlide(slide) {
  if (!slide) return;
  slide.style.removeProperty('--fit');
  if (narrow.matches) return; // narrow screens scroll instead

  slide.classList.add('measuring');
  let fit = 1;
  for (let i = 0; i < 40; i++) {
    if (overflowAmount(slide) <= 1) break;
    fit = Math.max(fit * FIT_STEP, FIT_MIN);
    slide.style.setProperty('--fit', fit.toFixed(4));
    if (fit === FIT_MIN) break;
  }
  slide.classList.remove('measuring');
}

/* ---------------------------------------------------------
   Chrome
   --------------------------------------------------------- */

function paint() {
  SECTIONS.forEach((s, i) => {
    const total = s.end - s.start + 1;
    const done = Math.min(Math.max(current - s.start + 1, 0), total);
    if (segs[i]) segs[i].style.width = `${(done / total) * 100}%`;
  });

  const sec = SECTIONS.find(s => current >= s.start && current <= s.end);
  sectionLabel.innerHTML = sec ? `<b>${sec.name}</b>` : '';
  count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;

  slides.forEach((s, i) => s.setAttribute('aria-hidden', i === current ? 'false' : 'true'));
  if (live) live.textContent = `Slide ${current + 1} dari ${slides.length}: ${slides[current].dataset.title || ''}`;
}

function counters(slide) {
  slide.querySelectorAll('[data-to]').forEach(el => {
    const to = parseFloat(el.dataset.to);
    if (reduce || !Number.isFinite(to)) { el.textContent = to; return; }
    const dur = 750;
    const t0 = performance.now();
    el.textContent = '0';
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function show(index) {
  if (locked || index === current || index < 0 || index >= slides.length) return;
  locked = true;

  const previous = slides[current];
  previous.classList.add('leaving');
  previous.classList.remove('active');

  current = index;
  const next = slides[current];
  next.classList.add('active');

  setTimeout(() => { previous.classList.remove('leaving'); locked = false; }, 620);

  paint();
  fitSlide(next);
  counters(next);
  history.replaceState(null, '', `#${current + 1}`);
}

const next = () => show(Math.min(current + 1, slides.length - 1));
const prev = () => show(Math.max(current - 1, 0));

document.querySelector('#next').onclick = next;
document.querySelector('#prev').onclick = prev;

document.addEventListener('keydown', e => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  if (e.key === 'Home') show(0);
  if (e.key === 'End') show(slides.length - 1);
});

let touchStart = 0;
document.addEventListener('touchstart', e => { touchStart = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', e => {
  const gap = e.changedTouches[0].screenX - touchStart;
  if (Math.abs(gap) > 45) (gap < 0 ? next : prev)();
}, { passive: true });

/* pointer parallax on the ambient rings and the 3D renders */
if (!reduce && window.matchMedia('(pointer:fine)').matches) {
  const amb = document.querySelector('.ambient');
  const renders = [...document.querySelectorAll('.render3d')];
  let queued = 0;

  document.addEventListener('pointermove', e => {
    const x = e.clientX / window.innerWidth - .5;
    const y = e.clientY / window.innerHeight - .5;
    if (queued) return;
    queued = requestAnimationFrame(() => {
      amb.style.setProperty('--px', (x * -20).toFixed(1) + 'px');
      amb.style.setProperty('--py', (y * -16).toFixed(1) + 'px');
      renders.forEach(r => {
        r.style.setProperty('--tilt-x', (y * -6).toFixed(1) + 'deg');
        r.style.setProperty('--tilt-y', (x * 8).toFixed(1) + 'deg');
      });
      queued = 0;
    });
  }, { passive: true });
}

/* refit on resize, on font/image settle, and on orientation change */
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => fitSlide(slides[current]), 140);
});
window.addEventListener('load', () => fitSlide(slides[current]));
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => fitSlide(slides[current]));
}

/* deep link: #7 opens slide 7 */
const fromHash = Number(location.hash.slice(1));
if (Number.isInteger(fromHash) && fromHash > 1 && fromHash <= slides.length) {
  slides[0].classList.remove('active');
  current = fromHash - 1;
  slides[current].classList.add('active');
}

paint();
fitSlide(slides[current]);
counters(slides[current]);
