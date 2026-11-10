/* ResacApp · landing interactions
   Everything here is a front-end demonstration: no data leaves the page. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced() ? Math.min(ms, 60) : ms));
  const pad = (n) => String(n).padStart(2, '0');
  const fmtHM = (min) => { const m = ((min % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const timerHTML = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${pad(h)}:${pad(m)}<span>:${pad(x)}</span>`; };
  const onView = (el, cb, opts = { threshold: 0.35 }) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((ents) => { ents.forEach((e) => { if (e.isIntersecting) { io.disconnect(); cb(); } }); }, opts);
    io.observe(el);
  };

  /* ---------------- Phone scaling ---------------- */
  const scalePhones = () => $$('.phone-slot').forEach((s) => s.style.setProperty('--k', (s.clientWidth / 415).toFixed(4)));
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((ents) => ents.forEach((e) => e.target.style.setProperty('--k', (e.contentRect.width / 415).toFixed(4))));
    $$('.phone-slot').forEach((s) => ro.observe(s));
  } else { scalePhones(); window.addEventListener('resize', scalePhones); }

  /* ---------------- Dates + QR ---------------- */
  const now = new Date();
  const dFull = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const dShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
  $$('[data-today]').forEach((el) => { el.textContent = dFull.format(now).replace(/\./g, ''); });
  $$('[data-valid]').forEach((el) => { el.textContent = dShort.format(new Date(now.getTime() + 10 * 864e5)).replace(/\./g, ''); });
  $$('[data-year]').forEach((el) => { el.textContent = now.getFullYear(); });

  try {
    const qr = JSON.parse($('#qr-data').textContent);
    $$('svg[data-qr]').forEach((svg) => {
      const q = qr[svg.dataset.qr]; if (!q) return;
      const n = q.n, m = 2;
      svg.setAttribute('viewBox', `${-m} ${-m} ${n + m * 2} ${n + m * 2}`);
      svg.innerHTML = `<rect x="${-m}" y="${-m}" width="${n + m * 2}" height="${n + m * 2}" fill="#fff"/><path fill="#0E121B" d="${q.d}"/>`;
    });
  } catch (e) { /* QR is decorative */ }

  /* ---------------- Sound (off by default) ---------------- */
  let soundOn = false, actx = null;
  const ding = () => {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime;
      [[987.77, 0], [1318.51, 0.13]].forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.16, t + d + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7);
        o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + 0.75);
      });
    } catch (e) { /* audio not available */ }
  };
  $$('[data-sound]').forEach((b) => b.addEventListener('click', () => {
    soundOn = !soundOn;
    $$('[data-sound]').forEach((x) => x.setAttribute('aria-pressed', String(soundOn)));
    ding();
  }));

  /* ---------------- Countdown ticker ---------------- */
  const tickers = new Set();
  const addTicker = (fn) => { tickers.add(fn); return () => tickers.delete(fn); };
  setInterval(() => tickers.forEach((fn) => fn()), 1000);

  /* ---------------- Phone controller ---------------- */
  class Phone {
    constructor(slot) {
      this.slot = slot;
      this.phone = $('.phone', slot);
      this.screenEl = $('.phone-screen', slot);
      this.screens = new Map($$('.scr', slot).map((s) => [s.dataset.screen, s]));
      const act = $('.scr.is-active', slot);
      this.cur = act ? act.dataset.screen : null;
      this.pushEl = $('[data-push]', slot);
      this.finger = $('.finger', slot);
      this.sync();
    }
    get(name) { return this.screens.get(name); }
    sync() { const s = this.get(this.cur); if (s) this.phone.dataset.sb = s.dataset.sb || 'light'; }
    show(name, { back = false, fade = false } = {}) {
      if (name === this.cur) return;
      const next = this.get(name), prev = this.get(this.cur);
      if (!next) return;
      next.classList.remove('is-out', 'is-out-back', 'is-out-fade');
      const enter = reduced() || fade ? 'enter-fade' : back ? 'enter-back' : 'enter';
      next.classList.add('no-tr', enter);
      void next.offsetWidth;
      next.classList.remove('no-tr', 'enter', 'enter-back', 'enter-fade');
      next.classList.add('is-active');
      if (prev) {
        prev.classList.remove('is-active');
        prev.classList.add(reduced() || fade ? 'is-out-fade' : back ? 'is-out-back' : 'is-out');
        setTimeout(() => { if (!prev.classList.contains('is-active')) prev.classList.remove('is-out', 'is-out-back', 'is-out-fade'); }, 700);
      }
      this.cur = name; this.sync();
      next.dispatchEvent(new CustomEvent('screen:enter'));
    }
    notify(on = true) {
      if (!this.pushEl) return;
      this.pushEl.classList.toggle('is-on', on);
      if (on) ding();
    }
    async tap(el, token) {
      if (!el || !this.finger || reduced()) return;
      const sr = this.screenEl.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!sr.width) return;
      const k = sr.width / 393;
      const f = this.finger;
      f.style.left = ((r.left + r.width / 2 - sr.left) / k) + 'px';
      f.style.top = ((r.top + r.height / 2 - sr.top) / k) + 'px';
      f.classList.add('is-on');
      await sleep(520); if (token && token.dead) { f.classList.remove('is-on'); return; }
      f.classList.add('is-tap'); el.classList.add('is-pressed');
      await sleep(170);
      f.classList.remove('is-tap'); el.classList.remove('is-pressed');
      await sleep(140); f.classList.remove('is-on');
    }
  }

  /* =========================================================
     HERO: tap «Solicitar receta» and watch the outcomes arrive
     ========================================================= */
  const hero = $('[data-hero]');
  if (hero) {
    const rx = $('[data-rx]', hero);
    const prog = $('.rx-prog', rx);
    const oc = Object.fromEntries($$('[data-oc]', hero).map((el) => [el.dataset.oc, el]));
    const procs = $$('[data-proc]', hero);
    const live = $('[data-hero-live]', hero);
    const doseEl = $('.dose-t', oc.dose);
    let token = null, started = false, doseLeft = 2712, stopDose = null;

    const reset = () => {
      Object.values(oc).forEach((el) => el.classList.remove('is-in', 'is-ok'));
      procs.forEach((p) => p.classList.remove('is-done'));
      hero.classList.remove('is-done');
    };
    const charge = () => {
      prog.style.transition = 'none';
      prog.style.strokeDashoffset = '100';
      void prog.getBoundingClientRect();
      prog.style.transition = 'stroke-dashoffset 1.25s cubic-bezier(.16,1,.3,1)';
      prog.style.strokeDashoffset = '0';
    };
    const finalState = () => {
      reset();
      Object.values(oc).forEach((el) => el.classList.add('is-in'));
      oc.review.classList.add('is-ok');
      procs.forEach((p) => p.classList.add('is-done'));
      hero.classList.add('is-done');
    };
    const startDose = () => {
      doseLeft = 2712; doseEl.innerHTML = timerHTML(doseLeft);
      if (stopDose) stopDose();
      stopDose = addTicker(() => { doseLeft = doseLeft > 0 ? doseLeft - 1 : 2712; doseEl.innerHTML = timerHTML(doseLeft); });
    };

    const run = async () => {
      started = true;
      if (token) token.dead = true;
      const t = token = { dead: false };
      if (reduced()) { finalState(); startDose(); live.textContent = 'Solicitud aprobada. Receta en tu correo, código QR para tu farmacia y pauta en tu móvil.'; return; }
      reset();
      hero.classList.add('is-playing');
      rx.classList.add('is-pressed', 'is-charging');
      setTimeout(() => rx.classList.remove('is-pressed'), 200);
      charge();
      await sleep(650); if (t.dead) return;
      procs[0].classList.add('is-done');
      oc.review.classList.add('is-in');
      live.textContent = 'Solicitud enviada. En revisión médica.';
      await sleep(1500); if (t.dead) return;
      oc.review.classList.add('is-ok');
      procs[1].classList.add('is-done');
      live.textContent = 'Solicitud aprobada por un médico.';
      await sleep(650); if (t.dead) return;
      oc.push.classList.add('is-in'); ding();
      live.textContent = 'Tu receta electrónica ya está en tu correo.';
      await sleep(1000); if (t.dead) return;
      oc.qr.classList.add('is-in');
      procs[2].classList.add('is-done');
      await sleep(850); if (t.dead) return;
      oc.dose.classList.add('is-in'); startDose();
      rx.classList.remove('is-charging');
      hero.classList.remove('is-playing'); hero.classList.add('is-done');
    };

    rx.addEventListener('click', run);
    $('[data-hero-replay]', hero).addEventListener('click', run);

    // Autoplay once if the visitor does not tap first
    onView(rx, () => setTimeout(() => { if (!started) run(); }, reduced() ? 0 : 1600), { threshold: 0.6 });

    // Pointer parallax (fine pointers only)
    const heroSec = $('.hero');
    if (window.matchMedia('(pointer: fine)').matches && !reduced()) {
      heroSec.addEventListener('pointermove', (e) => {
        const r = heroSec.getBoundingClientRect();
        heroSec.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        heroSec.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
      heroSec.addEventListener('pointerleave', () => { heroSec.style.setProperty('--px', 0); heroSec.style.setProperty('--py', 0); });
    }
  }

  /* =========================================================
     CÓMO FUNCIONA: an app walkthrough driven by scroll or taps
     ========================================================= */
  const how = $('[data-how]');
  if (how) {
    const steps = $$('.step', how);
    const phone = new Phone($('#how-phone'));
    const S = (n) => phone.get(n);
    const mq = window.matchMedia('(max-width: 899px)');
    const dotsWrap = $('.how-dots', how);
    const caption = $('.how-caption', how);
    let active = -1, token = null, inView = false, touched = false, progScrollUntil = 0, autoTimer = null;

    // dots (mobile)
    steps.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Paso ' + (i + 1));
      b.addEventListener('click', () => { touched = true; go(i); });
      dotsWrap.appendChild(b);
    });
    const dots = $$('button', dotsWrap);

    /* --- quiz state --- */
    const quiz = S('quiz');
    const q1 = $('[data-q="1"]', quiz), q2 = $('[data-q="2"]', quiz), qSub = $('.q-sub', quiz);
    const qNext = $('[data-act="q-next"]', quiz), qCount = $('[data-qcount]', quiz), qProg = $('.q-prog', quiz);
    const denyReason = $('[data-deny-reason]', S('deny'));
    let qs = { step: 1, a1: null, a2: null };
    const quizReset = () => {
      qs = { step: 1, a1: null, a2: null };
      $$('.q-opt, .q-chk', quiz).forEach((b) => { b.classList.remove('is-sel'); b.setAttribute('aria-pressed', 'false'); });
      qSub.hidden = true; q1.hidden = false; q2.hidden = true;
      qNext.disabled = true; qCount.textContent = '1/2'; qProg.style.setProperty('--p', '.5');
      quiz.classList.remove('is-loading', 'is-pass');
    };
    const quizValid = () => {
      if (qs.step === 1) return qs.a1 === 'no' || (qs.a1 === 'yes' && $$('.q-chk.is-sel', quiz).length > 0);
      return !!qs.a2;
    };
    const pick = (btn) => {
      const card = btn.closest('.q-card');
      $$('.q-opt', card).forEach((b) => { b.classList.toggle('is-sel', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
      if (card === q1) { qs.a1 = btn.dataset.a; qSub.hidden = qs.a1 !== 'yes'; }
      else qs.a2 = btn.dataset.a;
      qNext.disabled = !quizValid();
    };
    const quizNext = async (t) => {
      if (!quizValid()) return;
      if (qs.step === 1) {
        if (qs.a1 === 'yes') { denyReason.textContent = 'Alergias medicamentosas detectadas'; phone.show('deny'); return 'deny'; }
        qs.step = 2; q1.hidden = true; q2.hidden = false; qCount.textContent = '2/2'; qProg.style.setProperty('--p', '1'); qNext.disabled = true;
        return 'q2';
      }
      if (qs.a2 === 'yes') { denyReason.textContent = 'Embarazo o lactancia'; phone.show('deny'); return 'deny'; }
      quiz.classList.add('is-loading');
      await sleep(1300); if (t && t.dead) return;
      quiz.classList.add('is-pass');
      $('.q-loading p', quiz).textContent = 'Todo correcto. Pasamos al pago.';
      await sleep(1100);
      return 'pass';
    };
    $$('.q-opt', quiz).forEach((b) => b.addEventListener('click', () => { userAct(); pick(b); }));
    $$('.q-chk', quiz).forEach((b) => b.addEventListener('click', () => { userAct(); b.classList.toggle('is-sel'); b.setAttribute('aria-pressed', String(b.classList.contains('is-sel'))); qNext.disabled = !quizValid(); }));
    qNext.addEventListener('click', async () => {
      userAct();
      const t = token;
      const r = await quizNext(t);
      if (r === 'pass' && t === token && !t.dead) go(2);
    });
    $('[data-act="quiz-reset"]', S('deny')).addEventListener('click', () => { userAct(); quizReset(); phone.show('quiz', { back: true }); });

    /* --- status timeline --- */
    const tl = $$('[data-tl]', S('status'));
    const tlSet = (n) => tl.forEach((r, i) => { r.classList.toggle('is-done', i < n); r.classList.toggle('is-now', i === n); });
    const runStatus = async (t, fast) => {
      tlSet(1); await sleep(fast ? 700 : 1500); if (t.dead) return false;
      tlSet(2); await sleep(fast ? 700 : 1300); if (t.dead) return false;
      tlSet(3); await sleep(500); if (t.dead) return false;
      phone.show('approved', { fade: true });
      await sleep(450); if (t.dead) return false;
      phone.notify(true);
      setTimeout(() => phone.notify(false), 3200);
      return true;
    };

    /* --- camera scans --- */
    const scan = async (name, t) => {
      const s = S(name);
      s.classList.remove('is-ok', 'is-scanning');
      void s.offsetWidth;
      s.classList.add('is-scanning');
      await sleep(1900); if (t.dead) return false;
      s.classList.add('is-ok');
      await sleep(900);
      return !t.dead;
    };

    /* --- pharmacy picker --- */
    const pharmacies = [
      ['Farmacia más cercana', 'A 350 m · Abierta ahora'],
      ['Farmacia de la Plaza', 'A 600 m · Abierta ahora'],
      ['Farmacia del Puerto', 'A 900 m · Abierta ahora'],
      ['Farmacia Centro', 'A 1,2 km · Abierta ahora']
    ];
    const phName = $('[data-ph-name]', S('pharmacy')), phMeta = $('[data-ph-meta]', S('pharmacy'));
    $$('[data-ph]', S('pharmacy')).forEach((pin) => pin.addEventListener('click', () => {
      userAct();
      $$('[data-ph]', S('pharmacy')).forEach((p) => p.classList.toggle('is-sel', p === pin));
      const [n, m] = pharmacies[+pin.dataset.ph];
      phName.textContent = n; phMeta.textContent = m;
    }));

    /* --- scenes per step --- */
    const scenes = [
      async (t, o) => {
        $$('.scr-cam', phone.slot).forEach((s) => s.classList.remove('is-ok', 'is-scanning'));
        phone.show('login', { back: o.back });
        await sleep(1700); if (t.dead) return;
        await phone.tap($('[data-act="signup"]', S('login')), t); if (t.dead) return;
        phone.show('scan');
        await sleep(500); if (t.dead) return;
        if (!(await scan('scan', t))) return;
        phone.show('selfie');
        await sleep(450); if (t.dead) return;
        await scan('selfie', t);
      },
      async (t, o) => {
        quizReset();
        phone.show('quiz', { back: o.back });
        await sleep(2600); if (t.dead || touched) return;
        const o1 = $('[data-a="no"]', q1);
        await phone.tap(o1, t); if (t.dead || touched) return; pick(o1);
        await sleep(450); await phone.tap(qNext, t); if (t.dead || touched) return; await quizNext(t);
        await sleep(700); const o2 = $('[data-a="no"]', q2);
        await phone.tap(o2, t); if (t.dead || touched) return; pick(o2);
        await sleep(450); await phone.tap(qNext, t); if (t.dead || touched) return;
        await quizNext(t);
      },
      async (t, o) => {
        tlSet(1);
        phone.show('pay', { back: o.back });
        await sleep(1600); if (t.dead) return;
        await phone.tap($('[data-act="pay"]', S('pay')), t); if (t.dead) return;
        phone.show('status');
        await sleep(400); if (t.dead) return;
        await runStatus(t);
      },
      async (t, o) => {
        phone.show('pharmacy', { back: o.back });
        await sleep(2400); if (t.dead || touched) return;
        const pin = $('[data-ph="2"]', S('pharmacy'));
        await phone.tap(pin, t); if (t.dead || touched) return;
        pin.click(); touched = false;
      },
      async (t, o) => {
        phone.show('done', { back: o.back });
      }
    ];

    const runScene = (i, o = {}) => {
      if (token) token.dead = true;
      clearTimeout(autoTimer);
      phone.notify(false);
      const t = token = { dead: false };
      if (!inView) return;
      Promise.resolve(scenes[i](t, o)).then(() => {
        if (t.dead || !mq.matches || touched || i >= steps.length - 1) return;
        autoTimer = setTimeout(() => { if (!t.dead && inView && !touched) go(i + 1, { auto: true }); }, 2600);
      });
    };

    const renderCaption = (i) => {
      const s = steps[i];
      caption.innerHTML = `<h3>${$('.step-t', s).textContent}</h3>${$('.step-body', s).innerHTML}`;
    };

    function setStep(i, o = {}) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (i === active && !o.force) return;
      const back = i < active;
      active = i;
      steps.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-past', k < i); });
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
      how.style.setProperty('--prog', (i / (steps.length - 1)).toFixed(3));
      renderCaption(i);
      runScene(i, { back });
    }

    function go(i, o = {}) {
      i = Math.max(0, Math.min(steps.length - 1, i));
      if (!mq.matches) {
        // Desktop: move the page to that step, the phone follows
        progScrollUntil = Date.now() + 1100;
        const s = steps[i], r = s.getBoundingClientRect();
        const y = window.scrollY + r.top + r.height / 2 - window.innerHeight / 2;
        window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
      } else if (!o.auto) {
        const chip = $('.step-btn', steps[i]);
        chip.parentElement.parentElement.scrollTo({ left: chip.parentElement.offsetLeft - 16, behavior: reduced() ? 'auto' : 'smooth' });
      }
      setStep(i, o);
      if (mq.matches && o.auto) { const chip = steps[i]; chip.parentElement.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' }); }
    }

    function userAct() { touched = true; clearTimeout(autoTimer); }

    // In-phone actions
    const act = (name, fn) => $$(`[data-act="${name}"]`, phone.slot).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); userAct(); fn(b); }));
    act('signup', async () => {
      if (token) token.dead = true;
      const t = token = { dead: false };
      phone.show('scan'); await sleep(350);
      if (!(await scan('scan', t))) return;
      phone.show('selfie'); await sleep(350);
      await scan('selfie', t);
    });
    act('selfie-done', () => go(1));
    act('pay', async () => {
      if (token) token.dead = true;
      const t = token = { dead: false };
      tlSet(1); phone.show('status'); await sleep(300);
      await runStatus(t, true);
    });
    act('refresh', async () => {
      if (token) token.dead = true;
      const t = token = { dead: false };
      await runStatus(t, true);
    });
    act('to-pharmacy', () => go(3));
    act('to-done', () => go(4));
    act('restart', () => { touched = false; go(0); });

    // Step list buttons
    steps.forEach((s, i) => $('.step-btn', s).addEventListener('click', () => { userAct(); go(i); }));
    $('[data-how-prev]', how).addEventListener('click', () => { userAct(); go(active - 1); });
    $('[data-how-next]', how).addEventListener('click', () => { userAct(); go(active + 1); });

    // Swipe on the phone (mobile)
    let sx = null, sy = null;
    phone.slot.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    phone.slot.addEventListener('touchend', (e) => {
      if (sx == null || !mq.matches) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) { userAct(); go(active + (dx < 0 ? 1 : -1)); }
      sx = sy = null;
    });

    // The step under the middle of the screen drives the phone (desktop);
    // scenes only run while the section is on screen (all sizes).
    const stepAtCenter = () => {
      const mid = window.innerHeight / 2;
      for (let i = 0; i < steps.length; i++) {
        const r = steps[i].getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) return i;
      }
      return steps[0].getBoundingClientRect().top > mid ? 0 : steps.length - 1;
    };
    let rafPending = false;
    const track = () => {
      rafPending = false;
      const r = how.getBoundingClientRect(), vh = window.innerHeight;
      const visible = r.bottom > vh * 0.15 && r.top < vh * 0.85;
      if (visible && !inView) {
        inView = true;
        setStep(mq.matches ? Math.max(active, 0) : stepAtCenter(), { force: true });
        return;
      }
      if (!visible && inView) {
        inView = false;
        if (token) token.dead = true;
        clearTimeout(autoTimer);
        return;
      }
      if (visible && !mq.matches && Date.now() > progScrollUntil) setStep(stepAtCenter());
    };
    window.addEventListener('scroll', () => { if (!rafPending) { rafPending = true; requestAnimationFrame(track); } }, { passive: true });
    window.addEventListener('resize', track);
    window.addEventListener('scrollend', () => { progScrollUntil = 0; track(); });
    mq.addEventListener('change', () => setStep(active, { force: true }));
    setStep(0, { force: true });
    track();
  }

  /* =========================================================
     PAUTA: live, tappable dosing schedule
     ========================================================= */
  const indic = $('[data-indic]');
  if (indic) {
    const slot = indic.closest('.phone-slot');
    const list = $('[data-doses]', indic);
    const timerEl = $('[data-next-timer]', indic);
    const nameEl = $('[data-next-name]', indic), metaEl = $('[data-next-meta]', indic);
    const progN = $('[data-prog-n]', indic), progBar = $('[data-prog-bar]', indic);
    const toast = $('[data-toast]', slot);
    const scroller = $('.in-scroll', indic);
    const bell = $('[data-bell]', indic);
    const DOSES = [
      { n: 'Antiemético', meta: '1 comprimido · 20:30', t: '20:30', min: 1230, p: 'Primera toma indicada en tu receta, en cuanto recojas el pack.' },
      { n: 'Protector gástrico', meta: '1 cápsula · 21:00', t: '21:00', min: 1260, p: 'Toma 1 cápsula 30 minutos después de la primera dosis.' },
      { n: 'Analgésico', meta: '1 comprimido · 22:00', t: '22:00', min: 1320, p: 'Toma 1 comprimido 60 minutos después de la primera dosis si tienes dolor de cabeza. No superes las dosis indicadas.', note: 'NOTA: no tomar en ayunas.' },
      { n: 'Suero de hidratación oral', sub: 'Disolver en agua', meta: '1 sobre · 23:00', t: '23:00', min: 1380, p: 'Disuelve 1 sobre en 1 litro de agua potable. Bebe a pequeños sorbos durante el día hasta recuperar la energía.', note: 'NOTA: si no mejoras en 24–48 horas, o presentas vómitos persistentes o dolor intenso, acude a valoración médica.' }
    ];
    let done = 1, tab = 'pend', left = 2712, toastT = null;

    const showToast = (html) => {
      toast.innerHTML = html; toast.classList.add('is-on');
      clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1900);
    };
    const doseCard = (d, i, current) => {
      const isDone = i < done;
      return `<article class="dose${current ? ' is-current' : ''}${isDone ? ' is-done' : ''}" style="animation-delay:${(i % 4) * 0.06}s">
        <div class="dose-h"><span class="dn">${isDone ? '<svg aria-hidden="true"><use href="#i-check"/></svg>' : i + 1}</span><span><b${current ? ' class="hl-med"' : ''}>${d.n}</b>${d.sub ? `<small>${d.sub}</small>` : ''}</span><time${current ? ' class="hl-time"' : ''}>${d.t}</time></div>
        <p${current ? ' class="hl-steps"' : ''}>${d.p}</p>${d.note ? `<p class="note">${d.note}</p>` : ''}
        ${current ? '<button class="a-btn a-pink take" type="button" data-take><svg aria-hidden="true"><use href="#i-check"/></svg>Marcar como tomado</button>' : ''}
      </article>`;
    };
    const render = () => {
      const all = DOSES.length;
      progN.textContent = `${done}/${all}`;
      progBar.style.transform = `scaleX(${done / all})`;
      if (done < all) {
        const d = DOSES[done];
        nameEl.textContent = d.n; metaEl.textContent = d.meta;
        timerEl.innerHTML = timerHTML(left);
      } else {
        nameEl.textContent = 'Pauta completada'; metaEl.textContent = 'Resaca fuera · disfruta de tu día';
        timerEl.innerHTML = '00:00<span>:00</span>';
      }
      if (tab === 'pend') {
        const pend = DOSES.map((d, i) => [d, i]).filter(([, i]) => i >= done);
        list.innerHTML = pend.length
          ? pend.map(([d, i], k) => doseCard(d, i, k === 0)).join('')
          : '<div class="empty"><b>¡Pauta completada!</b>Has seguido todas las tomas. <button class="text-btn" type="button" data-restart-pauta>Reiniciar ejemplo</button></div>';
      } else {
        const fin = DOSES.map((d, i) => [d, i]).filter(([, i]) => i < done);
        list.innerHTML = fin.length ? fin.map(([d, i]) => doseCard(d, i, false)).join('') : '<div class="empty">Aún no has marcado ninguna toma.</div>';
      }
    };
    list.addEventListener('click', (e) => {
      if (e.target.closest('[data-take]')) {
        const prevMin = DOSES[done].min;
        done = Math.min(DOSES.length, done + 1);
        left = done < DOSES.length ? (DOSES[done].min - prevMin) * 60 - 12 : 0;
        render();
        showToast('<svg aria-hidden="true"><use href="#i-check"/></svg>Toma registrada');
        scroller.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      }
      if (e.target.closest('[data-restart-pauta]')) { done = 1; left = 2712; render(); }
    });
    $$('[data-tab]', indic).forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      $$('[data-tab]', indic).forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', String(on)); });
      render();
    }));
    bell.addEventListener('click', () => {
      const on = !bell.classList.contains('is-on');
      bell.classList.toggle('is-on', on); bell.setAttribute('aria-pressed', String(on));
      showToast(`<svg aria-hidden="true"><use href="#i-bell"/></svg>Recordatorio ${on ? 'activado' : 'desactivado'}`);
    });
    addTicker(() => { if (done < DOSES.length && left > 0) { left--; timerEl.innerHTML = timerHTML(left); } });
    render();

    // Copy list ↔ phone highlight
    let pinned = null;
    const setHl = (v) => { if (v) slot.dataset.hl = v; else delete slot.dataset.hl; };
    $$('[data-hl]').forEach((b) => {
      const v = b.dataset.hl;
      b.addEventListener('mouseenter', () => setHl(v));
      b.addEventListener('focus', () => setHl(v));
      b.addEventListener('mouseleave', () => setHl(pinned));
      b.addEventListener('blur', () => setHl(pinned));
      b.addEventListener('click', () => {
        pinned = pinned === v ? null : v;
        $$('[data-hl]').forEach((x) => { x.classList.toggle('is-on', x.dataset.hl === pinned); x.setAttribute('aria-pressed', String(x.dataset.hl === pinned)); });
        setHl(pinned || v);
        if (tab !== 'pend') $('[data-tab="pend"]', indic).click();
        if (v === 'steps' || v === 'med') { const c = $('.dose.is-current', list); if (c) scroller.scrollTo({ top: c.offsetTop - 12, behavior: reduced() ? 'auto' : 'smooth' }); }
        if (v === 'time') scroller.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      });
    });
  }

  /* =========================================================
     BENEFITS widgets
     ========================================================= */
  const tw = $('[data-time]');
  if (tw) {
    const range = $('[data-wake]', tw), out = $('[data-wake-out]', tw);
    const er = $('[data-seg-er]', tw), app = $('[data-seg-app]', tw), free = $('[data-seg-free]', tw);
    const erOut = $('[data-er-out]', tw), appOut = $('[data-app-out]', tw);
    const A0 = 420, A1 = 1320, pct = (m) => Math.max(0, Math.min(100, (m - A0) / (A1 - A0) * 100));
    // axis labels
    const axis = $('.tw-axis', tw);
    axis.innerHTML = [420, 600, 840, 1080, 1320].map((m) => `<span style="left:${pct(m)}%">${fmtHM(m)}</span>`).join('');
    const upd = () => {
      const w = +range.value;
      out.textContent = fmtHM(w);
      range.style.setProperty('--fill', ((w - range.min) / (range.max - range.min) * 100) + '%');
      er.style.left = pct(w) + '%'; er.style.width = (pct(w + 240) - pct(w)) + '%';
      app.style.left = pct(w) + '%'; app.style.width = (pct(w + 20) - pct(w)) + '%';
      free.style.left = pct(w + 20) + '%'; free.style.width = (100 - pct(w + 20)) + '%';
      erOut.textContent = `De vuelta entre las ${fmtHM(w + 180)} y las ${fmtHM(w + 240)}`;
      appOut.textContent = `Receta en tu correo antes de las ${fmtHM(w + 20)}`;
    };
    range.addEventListener('input', upd);
    upd();
  }

  const sw = $('[data-speed]');
  if (sw) {
    onView(sw, () => {
      sw.classList.add('is-run');
      const el = $('[data-sw]', sw), target = 18 * 60 + 42, dur = reduced() ? 1 : 2600, t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4), v = Math.round(target * e);
        el.textContent = pad(Math.floor(v / 60)) + ':' + pad(v % 60);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
  }

  const docok = $('[data-docok]');
  if (docok) onView(docok, () => setTimeout(() => $('.stamp', docok).classList.add('is-ok'), reduced() ? 0 : 1400), { threshold: 0.5 });

  /* =========================================================
     TESTIMONIALS carousel
     ========================================================= */
  const car = $('[data-carousel]');
  if (car) {
    const track = $('[data-track]', car), cards = $$('.review', track), pos = $('[data-car-pos]', car);
    const prev = $('[data-car-prev]', car), next = $('[data-car-next]', car);
    const stepW = () => cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 20);
    const idx = () => Math.round(track.scrollLeft / stepW());
    const sync = () => {
      const i = Math.min(cards.length - 1, idx());
      pos.textContent = pad(i + 1);
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
    };
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    prev.addEventListener('click', () => track.scrollBy({ left: -stepW(), behavior: reduced() ? 'auto' : 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: stepW(), behavior: reduced() ? 'auto' : 'smooth' }));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
    // mouse drag
    let down = false, startX = 0, startL = 0, moved = false;
    track.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || e.target.closest('button')) return; down = true; moved = false; startX = e.clientX; startL = track.scrollLeft; });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = startL - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return; down = false;
      if (moved) {
        track.classList.remove('is-drag');
        const i = Math.round(track.scrollLeft / stepW());
        track.scrollTo({ left: i * stepW(), behavior: 'smooth' });
      }
    });
    // translations
    $$('.rv-tr', track).forEach((b) => {
      const card = b.closest('.review'), h = $('h3', card), p = $('blockquote p', card), lab = $('span', b);
      const orig = { h: h.textContent, p: p.textContent, lang: card.getAttribute('lang') };
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        h.textContent = on ? card.dataset.trTitle : orig.h;
        p.textContent = on ? card.dataset.tr : orig.p;
        card.setAttribute('lang', on ? 'es' : orig.lang);
        lab.textContent = on ? 'Ver original' : 'Traducir al español';
      });
    });
    sync();
  }

  /* =========================================================
     ¿ES PARA TI?
     ========================================================= */
  const fit = $('[data-fit]');
  if (fit) {
    const qs = $$('.fit-q', fit), ok = $('[data-fit-ok]', fit), no = $('[data-fit-no]', fit);
    const bar = $('[data-fit-bar]', fit), count = $('[data-fit-count]', fit), reason = $('[data-fit-reason]', fit);
    const REASONS = [
      'ResacApp es solo para personas adultas.',
      'ResacApp está pensada para síntomas relacionados con el consumo de alcohol.',
      'ResacApp no está indicada durante el embarazo o la lactancia. Consulta con tu médico.',
      'Deben pasar al menos 72 horas entre una solicitud y la siguiente. El servicio y la receta son personales e intransferibles.'
    ];
    const show = (el) => { [...qs, ok, no].forEach((x) => x.classList.toggle('is-on', x === el)); };
    const reset = () => { $$('.fit-opts button', fit).forEach((b) => b.classList.remove('is-sel')); bar.style.transform = 'scaleX(.25)'; count.textContent = 'Pregunta 1 de 4'; show(qs[0]); };
    qs.forEach((q, i) => $$('button', q).forEach((b) => b.addEventListener('click', () => {
      $$('button', q).forEach((x) => x.classList.toggle('is-sel', x === b));
      setTimeout(() => {
        if (b.dataset.v === q.dataset.bad) { reason.textContent = REASONS[i]; bar.style.transform = 'scaleX(1)'; count.textContent = 'Resultado'; show(no); return; }
        if (i < qs.length - 1) { show(qs[i + 1]); bar.style.transform = `scaleX(${(i + 2) / 4})`; count.textContent = `Pregunta ${i + 2} de 4`; }
        else { bar.style.transform = 'scaleX(1)'; count.textContent = 'Resultado'; show(ok); }
        const first = $('.fit-q.is-on button, .fit-res.is-on .btn, .fit-res.is-on .text-btn', fit);
        if (first && document.activeElement && fit.contains(document.activeElement)) first.focus({ preventScroll: true });
      }, reduced() ? 0 : 260);
    })));
    $$('[data-fit-reset]', fit).forEach((b) => b.addEventListener('click', reset));
  }

  /* =========================================================
     Contact form
     - With data-endpoint (Google Apps Script web app, see formulario/):
       sends the message, which is saved in a sheet and emailed to support.
     - Without it, or if sending fails: opens the visitor's email app with
       the message ready for data-mail, so nothing is lost.
     ========================================================= */
  const form = $('[data-contact]');
  if (form) {
    const status = $('[data-form-status]', form);
    const submitBtn = $('button[type="submit"]', form);
    const submitHtml = submitBtn.innerHTML;
    const mail = form.dataset.mail || 'soporte@resacapp.com';
    const mailtoFor = (d) => 'mailto:' + mail
      + '?subject=' + encodeURIComponent('Contacto desde resacapp.com · ' + d.nombre)
      + '&body=' + encodeURIComponent('Nombre: ' + d.nombre + '\nCorreo: ' + d.correo + '\nTeléfono: ' + (d.telefono || '—') + '\n\n' + d.uso);
    const say = (text, linkHref, isError) => {
      status.classList.toggle('is-error', !!isError);
      status.textContent = text;
      if (linkHref) {
        const a = document.createElement('a');
        a.href = linkHref; a.textContent = mail;
        status.append(a, '.');
      }
    };
    const setErr = (input, msg) => {
      const f = input.closest('.field');
      let e = $('.err', f);
      if (msg) {
        f.classList.add('is-err'); input.setAttribute('aria-invalid', 'true');
        if (!e) { e = document.createElement('span'); e.className = 'err'; e.id = input.id + '-err'; f.appendChild(e); input.setAttribute('aria-describedby', e.id); }
        e.textContent = msg;
      } else { f.classList.remove('is-err'); input.removeAttribute('aria-invalid'); if (e) e.remove(); input.removeAttribute('aria-describedby'); }
    };
    const check = () => {
      let bad = null;
      const n = form.nombre, c = form.correo, u = form.uso;
      if (!n.value.trim()) { setErr(n, 'Escribe tu nombre.'); bad = bad || n; } else setErr(n);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.value.trim())) { setErr(c, 'Revisa el correo: falta la @ o el dominio.'); bad = bad || c; } else setErr(c);
      if (!u.value.trim()) { setErr(u, 'Cuéntanos brevemente para qué la usarías.'); bad = bad || u; } else setErr(u);
      return bad;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (submitBtn.disabled) return;
      const bad = check();
      if (bad) { bad.focus(); say(''); return; }
      const d = {
        nombre: form.nombre.value.trim(),
        correo: form.correo.value.trim(),
        telefono: form.telefono.value.trim(),
        uso: form.uso.value.trim(),
        web: form.web ? form.web.value : '',
      };
      const name = d.nombre.split(' ')[0];
      const endpoint = (form.dataset.endpoint || '').trim();

      if (!endpoint) {
        window.location.href = mailtoFor(d);
        say('Hemos abierto tu correo con el mensaje preparado. Solo tienes que enviarlo. Si no se ha abierto, escríbenos a ', mailtoFor(d));
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
      say('');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      try {
        const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams(d), signal: ctrl.signal });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || 'error');
        say(`¡Gracias, ${name}! Hemos recibido tu mensaje y te responderemos pronto.`);
        form.reset();
      } catch (err) {
        say('No hemos podido enviar el mensaje. Escríbenos directamente a ', mailtoFor(d), true);
      } finally {
        clearTimeout(timer);
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitHtml;
      }
    });
    $$('.field input, .field textarea', form).forEach((i) => i.addEventListener('input', () => { if (i.closest('.field').classList.contains('is-err')) check(); }));
  }

  /* =========================================================
     App links: every download CTA opens the web app (app.resacapp.com)
     ========================================================= */
  $$('[data-download]').forEach((b) => b.addEventListener('click', async (e) => {
    closeMenu();
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (b.classList.contains('rx-big') && !reduced()) {
      e.preventDefault();
      const prog = $('.rx-prog', b);
      b.classList.add('is-pressed', 'is-charging');
      prog.style.transition = 'none'; prog.style.strokeDashoffset = '100'; void prog.getBoundingClientRect();
      prog.style.transition = 'stroke-dashoffset .7s cubic-bezier(.16,1,.3,1)'; prog.style.strokeDashoffset = '0';
      setTimeout(() => b.classList.remove('is-pressed'), 180);
      await sleep(620);
      b.classList.remove('is-charging');
      window.location.href = b.href;
    }
  }));
  $$('[data-legal]').forEach((a) => a.addEventListener('click', (e) => { if (a.getAttribute('href') === '#') e.preventDefault(); }));

  /* =========================================================
     Nav, menu, mobile CTA, reveal, scroll parallax
     ========================================================= */
  const nav = $('[data-nav]');
  const menuBtn = $('.menu-btn', nav), menu = $('#menu-movil');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-label', 'Abrir menú');
    nav.classList.remove('menu-open'); document.body.style.overflow = '';
  }
  menuBtn.addEventListener('click', () => {
    const open = menu.hidden;
    if (!open) { closeMenu(); return; }
    menu.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); menuBtn.setAttribute('aria-label', 'Cerrar menú');
    nav.classList.add('menu-open'); document.body.style.overflow = 'hidden';
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  const light = $$('.stories, .fit, .faq');
  const mcta = $('[data-mcta]');
  const heroCta = $('.hero-actions'), closeSec = $('.close'), footer = $('.foot');
  const vis = new Map();
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('is-scrolled', y > 12);
    const probe = (parseFloat(getComputedStyle(nav).height) || 76) * 0.5;
    const overLight = light.some((s) => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom >= probe; });
    nav.dataset.theme = overLight ? 'light' : 'dark';
    if (mcta) {
      const hr = heroCta.getBoundingClientRect(), cr = closeSec.getBoundingClientRect();
      mcta.classList.toggle('is-on', hr.bottom < 0 && cr.top > vh * 0.55);
    }
    if (!reduced()) {
      $$('.dawn, .hero').forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        sec.style.setProperty('--sy', ((vh - r.top) / (vh + r.height)).toFixed(3));
      });
    }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // Reveal on scroll, with a small stagger inside each group
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced()) {
    const groups = new Map();
    reveals.forEach((el) => {
      const g = el.parentElement;
      const n = groups.get(g) || 0; groups.set(g, n + 1);
      el.style.setProperty('--d', (n * 0.08).toFixed(2) + 's');
    });
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }
})();
