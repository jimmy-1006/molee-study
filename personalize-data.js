(() => {
  "use strict";

  const KEY = "molee-study-personalize-v1";

  const THEMES = {
    sakura: { name: "樱粉", accent: "#d7668b", rgb: "215, 102, 139", dark: "#a84464", deep: "#b7445d", soft: "#f9dfe8", tint: "#f9edf1", tint2: "#f3e1e7", topbar: "255, 239, 245", panel: "255, 242, 247" },
    vermilion: { name: "朱砂", accent: "#c2553c", rgb: "194, 85, 60", dark: "#98402c", deep: "#ab4a34", soft: "#f9e2d9", tint: "#faeee8", tint2: "#f3dfd6", topbar: "255, 240, 233", panel: "255, 244, 239" },
    bamboo: { name: "青竹", accent: "#5f8a6b", rgb: "95, 138, 107", dark: "#476a52", deep: "#51775c", soft: "#e3efe4", tint: "#eef5ee", tint2: "#e4efe5", topbar: "240, 248, 240", panel: "243, 249, 242" },
    sky: { name: "天青", accent: "#5b87a8", rgb: "91, 135, 168", dark: "#426780", deep: "#4c7392", soft: "#e1edf4", tint: "#edf4f8", tint2: "#e3eef4", topbar: "238, 246, 251", panel: "242, 248, 252" },
    wisteria: { name: "紫藤", accent: "#8a6fa8", rgb: "138, 111, 168", dark: "#6b5285", deep: "#775d95", soft: "#ece4f3", tint: "#f3eef8", tint2: "#eae2f2", topbar: "247, 242, 252", panel: "249, 244, 253" },
    gold: { name: "暮金", accent: "#b98a4e", rgb: "185, 138, 78", dark: "#8e6736", deep: "#a2763f", soft: "#f4ead9", tint: "#f8f2e7", tint2: "#f0e6d5", topbar: "253, 248, 238", panel: "255, 250, 242" },
  };

  const BACKGROUNDS = [
    { id: "sakura", name: "樱花", src: "assets/backgrounds/sakura.jpg" },
    { id: "gaara", name: "砂之国", src: "assets/backgrounds/gaara.jpg" },
  ];

  const defaults = {
    nickname: "",
    theme: "sakura",
    surfaceAlpha: 0.5,
    fontScale: 1,
    showCompanions: true,
    showQuotes: true,
    companionMinutes: 5,
    tasks: ["课后练习", "课堂参与", "笔记"],
    customQuotes: null,
    background: {
      kind: "builtin",
      id: "sakura",
      src: "assets/backgrounds/sakura.jpg",
      opacity: 0.5,
      size: 90,
      x: 88,
      y: 44,
    },
  };

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function load() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch (error) {
      stored = {};
    }
    const background = { ...defaults.background, ...(stored.background || {}) };
    const settings = {
      ...defaults,
      ...stored,
      background: {
        ...background,
        opacity: clamp(Number(background.opacity) || defaults.background.opacity, 0.08, 1),
        size: clamp(Number(background.size) || defaults.background.size, 40, 160),
        x: clamp(Number.isFinite(Number(background.x)) ? Number(background.x) : defaults.background.x, 0, 100),
        y: clamp(Number.isFinite(Number(background.y)) ? Number(background.y) : defaults.background.y, 0, 100),
      },
      surfaceAlpha: clamp(Number(stored.surfaceAlpha) || defaults.surfaceAlpha, 0.2, 0.9),
      fontScale: [0.9, 1, 1.12, 1.2].includes(Number(stored.fontScale)) ? Number(stored.fontScale) : 1,
      companionMinutes: [1, 5, 10, 30].includes(Number(stored.companionMinutes)) ? Number(stored.companionMinutes) : 5,
    };
    settings.tasks = Array.isArray(stored.tasks) && stored.tasks.length === 3
      ? stored.tasks.map((task, index) => String(task || defaults.tasks[index]).slice(0, 8))
      : [...defaults.tasks];
    if (!THEMES[settings.theme]) settings.theme = "sakura";
    settings.customQuotes = Array.isArray(stored.customQuotes) && stored.customQuotes.length
      ? stored.customQuotes
        .filter((quote) => quote && String(quote.text || "").trim())
        .map((quote) => ({ text: String(quote.text).slice(0, 120), author: String(quote.author || "佚名").slice(0, 24) }))
      : null;
    return settings;
  }

  let settings = load();
  let lastSaveOk = true;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
      lastSaveOk = true;
      return true;
    } catch (error) {
      lastSaveOk = false;
      return false;
    }
  }

  function apply() {
    const theme = THEMES[settings.theme] || THEMES.sakura;
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-rgb", theme.rgb);
    root.style.setProperty("--accent-dark", theme.dark);
    root.style.setProperty("--accent-deep", theme.deep);
    root.style.setProperty("--accent-soft", theme.soft);
    root.style.setProperty("--paper-tint", theme.tint);
    root.style.setProperty("--paper-tint-2", theme.tint2);
    root.style.setProperty("--topbar-rgb", theme.topbar);
    root.style.setProperty("--panel-rgb", theme.panel);
    root.style.setProperty("--surface-alpha", String(settings.surfaceAlpha));
    root.style.setProperty("--ambient-image", `url("${settings.background.src}")`);
    root.style.setProperty("--ambient-position", `${settings.background.x}% ${settings.background.y}%`);
    root.style.setProperty("--ambient-size", `auto ${settings.background.size}%`);
    root.style.setProperty("--ambient-opacity", String(settings.background.opacity));
    document.body.classList.toggle("hide-companions", !settings.showCompanions);
    document.body.classList.toggle("hide-quotes", !settings.showQuotes);
    document.body.classList.toggle("ui-scaled", settings.fontScale !== 1);
    document.body.style.zoom = settings.fontScale === 1 ? "" : String(settings.fontScale);
    updateScaledDialogBounds();
  }

  function updateScaledDialogBounds() {
    const root = document.documentElement;
    if (settings.fontScale === 1) {
      root.style.removeProperty("--ui-modal-width");
      root.style.removeProperty("--ui-modal-height");
      return;
    }
    root.style.setProperty("--ui-modal-width", `${Math.max(300, window.innerWidth / settings.fontScale - 44)}px`);
    root.style.setProperty("--ui-modal-height", `${Math.max(300, window.innerHeight / settings.fontScale - 50)}px`);
  }

  function nextSettings(patch) {
    return {
      ...settings,
      ...patch,
      background: { ...settings.background, ...(patch.background || {}) },
    };
  }

  function update(patch) {
    const previous = settings;
    const next = nextSettings(patch);
    if (patch.tasks) next.tasks = patch.tasks.slice(0, 3);
    settings = next;
    if (!save()) {
      settings = previous;
      apply();
      return null;
    }
    apply();
    return settings;
  }

  function preview(patch) {
    settings = nextSettings(patch);
    if (patch.tasks) settings.tasks = patch.tasks.slice(0, 3);
    apply();
    return settings;
  }

  function commit() {
    return save();
  }

  function resetBackground() {
    update({ background: { ...defaults.background } });
  }

  function resetAll() {
    settings = JSON.parse(JSON.stringify(defaults));
    save();
    apply();
  }

  function quotes() {
    return Array.isArray(settings.customQuotes) && settings.customQuotes.length ? settings.customQuotes : null;
  }

  window.MOLEE_PERSONAL = {
    KEY,
    THEMES,
    BACKGROUNDS,
    defaults,
    get settings() { return settings; },
    apply,
    update,
    preview,
    commit,
    save,
    get lastSaveOk() { return lastSaveOk; },
    resetBackground,
    resetAll,
    quotes,
    taskLabels: () => settings.tasks.slice(),
  };

  apply();
  window.addEventListener("resize", updateScaledDialogBounds);
})();
