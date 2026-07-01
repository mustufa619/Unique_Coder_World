/* =====================================================================
   NOVA/SYS — app.js
   Three.js particle universe + experimental UI motion systems
   ===================================================================== */

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouch = window.matchMedia("(pointer: coarse)").matches;

/* ---------------------------------------------------------------------
   1. WEBGL UNIVERSE
   A fluid particle field + drifting abstract wireframe geometry,
   with a slow camera drift and pointer parallax for a cinematic feel.
--------------------------------------------------------------------- */
function initUniverse() {
  const canvas = document.getElementById("scene");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    document.body.classList.add("no-webgl");
    return { onPointer() {}, warp() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03040a, 0.055);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 16);

  // ---- Particle field -------------------------------------------------
  const COUNT = isTouch ? 6000 : 20000;
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT); // per-particle phase offset
  const colors = new Float32Array(COUNT * 3);

  const palette = [
    new THREE.Color(0x3df5ff),
    new THREE.Color(0x9b5cff),
    new THREE.Color(0xff4bd8),
  ];

  for (let i = 0; i < COUNT; i++) {
    // Distribute in a soft, layered cylindrical cloud
    const r = Math.pow(Math.random(), 0.5) * 26;
    const theta = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = Math.sin(theta) * r - 6;
    seeds[i] = Math.random() * Math.PI * 2;

    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  // Circular soft sprite drawn on a canvas so we don't need external assets
  const sprite = makeSprite();
  const tex = new THREE.CanvasTexture(sprite);

  // Shader material: GPU-side flowing motion (fluid drift)
  const uniforms = {
    uTime: { value: 0 },
    uTex: { value: tex },
    uSize: { value: isTouch ? 46 : 62 },
    uWarp: { value: 0 }, // pulsed on transitions
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uSize; uniform float uWarp;
      attribute vec3 aColor; attribute float aSeed;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = aColor;
        vec3 p = position;
        // fluid, noise-ish advection using layered sines
        float t = uTime * 0.35 + aSeed;
        p.x += sin(t + p.y * 0.15) * (1.2 + uWarp * 3.0);
        p.y += cos(t * 0.8 + p.z * 0.12) * (1.0 + uWarp * 2.5);
        p.z += sin(t * 0.6 + p.x * 0.1) * (1.2 + uWarp * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (1.0 + uWarp) / -mv.z;
        vAlpha = smoothstep(60.0, 4.0, -mv.z);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex; varying vec3 vColor; varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        gl_FragColor = vec4(vColor, t.a * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // ---- Abstract wireframe geometry (floating 3D environment) ----------
  const shapes = [];
  const shapeGeos = [
    new THREE.IcosahedronGeometry(3.2, 1),
    new THREE.TorusGeometry(2.6, 0.5, 12, 40),
    new THREE.OctahedronGeometry(2.4, 0),
  ];
  shapeGeos.forEach((g, i) => {
    const wire = new THREE.WireframeGeometry(g);
    const line = new THREE.LineSegments(
      wire,
      new THREE.LineBasicMaterial({ color: palette[i].getHex(), transparent: true, opacity: 0.28 })
    );
    line.position.set((i - 1) * 12, (i % 2 === 0 ? 4 : -5), -14 - i * 4);
    scene.add(line);
    shapes.push(line);
  });

  // ---- Pointer parallax + interaction ---------------------------------
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollTarget = 0, scrollPos = 0;
  let warpTarget = 0;

  const clock = new THREE.Clock();
  function render() {
    const dt = clock.getDelta();
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    // ease pointer & warp
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    scrollPos += (scrollTarget - scrollPos) * 0.06;
    uniforms.uWarp.value += (warpTarget - uniforms.uWarp.value) * 0.08;
    warpTarget *= 0.9;

    // cinematic camera drift
    camera.position.x += (pointer.x * 4 - camera.position.x) * 0.04;
    camera.position.y += (-pointer.y * 3 - scrollPos * 10 - camera.position.y) * 0.04;
    camera.lookAt(0, -scrollPos * 4, 0);

    points.rotation.y = t * 0.02;
    shapes.forEach((s, i) => {
      s.rotation.x += dt * (0.1 + i * 0.04);
      s.rotation.y += dt * (0.14 + i * 0.03);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  if (!reduceMotion) render();
  else renderer.render(scene, camera);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener("scroll", () => {
    const max = document.body.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  return {
    onPointer(nx, ny) { pointer.tx = nx; pointer.ty = ny; },
    warp() { warpTarget = 1; },
  };
}

function makeSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.6, "rgba(255,255,255,0.15)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/* ---------------------------------------------------------------------
   2. UI MOTION SYSTEMS
--------------------------------------------------------------------- */
const universe = initUniverse();

// ---- Boot sequence ---------------------------------------------------
function runBoot() {
  const boot = document.getElementById("boot");
  const bar = document.getElementById("bootBar");
  const sub = document.getElementById("bootSub");
  const stages = ["INITIALIZING UNIVERSE", "COMPILING SHADERS", "SEEDING PARTICLE FIELD", "SYNCING HOLO-CORE", "READY"];
  let p = 0, si = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + Math.random() * 16 + 6);
    if (bar) bar.style.width = p + "%";
    const stage = Math.min(stages.length - 1, Math.floor((p / 100) * stages.length));
    if (stage !== si) { si = stage; if (sub) sub.textContent = stages[si]; }
    if (p >= 100) {
      clearInterval(tick);
      setTimeout(() => { boot.classList.add("is-done"); startReveals(); }, 400);
    }
  }, 220);
}

// ---- Scroll reveal ---------------------------------------------------
function startReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));

  // count-up stats
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = +el.dataset.count;
    const st = new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting) { countUp(el, target); st.disconnect(); }
    }, { threshold: 0.5 });
    st.observe(el);
  });
}

function countUp(el, target) {
  const dur = 1600; const start = performance.now();
  function step(now) {
    const k = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.floor(eased * target).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---- Cursor aura + pointer feed to universe --------------------------
function initPointer() {
  if (isTouch || reduceMotion) return;
  const aura = document.getElementById("aura");
  window.addEventListener("mousemove", (e) => {
    aura.style.left = e.clientX + "px";
    aura.style.top = e.clientY + "px";
    universe.onPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  });
  document.querySelectorAll("a, button, input, [data-tilt]").forEach((el) => {
    el.addEventListener("mouseenter", () => aura.classList.add("is-active"));
    el.addEventListener("mouseleave", () => aura.classList.remove("is-active"));
  });
}

// ---- Magnetic buttons ------------------------------------------------
function initMagnetic() {
  if (isTouch || reduceMotion) return;
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${mx * 0.3}px, ${my * 0.4}px)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// ---- 3D tilt on glass cards -----------------------------------------
function initTilt() {
  if (isTouch || reduceMotion) return;
  document.querySelectorAll("[data-tilt]").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 12}deg) rotateX(${(0.5 - py) * 12}deg) translateZ(6px)`;
      el.style.setProperty("--mx", px * 100 + "%");
      el.style.setProperty("--my", py * 100 + "%");
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// ---- Nav behaviour ---------------------------------------------------
function initNav() {
  const nav = document.getElementById("nav");
  let last = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > last && y > 300);
    last = y;
  }, { passive: true });
}

// ---- Cinematic navigation (warp on jump) -----------------------------
function initTransitions() {
  document.querySelectorAll("[data-nav], [data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const sel = el.getAttribute("href") || el.dataset.goto;
      if (!sel || !sel.startsWith("#")) return;
      const target = document.querySelector(sel);
      if (!target) return;
      e.preventDefault();
      universe.warp();
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
}

// ---- HUD readout + live data stream ----------------------------------
function initHUD() {
  const readout = document.getElementById("hudReadout");
  const words = ["SYS · ONLINE", "FLUX · STABLE", "CORE · SYNCED", "GRID · NOMINAL", "LINK · SECURE"];
  let i = 0;
  setInterval(() => { i = (i + 1) % words.length; readout.textContent = words[i]; }, 2600);
}

function initFeed() {
  const feed = document.getElementById("feed");
  if (!feed) return;
  const labels = ["NEUTRINO BURST", "GRAVITON ECHO", "QUANTUM DRIFT", "PLASMA SURGE", "DARK FLUX", "PHOTON CASCADE", "ION STORM", "NEBULA PING"];
  const sectors = ["V-7", "K-2", "X-19", "Z-04", "N-88", "R-31"];
  function line() {
    const li = document.createElement("li");
    const val = (Math.random() * 900 + 100).toFixed(2);
    const ok = Math.random() > 0.35;
    li.innerHTML = `<span>${labels[(Math.random()*labels.length)|0]} · ${sectors[(Math.random()*sectors.length)|0]}</span>
                    <b class="${ok ? "" : "ok"}">${val} ${ok ? "Hz" : "⚠"}</b>`;
    feed.prepend(li);
    while (feed.children.length > 7) feed.lastChild.remove();
  }
  for (let k = 0; k < 7; k++) line();
  setInterval(line, 1800);
}

// ---- Access gate -----------------------------------------------------
function initGate() {
  const btn = document.getElementById("gateBtn");
  const input = document.getElementById("callsign");
  const status = document.getElementById("gateStatus");
  if (!btn) return;
  const authorize = () => {
    const name = (input.value || "TRAVELLER").trim().toUpperCase().slice(0, 18);
    universe.warp();
    const steps = ["VERIFYING CALLSIGN...", "OPENING GRID...", "ACCESS GRANTED"];
    let s = 0;
    status.style.color = "var(--cyan)";
    const iv = setInterval(() => {
      status.textContent = steps[s];
      if (s === steps.length - 1) {
        clearInterval(iv);
        status.innerHTML = `WELCOME, ${name} — THE UNIVERSE IS YOURS`;
      }
      s++;
    }, 700);
  };
  btn.addEventListener("click", authorize);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") authorize(); });
}

// ---- Module cards → holographic detail overlay -----------------------
const MODULE_DETAIL = {
  "Fluid Particle Core": {
    body: "A living field of 20,000 GPU-resident light points, each advected every frame by a layered flow field inside a custom GLSL vertex shader. No two frames are identical — the cloud breathes.",
    specs: [["Points", "20,480"], ["Pipeline", "GLSL / Vertex"], ["Blending", "Additive"], ["Cost", "~1 draw call"]],
  },
  "Abstract 3D Space": {
    body: "Wireframe primitives drift through volumetric depth with exponential fog, driven by a slow, camera-like easing. Move your pointer and the whole environment parallaxes around you.",
    specs: [["Geometry", "Ico · Torus · Octa"], ["Camera", "62° · drifting"], ["Fog", "ExpFog 0.055"], ["Parallax", "Pointer-linked"]],
  },
  "Glassmorphic UI": {
    body: "Frosted, refractive panels layer over the void. Each reacts to your cursor with real-time 3D tilt and a glow that tracks the pointer — depth you can feel, not just see.",
    specs: [["Blur", "16px backdrop"], ["Tilt", "±12° live"], ["Layers", "translateZ depth"], ["Glow", "Pointer-tracked"]],
  },
  "Cinematic Transitions": {
    body: "Every navigation and action fires a warp pulse through the particle field, easing the universe between states for a filmic, movie-intro flow rather than a hard cut.",
    specs: [["Easing", "cubic-bezier"], ["Warp", "Shader uniform"], ["Trigger", "Nav · Cards · Gate"], ["Feel", "Camera-like"]],
  },
};

function initCards() {
  const modal = document.getElementById("modal");
  if (!modal) return;
  const elTitle = document.getElementById("modalTitle");
  const elMeta = document.getElementById("modalMeta");
  const elBody = document.getElementById("modalBody");
  const elSpecs = document.getElementById("modalSpecs");
  const elBar = document.getElementById("modalBar");
  const elStatus = document.getElementById("modalStatus");
  let lastFocus = null;

  function open(card) {
    const title = card.querySelector("h3")?.textContent.trim() || "Module";
    const meta = card.querySelector(".card__meta")?.textContent.trim() || "// MODULE";
    const data = MODULE_DETAIL[title] || { body: card.querySelector("p")?.textContent || "", specs: [] };
    elTitle.textContent = title;
    elMeta.textContent = "// " + meta;
    elBody.textContent = data.body;
    elSpecs.innerHTML = data.specs.map((s) => `<li><span>${s[0]}</span><b>${s[1]}</b></li>`).join("");
    elStatus.textContent = "MODULE ONLINE · " + meta;
    elBar.style.width = "0%";
    lastFocus = card;
    universe.warp();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => { elBar.style.width = "100%"; }));
    modal.querySelector(".modal__close")?.focus();
  }
  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    universe.warp();
    if (lastFocus) lastFocus.focus?.();
  }

  document.querySelectorAll(".card").forEach((card) => {
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.addEventListener("click", () => open(card));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); }
    });
  });
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) close(); });
}

/* ---------------------------------------------------------------------
   BOOTSTRAP
--------------------------------------------------------------------- */
window.dispatchEvent(new Event("nova:ready")); // tells the HTML watchdog the module loaded

function boot() {
  runBoot();
  initPointer();
  initMagnetic();
  initTilt();
  initNav();
  initTransitions();
  initHUD();
  initFeed();
  initGate();
  initCards();
  // safety: if boot module errors, still reveal after a moment
  setTimeout(() => {
    if (!document.querySelector("[data-reveal].is-in")) startReveals();
  }, 6000);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", boot);
} else {
  boot(); // module executed after DOM already parsed
}

// If the Three.js module import fails entirely, degrade gracefully.
window.addEventListener("error", (e) => {
  if (e.message && /three|module/i.test(e.message)) {
    document.body.classList.add("no-webgl");
  }
});
