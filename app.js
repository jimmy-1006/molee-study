(() => {
  "use strict";

  const DATA = window.MOLEE_DATA;
  if (!DATA || !Array.isArray(DATA.subjects)) {
    return;
  }

  const STORAGE = {
    chapters: "molee-study-chapters-v1",
    exams: "molee-study-exams-v1",
    mistakes: "molee-study-mistakes-v1",
    review: "molee-study-review-v1",
  };

  const VIEW_META = {
    dashboard: { eyebrow: "道场 · 今日修习", title: "修习总览" },
    schedule: { eyebrow: "路线 · 课程安排", title: "课程表" },
    missions: { eyebrow: "卷轴 · 章节任务", title: "章节任务" },
    mistakes: { eyebrow: "忍具 · 错题复习", title: "错题卷轴" },
  };

  const COMPANIONS = [
    { file: "naruto.jpg", name: "漩涡鸣人" },
    { file: "sasuke-night.jpg", name: "宇智波佐助" },
    { file: "kakashi-night.jpg", name: "旗木卡卡西" },
    { file: "itachi.jpg", name: "宇智波鼬" },
    { file: "minato.jpg", name: "波风水门" },
    { file: "tsunade.jpg", name: "纲手" },
    { file: "obito-goggles.jpg", name: "宇智波带土" },
    { file: "obito-helmet.jpg", name: "宇智波带土" },
    { file: "madara.jpg", name: "宇智波斑" },
    { file: "sasuke-violet.jpg", name: "宇智波佐助" },
    { file: "kakashi-day.jpg", name: "旗木卡卡西" },
  ].map((companion) => ({ ...companion, src: `assets/companions/${companion.file}` }));

  const COMPANION_BY_FILE = new Map(COMPANIONS.map((companion) => [companion.file, companion]));
  const PAGE_COMPANIONS = {
    dashboard: "naruto.jpg",
    schedule: "kakashi-night.jpg",
    missions: "sasuke-night.jpg",
    mistakes: "itachi.jpg",
  };

  const SUBJECT_COMPANION_START = {
    s01: "tsunade.jpg",
    s02: "kakashi-day.jpg",
    s03: "sasuke-violet.jpg",
    s04: "itachi.jpg",
    s05: "naruto.jpg",
    s06: "obito-goggles.jpg",
    s07: "minato.jpg",
    s08: "obito-helmet.jpg",
  };

  const subjectCompanionCursor = new Map(
    DATA.subjects.map((subject) => {
      const startFile = subject.avatar || SUBJECT_COMPANION_START[subject.id] || COMPANIONS[0].file;
      const startIndex = COMPANIONS.findIndex((companion) => companion.file === startFile);
      return [subject.id, startIndex >= 0 ? startIndex : 0];
    })
  );

  function syncSubjectCompanionAvatars() {
    DATA.subjects.forEach((subject) => {
      if (!subject.avatar) return;
      const preferredIndex = COMPANIONS.findIndex((companion) => companion.file === subject.avatar);
      if (preferredIndex >= 0) subjectCompanionCursor.set(subject.id, preferredIndex);
    });
  }

  const NINJA_QUOTES = [
    { text: "我从来不会收回自己说过的话，这就是我的忍道。", author: "漩涡鸣人" },
    { text: "不遵守规则的人是废物，但不珍惜同伴的人连废物都不如。", author: "旗木卡卡西" },
    { text: "人只有在放弃的时候，才会真正失败。", author: "自来也" },
    { text: "努力，是可以超越天才的。", author: "洛克·李" },
    { text: "有树叶飞舞的地方，火就会燃烧。", author: "猿飞日斩" },
    { text: "我要成为火影，让村子里的每一个人都认可我。", author: "漩涡鸣人" },
    { text: "青春，就是用来燃烧的。", author: "迈特凯" },
    { text: "忍者的价值，不在于怎样活着，而在于死前留下了什么。", author: "自来也" },
  ];

  function companionRotationMs() {
    const minutes = Number(window.MOLEE_PERSONAL?.settings?.companionMinutes) || 5;
    return minutes * 60 * 1000;
  }
  const QUOTE_ROTATION_MS = 5 * 60 * 1000;

  function activeQuotes() {
    const custom = window.MOLEE_PERSONAL?.quotes?.();
    return Array.isArray(custom) && custom.length ? custom : NINJA_QUOTES;
  }

  function greetingText() {
    const nickname = String(window.MOLEE_PERSONAL?.settings?.nickname || "").trim();
    if (!nickname) return "今日忍道 · 一页一章";
    const hour = new Date().getHours();
    const greet = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
    return `${greet}，${nickname} · 今日修习`;
  }

  const SUBJECT_THEMES = {
    ember: { ink: "#9f4564", soft: "#f9dfe8", accent: "#d7668b" },
    crimson: { ink: "#9b3f52", soft: "#f7dce2", accent: "#c9637a" },
    rose: { ink: "#a44873", soft: "#f9deeb", accent: "#d978a3" },
    violet: { ink: "#725c90", soft: "#eee5f4", accent: "#987eb6" },
    teal: { ink: "#657d69", soft: "#e5eee4", accent: "#88a18c" },
    sky: { ink: "#647e8d", soft: "#e2edf1", accent: "#89a4b1" },
    sunset: { ink: "#a35d55", soft: "#f5e1dc", accent: "#ca8073" },
    leaf: { ink: "#72815a", soft: "#e9efe1", accent: "#96a579" },
  };

  const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const WEEKDAY_FULL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  let SUBJECT_BY_ID = new Map();
  const DEFAULT_EXAM = DATA.meta.defaultExamDate
    ? {
        subject: {
          id: "final-exam",
          name: DATA.meta.defaultExamLabel || "期末统考",
          short: "期末",
          mark: "考",
          theme: "rose",
        },
        value: DATA.meta.defaultExamDate,
      }
    : null;
  let MAX_WEEK = 1;

  function refreshIndexes() {
    SUBJECT_BY_ID = new Map(DATA.subjects.map((subject) => [subject.id, subject]));
    const sessionWeeks = DATA.sessions.map((session) => Number(session.week) || 1);
    const declaredWeeks = Number(DATA.meta.totalWeeks) || 0;
    MAX_WEEK = Math.max(1, declaredWeeks, ...sessionWeeks);
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      toast("本地存储空间不足，刚才的修改可能无法保留。");
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function formatNumber(value) {
    const rounded = Math.round((Number(value) || 0) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function localDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(value) {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function formatDateCN(date) {
    if (!date) return "未设置";
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function formatDateLong(date) {
    if (!date) return "未设置";
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_FULL[date.getDay()]}`;
  }

  function formatExamValue(raw) {
    if (!raw) return "未设置";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "未设置";
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function semesterWeek(date = new Date()) {
    const start = parseLocalDate(DATA.meta.semesterStart);
    if (!start) return 1;
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.floor((current.getTime() - start.getTime()) / 86400000);
    return clamp(Math.floor(days / 7) + 1, 1, MAX_WEEK);
  }

  function subjectTheme(subject) {
    return SUBJECT_THEMES[subject?.theme] || SUBJECT_THEMES.ember;
  }

  function subjectStyle(subject) {
    const theme = subjectTheme(subject);
    return `--subject-ink:${theme.ink};--subject-soft:${theme.soft};--subject-accent:${theme.accent}`;
  }

  function defaultChapterState() {
    return { done: false, tasks: { examHelp: false, xuetang: false, notes: false }, note: "", updatedAt: "" };
  }

  refreshIndexes();

  const initialSubjectId = DATA.subjects[0]?.id || "s01";
  const state = {
    view: "dashboard",
    activeSubjectId: initialSubjectId,
    scheduleWeek: semesterWeek(),
    scheduleSubject: "all",
    mistakeSubject: "all",
    mistakeSearch: "",
    chapterSearch: "",
    chapterOpen: new Set(),
    chapterState: readJSON(STORAGE.chapters, {}),
    exams: readJSON(STORAGE.exams, {}),
    mistakes: readJSON(STORAGE.mistakes, []),
    reviewPositions: readJSON(STORAGE.review, {}),
    pendingFiles: [],
    editingMistakeId: null,
    review: { subjectId: null, cards: [], index: 0, flipped: false },
  };

  function chapterRecord(chapterId) {
    if (!state.chapterState[chapterId]) {
      state.chapterState[chapterId] = defaultChapterState();
    }
    const record = state.chapterState[chapterId];
    record.tasks = { ...defaultChapterState().tasks, ...(record.tasks || {}) };
    return record;
  }

  function chapterById(chapterId) {
    for (const subject of DATA.subjects) {
      const chapter = subject.chapters.find((item) => item.id === chapterId);
      if (chapter) return chapter;
    }
    return null;
  }

  function saveChapters() {
    writeJSON(STORAGE.chapters, state.chapterState);
  }

  function subjectStats(subject) {
    const chapters = subject.chapters || [];
    const totalHours = chapters.reduce((sum, chapter) => sum + Number(chapter.hours || 0), 0);
    const doneChapters = chapters.filter((chapter) => chapterRecord(chapter.id).done);
    const doneHours = doneChapters.reduce((sum, chapter) => sum + Number(chapter.hours || 0), 0);
    return {
      totalChapters: chapters.length,
      doneChapters: doneChapters.length,
      totalHours,
      doneHours,
      percent: totalHours ? (doneHours / totalHours) * 100 : 0,
    };
  }

  function overallStats() {
    const stats = DATA.subjects.map(subjectStats);
    const totalChapters = stats.reduce((sum, item) => sum + item.totalChapters, 0);
    const doneChapters = stats.reduce((sum, item) => sum + item.doneChapters, 0);
    const totalHours = stats.reduce((sum, item) => sum + item.totalHours, 0);
    const doneHours = stats.reduce((sum, item) => sum + item.doneHours, 0);
    return {
      totalChapters,
      doneChapters,
      totalHours,
      doneHours,
      percent: totalHours ? (doneHours / totalHours) * 100 : 0,
    };
  }

  function rankFor(percent) {
    if (percent >= 92) return { name: "影级", copy: "各科修行接近圆满，最后几章也要稳稳落笔。" };
    if (percent >= 72) return { name: "精英上忍", copy: "主线已经清晰，接下来是查漏补缺和反复巩固。" };
    if (percent >= 48) return { name: "上忍", copy: "多科目的修行已经连成线，别让笔记停在半页。" };
    if (percent >= 24) return { name: "中忍", copy: "节奏正在形成，今天再完成一张章节卷轴。" };
    if (percent > 0) return { name: "下忍", copy: "第一枚印章已经落下，继续把课时变成掌握。" };
    return { name: "下忍", copy: "第一卷卷轴，等待落笔。" };
  }

  function nearestExam() {
    const now = Date.now();
    return Object.entries(state.exams)
      .map(([subjectId, value]) => {
        const date = new Date(value);
        return { subjectId, subject: SUBJECT_BY_ID.get(subjectId), value, date, ms: date.getTime() };
      })
      .filter((item) => item.subject && !Number.isNaN(item.ms) && item.ms >= now)
      .sort((left, right) => left.ms - right.ms)[0] || null;
  }

  function countdownText(targetMs, withSeconds = false) {
    const diff = targetMs - Date.now();
    if (diff <= 0) return "已到考试时间";
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}天 ${String(hours).padStart(2, "0")}小时${withSeconds ? ` ${String(minutes).padStart(2, "0")}分` : ""}`;
    if (hours > 0) return `${hours}小时 ${String(minutes).padStart(2, "0")}分`;
    return `${minutes}分 ${String(seconds).padStart(2, "0")}秒`;
  }

  function examItems(now = Date.now()) {
    const configured = Object.entries(state.exams)
      .map(([subjectId, value]) => {
        const date = new Date(value);
        return { subjectId, subject: SUBJECT_BY_ID.get(subjectId), value, date, ms: date.getTime() };
      })
      .filter((item) => item.subject && !Number.isNaN(item.ms) && item.ms >= now)
      .sort((left, right) => left.ms - right.ms);
    if (configured.length || !DEFAULT_EXAM) return configured;
    const date = new Date(DEFAULT_EXAM.value);
    const ms = date.getTime();
    if (Number.isNaN(ms) || ms < now) return [];
    return [{ subjectId: DEFAULT_EXAM.subject.id, subject: DEFAULT_EXAM.subject, value: DEFAULT_EXAM.value, date, ms, isDefault: true }];
  }

  function countdownSpeech(item) {
    const totalMinutes = Math.max(0, Math.floor((item.ms - Date.now()) / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}天`);
    if (hours) parts.push(`${hours}小时`);
    if (minutes || !parts.length) parts.push(`${minutes}分钟`);
    const label = item.isDefault ? item.subject.name : `${item.subject.name}考试`;
    return `距离${label}还有${parts.join("")}。请安排好复习节奏。`;
  }

  function announceExamCountdown() {
    const item = examItems()[0];
    if (!item) {
      toast("还没有可播报的考试倒计时。");
      return;
    }
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      toast("当前系统不支持语音播报。");
      return;
    }
    const message = countdownSpeech(item);
    const utterance = new SpeechSynthesisUtterance(message);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /^zh[-_]CN/i.test(voice.lang) && /Ting|Meijia|Sinji|Chinese/i.test(voice.name))
      || voices.find((voice) => /^zh/i.test(voice.lang))
      || null;
    utterance.lang = "zh-CN";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onerror = (event) => {
      if (!["interrupted", "canceled"].includes(event.error)) toast("语音播报失败，请检查系统语音设置。");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    toast(message);
  }

  let toastTimer = 0;
  function toast(message) {
    const element = $("#toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => element.classList.remove("is-visible"), 2800);
  }

  let attachmentDbPromise = null;
  function attachmentDb() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
    if (!attachmentDbPromise) {
      attachmentDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("molee-study-files", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("files")) {
            const store = database.createObjectStore("files", { keyPath: "id" });
            store.createIndex("cardId", "cardId", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return attachmentDbPromise;
  }

  async function addAttachmentFiles(cardId, files) {
    if (!files.length) return [];
    const database = await attachmentDb();
    const metadata = [];
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      const store = transaction.objectStore("files");
      files.forEach((file, index) => {
        const id = `${cardId}-file-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
        const record = { id, cardId, name: file.name, type: file.type || "", size: file.size || 0, blob: file, createdAt: new Date().toISOString() };
        metadata.push({ id, name: record.name, type: record.type, size: record.size });
        store.put(record);
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    return metadata;
  }

  async function deleteCardFiles(cardId) {
    const database = await attachmentDb();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readwrite");
      const store = transaction.objectStore("files");
      const index = store.index("cardId");
      const request = index.getAllKeys(cardId);
      request.onsuccess = () => {
        request.result.forEach((key) => store.delete(key));
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function getAttachmentRecord(id) {
    const database = await attachmentDb();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("files", "readonly");
      const request = transaction.objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function openAttachment(id) {
    try {
      const record = await getAttachmentRecord(id);
      if (!record?.blob) {
        toast("附件不存在或已被清理。");
        return;
      }
      const url = URL.createObjectURL(record.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.download = record.name || "attachment";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      toast("附件打开失败，请重新添加。");
    }
  }

  function closeSidebar() {
    $("#sidebar")?.classList.remove("is-open");
    $("#sidebar-scrim")?.classList.remove("is-visible");
    document.body.classList.remove("menu-open");
  }

  function setPageCompanion(view) {
    const container = $("#page-companion");
    const image = $("#page-companion-image");
    if (!container || !image) return;
    const companion = COMPANION_BY_FILE.get(PAGE_COMPANIONS[view]) || COMPANIONS[0];
    const applyCompanion = () => {
      image.src = companion.src;
      image.alt = companion.name;
      container.title = companion.name;
      container.classList.remove("is-changing");
    };
    if (image.getAttribute("src") === companion.src) {
      applyCompanion();
      return;
    }
    container.classList.add("is-changing");
    window.setTimeout(applyCompanion, 160);
  }

  let heroCompanionIndex = 0;
  let heroCompanionActiveLayer = 0;
  let heroCompanionTimer = null;

  function applyHeroCompanion(index) {
    const layerA = $("#hero-companion-a");
    const layerB = $("#hero-companion-b");
    const tag = $("#hero-companion-tag");
    if (!layerA || !layerB) return;
    const layers = [layerA, layerB];
    const target = COMPANIONS[(index + COMPANIONS.length) % COMPANIONS.length];
    const departing = layers[heroCompanionActiveLayer];
    const arriving = layers[1 - heroCompanionActiveLayer];
    arriving.src = target.src;
    arriving.classList.add("is-active");
    departing.classList.remove("is-active");
    heroCompanionActiveLayer = 1 - heroCompanionActiveLayer;
    heroCompanionIndex = (index + COMPANIONS.length) % COMPANIONS.length;
    if (tag) tag.textContent = target.name;
  }

  function scheduleHeroCompanionRotation() {
    window.clearInterval(heroCompanionTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    heroCompanionTimer = window.setInterval(() => {
      if (document.hidden || state.view !== "dashboard") return;
      applyHeroCompanion(heroCompanionIndex + 1);
    }, companionRotationMs());
  }

  function stepHeroCompanion(direction) {
    applyHeroCompanion(heroCompanionIndex + direction);
    scheduleHeroCompanionRotation();
  }

  function initCompanionCarousel() {
    const layerA = $("#hero-companion-a");
    const layerB = $("#hero-companion-b");
    const tag = $("#hero-companion-tag");
    if (!layerA || !layerB) return;
    layerA.src = COMPANIONS[0].src;
    layerB.src = COMPANIONS[1].src;
    if (tag) tag.textContent = COMPANIONS[0].name;
    scheduleHeroCompanionRotation();
  }

  let subjectCompanionTimer = null;

  function stepSubjectCompanion(direction, resetTimer = true) {
    const subject = SUBJECT_BY_ID.get(state.activeSubjectId) || DATA.subjects[0];
    const stage = $(".subject-companion-stage");
    const layerA = $("#subject-companion-a");
    const layerB = $("#subject-companion-b");
    if (!subject || !stage || !layerA || !layerB) return;
    const layers = [layerA, layerB];
    const currentIndex = subjectCompanionCursor.get(subject.id) ?? 0;
    const nextIndex = (currentIndex + direction + COMPANIONS.length) % COMPANIONS.length;
    const activeLayer = Number(stage.dataset.activeLayer) || 0;
    const departing = layers[activeLayer];
    const arriving = layers[1 - activeLayer];
    const target = COMPANIONS[nextIndex];
    arriving.src = target.src;
    arriving.classList.add("is-active");
    departing.classList.remove("is-active");
    stage.dataset.activeLayer = String(1 - activeLayer);
    subjectCompanionCursor.set(subject.id, nextIndex);
    const group = $("#subject-focus-companion");
    if (group) {
      group.title = target.name;
      group.setAttribute("aria-label", `科目随行头像：${target.name}`);
    }
    if (resetTimer) scheduleSubjectCompanionRotation();
  }

  function scheduleSubjectCompanionRotation() {
    window.clearInterval(subjectCompanionTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    subjectCompanionTimer = window.setInterval(() => {
      if (document.hidden || state.view !== "missions") return;
      stepSubjectCompanion(1, false);
    }, companionRotationMs());
  }

  let heroQuoteIndex = 0;
  let heroQuoteTimer = null;
  let heroQuoteSwitching = false;

  function applyHeroQuote(index) {
    const text = $("#hero-quote-text");
    const cite = $("#hero-quote-cite");
    const list = activeQuotes();
    const quote = list[((index % list.length) + list.length) % list.length] || list[0];
    if (text) text.textContent = quote.text;
    if (cite) cite.textContent = `—— ${quote.author}`;
  }

  function switchHeroQuote(nextIndex, resetTimer = true) {
    const inner = $("#hero-quote-inner");
    if (!inner || heroQuoteSwitching) return;
    heroQuoteSwitching = true;
    inner.classList.add("is-switching-out");
    window.setTimeout(() => {
      const list = activeQuotes();
      heroQuoteIndex = (nextIndex + list.length) % list.length;
      applyHeroQuote(heroQuoteIndex);
      inner.classList.remove("is-switching-out");
      inner.classList.add("is-switching-in");
      window.setTimeout(() => {
        inner.classList.remove("is-switching-in");
        heroQuoteSwitching = false;
      }, 480);
    }, 280);
    if (resetTimer) scheduleQuoteRotation();
  }

  function scheduleQuoteRotation() {
    window.clearInterval(heroQuoteTimer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    heroQuoteTimer = window.setInterval(() => {
      if (document.hidden || state.view !== "dashboard") return;
      switchHeroQuote(heroQuoteIndex + 1, false);
    }, QUOTE_ROTATION_MS);
  }

  function initQuoteCarousel() {
    applyHeroQuote(0);
    scheduleQuoteRotation();
  }

  function preloadCompanionArtwork() {
    COMPANIONS.forEach((companion) => {
      const image = new Image();
      image.src = companion.src;
    });
  }

  function setView(view, options = {}) {
    const nextView = VIEW_META[view] ? view : "dashboard";
    state.view = nextView;
    $$("[data-view-panel]").forEach((panel) => {
      const active = panel.dataset.viewPanel === nextView;
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    });
    $$(".nav-button[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === nextView);
      button.setAttribute("aria-current", button.dataset.view === nextView ? "page" : "false");
    });
    $("#page-eyebrow").textContent = VIEW_META[nextView].eyebrow;
    $("#page-title").textContent = VIEW_META[nextView].title;
    setPageCompanion(nextView);
    closeSidebar();
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    if (location.hash !== `#${nextView}`) {
      try {
        history.replaceState(null, "", `#${nextView}`);
      } catch (error) {
        location.hash = nextView;
      }
    }
  }

  function renderProgress() {
    const stats = overallStats();
    const percent = stats.percent;
    const rank = rankFor(percent);
    $("#hero-progress").textContent = `${Math.round(percent)}%`;
    $("#hero-hours").textContent = `${formatNumber(stats.doneHours)}h`;
    $("#metric-chapters").textContent = `${stats.doneChapters} / ${stats.totalChapters}`;
    $("#metric-hours").textContent = `${formatNumber(stats.doneHours)} / ${formatNumber(stats.totalHours)}h`;
    $("#metric-chapter-copy").textContent = stats.doneChapters ? `已完成 ${Math.round(percent)}%，继续把卷轴写满` : "第一枚印章等你落下";
    $("#rank-name").textContent = rank.name;
    $("#rank-copy").textContent = rank.copy;
    $("#rank-percent").textContent = `${Math.round(percent)}%`;
    $("#rank-progress").style.width = `${clamp(percent, 0, 100)}%`;
  }

  function renderStaticTexts() {
    const today = new Date();
    $("#today-label").textContent = `${today.getMonth() + 1}月${today.getDate()}日 · ${WEEKDAY_FULL[today.getDay()]}`;
    $("#sidebar-subject-count").textContent = String(DATA.subjects.length);
    const kicker = $("#hero-kicker-text");
    if (kicker) kicker.textContent = greetingText();
    const totalChapters = DATA.subjects.reduce((sum, subject) => sum + (subject.chapters?.length || 0), 0);
    const totalHours = DATA.subjects.reduce((sum, subject) => sum + (subject.chapters || []).reduce((hours, chapter) => hours + Number(chapter.hours || 0), 0), 0);
    const stampLabel = $("#semester-label");
    if (stampLabel) stampLabel.textContent = DATA.meta.semester || "本学期";
    const stampSummary = $("#semester-summary");
    if (stampSummary) stampSummary.textContent = `${DATA.subjects.length} 科 · ${totalChapters} 章 · ${formatNumber(totalHours)} 课时`;
    const panelTitle = $("#subject-panel-title");
    if (panelTitle) panelTitle.textContent = `${chineseCount(DATA.subjects.length)}科修行卷轴`;
    const heroSubjects = $("#hero-streak");
    if (heroSubjects) heroSubjects.textContent = String(DATA.subjects.length);
  }

  function chineseCount(value) {
    const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    const number = Number(value) || 0;
    if (number <= 10) return digits[number];
    return String(number);
  }

  function renderSidebarSubjects() {
    const container = $("#sidebar-subjects");
    if (!container) return;
    container.innerHTML = DATA.subjects.map((subject) => {
      const stats = subjectStats(subject);
      const active = subject.id === state.activeSubjectId && state.view === "missions";
      return `
        <button class="sidebar-subject${active ? " is-active" : ""}" type="button" data-subject-open="${escapeHTML(subject.id)}" style="${subjectStyle(subject)}">
          <span class="subject-mark">${escapeHTML(subject.mark)}</span>
          <span class="sidebar-subject-copy"><strong>${escapeHTML(subject.name)}</strong><small>${stats.doneChapters}/${stats.totalChapters} 章 · ${Math.round(stats.percent)}%</small></span>
          <span class="sidebar-subject-percent">${Math.round(stats.percent)}%</span>
        </button>`;
    }).join("");
  }

  function subjectFilterMarkup(kind, activeValue, withCounts = false) {
    const active = activeValue || "all";
    const chips = [`<button class="filter-chip${active === "all" ? " is-active" : ""}" type="button" data-${kind}-subject="all">全部</button>`];
    DATA.subjects.forEach((subject) => {
      let count = "";
      if (withCounts) {
        const value = state.mistakes.filter((card) => card.subjectId === subject.id).length;
        count = `<b>${value}</b>`;
      }
      chips.push(`<button class="filter-chip${active === subject.id ? " is-active" : ""}" type="button" data-${kind}-subject="${escapeHTML(subject.id)}" style="${subjectStyle(subject)}"><i class="filter-dot"></i>${escapeHTML(subject.short)}${count}</button>`);
    });
    return chips.join("");
  }

  function renderExamEditors() {
    const container = $("#exam-editor-list");
    if (!container) return;
    container.innerHTML = DATA.subjects.map((subject) => {
      const value = state.exams[subject.id] || "";
      return `
        <label class="exam-editor-row" style="${subjectStyle(subject)}">
          <span class="exam-editor-subject"><span class="subject-mark">${escapeHTML(subject.mark)}</span><span><strong>${escapeHTML(subject.name)}</strong><small>${value ? "已设置考试时间" : "尚未设置"}</small></span></span>
          <input type="datetime-local" data-exam-subject="${escapeHTML(subject.id)}" value="${escapeHTML(value)}">
        </label>`;
    }).join("");
  }

  function examListMarkup(items) {
    if (!items.length) return "";
    return items.map((item) => `
      <div class="exam-mini-row" style="${subjectStyle(item.subject)}">
        <span class="subject-mark small">${escapeHTML(item.subject.mark)}</span>
        <span class="exam-mini-copy"><strong>${escapeHTML(item.subject.name)}</strong><small>${escapeHTML(formatExamValue(item.value))}</small></span>
        <span class="exam-mini-countdown" data-countdown="${item.ms}">${escapeHTML(countdownText(item.ms))}</span>
      </div>`).join("");
  }

  function chapterCardMarkup(subject, chapter, index, query) {
    const record = chapterRecord(chapter.id);
    const isOpen = state.chapterOpen.has(chapter.id) || Boolean(query);
    const completedTasks = Object.values(record.tasks).filter(Boolean).length;
    const labels = window.MOLEE_PERSONAL?.taskLabels?.() || ["课后练习", "课堂参与", "笔记"];
    const taskItems = [
      { key: "examHelp", label: labels[0], hint: "做题与巩固" },
      { key: "xuetang", label: labels[1], hint: "听课与签到" },
      { key: "notes", label: labels[2], hint: "整理与回看" },
    ];
    return `
      <article class="chapter-card${record.done ? " is-done" : ""}${isOpen ? " is-open" : ""}" data-chapter-id="${escapeHTML(chapter.id)}" style="${subjectStyle(subject)}">
        <div class="chapter-row">
          <label class="chapter-check" title="标记章节完成">
            <input type="checkbox" data-chapter-check="${escapeHTML(chapter.id)}" ${record.done ? "checked" : ""}>
            <span class="chapter-check-visual"><svg class="icon"><use href="#i-check"></use></svg></span>
          </label>
          <span class="chapter-order">${String(index + 1).padStart(2, "0")}</span>
          <button class="chapter-main-toggle" type="button" data-chapter-toggle="${escapeHTML(chapter.id)}">
            <span class="chapter-title-line"><strong>${escapeHTML(chapter.title)}</strong><b class="hours-chip">${formatNumber(chapter.hours)} 课时</b></span>
            <span class="chapter-subline">${record.done ? "已完成本章" : `${completedTasks}/3 项小任务已落笔`}${chapter.sessions?.length ? ` · ${chapter.sessions.length} 次课堂` : ""}</span>
          </button>
          <button class="chapter-edit" type="button" aria-label="编辑章节" data-edit-chapter="${escapeHTML(chapter.id)}"><svg class="icon"><use href="#i-edit"></use></svg></button>
          <button class="chapter-expand${isOpen ? " is-open" : ""}" type="button" aria-label="${isOpen ? "收起" : "展开"}章节" data-chapter-toggle="${escapeHTML(chapter.id)}"><svg class="icon"><use href="#i-chevron"></use></svg></button>
        </div>
        <div class="chapter-body"${isOpen ? "" : " hidden"}>
          ${chapter.description ? `<div class="chapter-outline-note"><span>章节说明</span><p>${escapeHTML(chapter.description)}</p></div>` : ""}
          ${chapter.outlineTitle || chapter.objective ? `<div class="chapter-outline-note"><span>教学大纲</span><strong>${escapeHTML(chapter.outlineTitle || chapter.title)}</strong>${chapter.objective ? `<p>${escapeHTML(chapter.objective)}</p>` : ""}</div>` : ""}
          <div class="chapter-section-label"><span>课程安排</span><small>来自课程表安排</small></div>
          <div class="chapter-sessions">${chapterSessionsMarkup(chapter)}</div>
          <div class="chapter-section-label"><span>本章三项修行</span><small>子任务只作过程核对，不重复计入总进度</small></div>
          <div class="chapter-subtasks">
            ${taskItems.map((item) => `
              <label class="subtask-item${record.tasks[item.key] ? " is-checked" : ""}">
                <input type="checkbox" data-subtask="${escapeHTML(item.key)}" data-chapter="${escapeHTML(chapter.id)}" ${record.tasks[item.key] ? "checked" : ""}>
                <span class="subtask-seal"><svg class="icon"><use href="#i-check"></use></svg></span>
                <span><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.hint)}</small></span>
              </label>`).join("")}
          </div>
          <div class="chapter-section-label"><span>章节笔记</span><small>输入后自动保存到本机</small></div>
          <textarea class="chapter-note" data-chapter-note="${escapeHTML(chapter.id)}" rows="3" placeholder="记下这一章的重点、易错点和复习提醒……">${escapeHTML(record.note || "")}</textarea>
        </div>
      </article>`;
  }

  function renderChapters() {
    const container = $("#chapter-list");
    const subject = SUBJECT_BY_ID.get(state.activeSubjectId) || DATA.subjects[0];
    if (!container || !subject) return;
    const query = state.chapterSearch.trim().toLowerCase();
    const chapters = subject.chapters.filter((chapter) => {
      if (!query) return true;
      const haystack = [chapter.title, chapter.outlineTitle, chapter.objective, ...(chapter.sessions || []).map((session) => session.content)].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    const count = $("#chapter-visible-count");
    if (count) count.textContent = query ? `找到 ${chapters.length} / ${subject.chapters.length} 章` : `${subject.chapters.length} 个章节卷轴`;
    const expandAll = $("#expand-all-chapters");
    const allOpen = subject.chapters.length > 0 && subject.chapters.every((chapter) => state.chapterOpen.has(chapter.id));
    if (expandAll) expandAll.textContent = allOpen ? "收起全部" : "展开全部";
    container.innerHTML = chapters.length
      ? chapters.map((chapter) => chapterCardMarkup(subject, chapter, subject.chapters.indexOf(chapter), query)).join("")
      : subject.chapters.length
        ? `<div class="empty-state"><strong>没有找到对应章节</strong><p>换个关键词，或者切换到其他科目卷轴。</p></div>`
        : `<div class="empty-state"><strong>这门课还没有章节</strong><p>把课程拆成能一章一章推进的小目标，进度才会动起来。</p><button class="ink-button" type="button" data-add-chapter="${escapeHTML(subject.id)}">添加第一章</button></div>`;
  }

  function renderEmptyCatalogView() {
    const tabs = $("#subject-tabs");
    if (tabs) tabs.innerHTML = "";
    const focus = $("#subject-focus");
    if (focus) {
      focus.innerHTML = `<div class="empty-state catalog-empty"><strong>还没有课程</strong><p>先添加一门课，再把它拆成章节。课程、章节和课表都会保存在这台电脑上。</p><button class="ink-button" type="button" id="empty-add-course">添加第一门课程</button></div>`;
    }
    const list = $("#chapter-list");
    if (list) list.innerHTML = "";
    const count = $("#chapter-visible-count");
    if (count) count.textContent = "0 个章节卷轴";
  }

  function renderMissions() {
    if (!DATA.subjects.length) {
      renderEmptyCatalogView();
      return;
    }
    renderSubjectTabs();
    renderSubjectFocus();
    renderChapters();
  }

  function sessionSectionText(session) {
    return session.section ? `${session.section} 节` : "节次待定";
  }

  function sessionGroupText(session) {
    return session.group || "全部";
  }

  function scheduleSessionCard(session) {
    const subject = SUBJECT_BY_ID.get(session.subjectId);
    return `
      <article class="schedule-session-card${session.type === "practice" ? " is-practice" : ""}" style="${subjectStyle(subject)}">
        <div class="schedule-session-top"><span class="schedule-session-subject"><i class="filter-dot"></i>${escapeHTML(subject?.short || session.subject)}</span><span class="schedule-session-type">${session.type === "practice" ? "实践" : "理论"}</span><button class="session-edit" type="button" data-edit-session="${escapeHTML(session.id)}" aria-label="编辑这节课"><svg class="icon"><use href="#i-edit"></use></svg></button></div>
        <strong>${escapeHTML(session.content)}</strong>
        <div class="session-tags"><span>节次 ${escapeHTML(sessionSectionText(session))}</span><span>分组 ${escapeHTML(sessionGroupText(session))}</span></div>
        <div class="schedule-session-meta"><span>${escapeHTML(session.time || "时间待定")}</span><span>${escapeHTML(session.teacher || session.department || "教师待定")}</span></div>
        ${session.place ? `<small class="schedule-session-place"><svg class="icon"><use href="#i-location"></use></svg>${escapeHTML(session.place)}</small>` : ""}
      </article>`;
  }

  function renderSchedule() {
    const semesterStart = parseLocalDate(DATA.meta.semesterStart) || new Date();
    const weekStart = addDays(semesterStart, (state.scheduleWeek - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    $("#schedule-week-title").textContent = `第 ${state.scheduleWeek} 周`;
    $("#schedule-week-range").textContent = `${formatDateCN(weekStart)} — ${formatDateCN(weekEnd)}`;
    $("#schedule-subject-filter").innerHTML = subjectFilterMarkup("schedule", state.scheduleSubject);

    const weekSessions = DATA.sessions
      .filter((session) => session.date >= localDateISO(weekStart) && session.date <= localDateISO(weekEnd))
      .filter((session) => state.scheduleSubject === "all" || session.subjectId === state.scheduleSubject)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.time).localeCompare(String(right.time), "zh-CN"));
    const hours = weekSessions.reduce((sum, session) => sum + Number(session.hours || 0), 0);
    $("#schedule-count").textContent = `本周 ${weekSessions.length} 节 · ${formatNumber(hours)} 课时`;

    const todayISO = localDateISO(new Date());
    const grid = $("#schedule-grid");
    grid.innerHTML = WEEKDAYS.map((label, index) => {
      const date = addDays(weekStart, index);
      const iso = localDateISO(date);
      const sessions = weekSessions.filter((session) => session.date === iso);
      return `
        <section class="schedule-day${iso === todayISO ? " is-today" : ""}">
          <header class="schedule-day-head"><span>周${label}</span><strong>${date.getMonth() + 1}/${date.getDate()}</strong>${iso === todayISO ? "<i>今天</i>" : ""}</header>
          <div class="schedule-day-list">
            ${sessions.length ? sessions.map(scheduleSessionCard).join("") : `<div class="schedule-day-empty"><span>—</span><small>无课</small></div>`}
          </div>
        </section>`;
    }).join("");

    const upcoming = DATA.sessions
      .filter((session) => session.date >= todayISO)
      .filter((session) => state.scheduleSubject === "all" || session.subjectId === state.scheduleSubject)
      .sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.time).localeCompare(String(right.time), "zh-CN"))
      .slice(0, 3);
    const upcomingContainer = $("#upcoming-sessions");
    upcomingContainer.innerHTML = upcoming.length
      ? upcoming.map((session) => {
          const subject = SUBJECT_BY_ID.get(session.subjectId);
          const date = parseLocalDate(session.date);
          return `
            <div class="upcoming-session-row" style="${subjectStyle(subject)}">
              <span class="upcoming-date"><strong>${String(date.getDate()).padStart(2, "0")}</strong><small>${date.getMonth() + 1}月 · 周${session.weekday}</small></span>
              <span class="subject-mark">${sessionSubjectMark(session)}</span>
              <span class="upcoming-copy"><strong>${escapeHTML(session.content)}</strong><small>${escapeHTML(subject?.name || session.subject)} · 节次 ${escapeHTML(sessionSectionText(session))} · 分组 ${escapeHTML(sessionGroupText(session))}</small><small>${escapeHTML(session.time || "时间待定")} · ${escapeHTML(session.teacher || "教师待定")}</small></span>
              <span class="upcoming-type">${session.type === "practice" ? "见习" : "理论"}</span>
            </div>`;
        }).join("")
      : `<div class="empty-state compact"><strong>后续还没有课程</strong><p>换个科目筛选看看，或者检查周次。</p></div>`;
  }

  function filteredMistakes() {
    const query = state.mistakeSearch.trim().toLowerCase();
    return state.mistakes
      .filter((card) => state.mistakeSubject === "all" || card.subjectId === state.mistakeSubject)
      .filter((card) => {
        if (!query) return true;
        return [card.title, card.question, card.answer, card.analysis].join(" ").toLowerCase().includes(query);
      })
      .sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  }

  function mistakeCardMarkup(card) {
    const subject = SUBJECT_BY_ID.get(card.subjectId);
    const attachmentCount = (card.attachments || []).length;
    return `
      <article class="mistake-card" style="${subjectStyle(subject)}" data-mistake-card="${escapeHTML(card.id)}">
        <div class="mistake-card-top"><span class="mistake-subject-chip"><i class="filter-dot"></i>${escapeHTML(subject?.short || "科目")}</span><time>${escapeHTML(formatExamValue(card.updatedAt || card.createdAt))}</time><div class="mistake-card-actions"><button class="mini-icon-button" type="button" data-edit-mistake="${escapeHTML(card.id)}" aria-label="编辑"><svg class="icon"><use href="#i-edit"></use></svg></button><button class="mini-icon-button danger" type="button" data-delete-mistake="${escapeHTML(card.id)}" aria-label="删除"><svg class="icon"><use href="#i-trash"></use></svg></button></div></div>
        <h3>${escapeHTML(card.title || "未命名错题")}</h3>
        <div class="mistake-card-face"><span class="face-tag">A</span><p>${escapeHTML(card.question)}</p></div>
        <div class="mistake-card-footer"><span>${attachmentCount ? `${attachmentCount} 个附件` : "无附件"}</span><button type="button" class="text-button" data-review-mistake="${escapeHTML(card.id)}">复习这张 <svg class="icon"><use href="#i-arrow-right"></use></svg></button></div>
      </article>`;
  }

  function renderMistakes() {
    const total = state.mistakes.length;
    $("#mistake-total").textContent = String(total);
    const badge = $("#mistake-nav-count");
    badge.textContent = String(total);
    badge.classList.toggle("has-items", total > 0);
    $("#mistake-subject-filter").innerHTML = subjectFilterMarkup("mistake", state.mistakeSubject, true);
    const cards = filteredMistakes();
    const grid = $("#mistake-card-grid");
    grid.innerHTML = cards.length
      ? cards.map(mistakeCardMarkup).join("")
      : `<div class="empty-state mistake-empty"><strong>${total ? "当前筛选下没有错题" : "错题卷轴还是空的"}</strong><p>${total ? "换个科目，或者清除搜索关键词。" : "新建一张卡片，把 A 面的问题和 B 面的答案一起收进来。"}</p><button class="ink-button" type="button" data-add-mistake><svg class="icon"><use href="#i-plus"></use></svg>新建错题卡</button></div>`;
  }

  function saveReviewPosition() {
    const review = state.review;
    const card = review.cards[review.index];
    if (!review.subjectId || !card) return;
    state.reviewPositions[review.subjectId] = card.id;
    writeJSON(STORAGE.review, state.reviewPositions);
  }

  function startReview(subjectId, focusCardId) {
    let targetSubjectId = subjectId;
    if (!targetSubjectId && state.mistakeSubject !== "all") targetSubjectId = state.mistakeSubject;
    if (!targetSubjectId && focusCardId) targetSubjectId = state.mistakes.find((card) => card.id === focusCardId)?.subjectId;
    if (!targetSubjectId) targetSubjectId = filteredMistakes()[0]?.subjectId || state.mistakes[0]?.subjectId;
    const subject = SUBJECT_BY_ID.get(targetSubjectId);
    if (!subject) {
      toast("还没有错题卡，先新建一张。");
      return;
    }
    const cards = state.mistakes
      .filter((card) => card.subjectId === targetSubjectId)
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
    if (!cards.length) {
      toast(`${subject.name}还没有错题卡。`);
      return;
    }
    const savedId = focusCardId || state.reviewPositions[targetSubjectId];
    const savedIndex = cards.findIndex((card) => card.id === savedId);
    const index = savedIndex >= 0 ? savedIndex : 0;
    state.review = { subjectId: targetSubjectId, cards, index, flipped: false };
    renderReview();
    const dialog = $("#review-dialog");
    if (!dialog.open) dialog.showModal();
    if (!focusCardId && savedIndex >= 0) toast(`已从${subject.name}上次停下的卡片继续。`);
  }

  function reviewAttachmentMarkup(card) {
    const attachments = card.attachments || [];
    if (!attachments.length) return "";
    return attachments.map((attachment) => `<button class="attachment-pill" type="button" data-open-attachment="${escapeHTML(attachment.id)}"><svg class="icon"><use href="#i-file"></use></svg><span>${escapeHTML(attachment.name)}</span></button>`).join("");
  }

  function renderReview() {
    const review = state.review;
    if (!review.cards.length) return;
    review.index = clamp(review.index, 0, review.cards.length - 1);
    const card = review.cards[review.index];
    const subject = SUBJECT_BY_ID.get(review.subjectId);
    $("#review-subject-label").textContent = `${subject?.name || "科目"} · 共 ${review.cards.length} 张卡片`;
    $("#review-progress-label").textContent = `第 ${review.index + 1} / ${review.cards.length} 张`;
    $("#review-progress-bar").style.width = `${((review.index + 1) / review.cards.length) * 100}%`;
    const face = $("#review-flip");
    face.style.cssText = subjectStyle(subject);
    face.classList.toggle("is-flipped", review.flipped);
    $("#review-face-label").textContent = review.flipped ? "B 面 · 答案与解析" : "A 面 · 题目";
    $("#review-flip-hint").textContent = review.flipped ? "点击卡片，翻回 A 面" : "点击卡片，翻到 B 面";
    if (review.flipped) {
      $("#review-face-content").innerHTML = `
        <span class="review-card-title">${escapeHTML(card.title || "未命名错题")}</span>
        <span class="review-card-block"><b>答案</b>${escapeHTML(card.answer || "还没有填写答案")}</span>
        <span class="review-card-block analysis"><b>解析</b>${escapeHTML(card.analysis || "还没有填写解析")}</span>`;
    } else {
      $("#review-face-content").innerHTML = `
        <span class="review-card-title">${escapeHTML(card.title || "未命名错题")}</span>
        <span class="review-card-question">${escapeHTML(card.question || "还没有填写题目")}</span>`;
    }
    $("#review-attachments").innerHTML = reviewAttachmentMarkup(card);
    $("#review-prev").disabled = review.index === 0;
    const atEnd = review.index >= review.cards.length - 1;
    $("#review-next").disabled = atEnd;
    $("#review-next").textContent = atEnd ? "最后一张" : "下一张";
    saveReviewPosition();
  }

  function moveReview(step) {
    const review = state.review;
    if (!review.cards.length) return;
    const nextIndex = clamp(review.index + step, 0, review.cards.length - 1);
    if (nextIndex === review.index) return;
    review.index = nextIndex;
    review.flipped = false;
    renderReview();
  }

  function closeReview() {
    const dialog = $("#review-dialog");
    if (dialog?.open) dialog.close();
  }

  function openExamDialog() {
    renderExamEditors();
    const dialog = $("#exam-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeExamDialog() {
    const dialog = $("#exam-dialog");
    if (dialog?.open) dialog.close();
  }

  function saveExamSettings(event) {
    event.preventDefault();
    const next = {};
    $$("[data-exam-subject]").forEach((input) => {
      if (input.value) next[input.dataset.examSubject] = input.value;
    });
    state.exams = next;
    writeJSON(STORAGE.exams, state.exams);
    closeExamDialog();
    renderExamWidgets();
    renderSubjectOverview();
    if (state.view === "missions") renderSubjectFocus();
    toast("考试日程已保存。");
  }

  function clearExams() {
    state.exams = {};
    writeJSON(STORAGE.exams, state.exams);
    renderExamEditors();
    renderExamWidgets();
    renderSubjectOverview();
    if (state.view === "missions") renderSubjectFocus();
    toast("考试日程已清空。");
  }

  function populateMistakeSubjects(selectedId) {
    $("#mistake-subject").innerHTML = DATA.subjects
      .map((subject) => `<option value="${escapeHTML(subject.id)}"${subject.id === selectedId ? " selected" : ""}>${escapeHTML(subject.name)}</option>`)
      .join("");
  }

  function renderPendingFiles() {
    const container = $("#pending-file-list");
    if (!container) return;
    const existing = (state.editingAttachments || []).map((attachment) => `
      <div class="pending-file-row is-existing">
        <svg class="icon"><use href="#i-file"></use></svg>
        <span>${escapeHTML(attachment.name)}</span>
        <button type="button" class="text-button" data-open-attachment="${escapeHTML(attachment.id)}">打开</button>
        <small>已保存</small>
      </div>`);
    const pending = state.pendingFiles.map((file) => `
      <div class="pending-file-row">
        <svg class="icon"><use href="#i-file"></use></svg>
        <span>${escapeHTML(file.name)}</span>
        <small>${(file.size / 1024).toFixed(1)} KB · 待保存</small>
      </div>`);
    container.innerHTML = [...existing, ...pending].join("");
  }

  function resetMistakeForm() {
    state.editingMistakeId = null;
    state.editingAttachments = [];
    state.pendingFiles = [];
    $("#mistake-form").reset();
    $("#mistake-editor-title").textContent = "新建错题卷轴";
    populateMistakeSubjects(state.mistakeSubject === "all" ? DATA.subjects[0]?.id : state.mistakeSubject);
    renderPendingFiles();
  }

  function openMistakeDialog(cardId) {
    state.editingAttachments = [];
    state.pendingFiles = [];
    $("#mistake-form").reset();
    const card = cardId ? state.mistakes.find((item) => item.id === cardId) : null;
    state.editingMistakeId = card?.id || null;
    state.editingAttachments = card?.attachments || [];
    $("#mistake-editor-title").textContent = card ? "编辑错题卷轴" : "新建错题卷轴";
    populateMistakeSubjects(card?.subjectId || (state.mistakeSubject === "all" ? DATA.subjects[0]?.id : state.mistakeSubject));
    $("#mistake-title").value = card?.title || "";
    $("#mistake-question").value = card?.question || "";
    $("#mistake-answer").value = card?.answer || "";
    $("#mistake-analysis").value = card?.analysis || "";
    renderPendingFiles();
    const dialog = $("#mistake-dialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeMistakeDialog() {
    const dialog = $("#mistake-dialog");
    if (dialog?.open) dialog.close();
  }

  async function submitMistake(event) {
    event.preventDefault();
    const subjectId = $("#mistake-subject").value;
    const question = $("#mistake-question").value.trim();
    if (!subjectId) {
      toast("请先选择科目。");
      return;
    }
    if (!question) {
      toast("A 面题目不能为空。");
      $("#mistake-question").focus();
      return;
    }
    const existing = state.mistakes.find((card) => card.id === state.editingMistakeId);
    const now = new Date().toISOString();
    const card = existing || {
      id: `mistake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      attachments: [],
    };
    card.subjectId = subjectId;
    card.title = $("#mistake-title").value.trim() || "未命名错题";
    card.question = question;
    card.answer = $("#mistake-answer").value.trim();
    card.analysis = $("#mistake-analysis").value.trim();
    card.updatedAt = now;
    if (state.pendingFiles.length) {
      try {
        const added = await addAttachmentFiles(card.id, state.pendingFiles);
        card.attachments = [...(card.attachments || []), ...added];
      } catch (error) {
        toast("卡片已保存，但附件写入失败。");
      }
    }
    if (!existing) state.mistakes.push(card);
    writeJSON(STORAGE.mistakes, state.mistakes);
    closeMistakeDialog();
    renderMistakes();
    toast(existing ? "错题卡已更新。" : "错题卡已收进卷轴。");
  }

  async function deleteMistake(cardId) {
    const card = state.mistakes.find((item) => item.id === cardId);
    if (!card) return;
    if (!window.confirm(`删除「${card.title || "未命名错题"}」？附件也会一并删除。`)) return;
    state.mistakes = state.mistakes.filter((item) => item.id !== cardId);
    writeJSON(STORAGE.mistakes, state.mistakes);
    try {
      await deleteCardFiles(cardId);
    } catch (error) {
      // The card metadata is still removed even if the attachment store is unavailable.
    }
    if (state.review.subjectId === card.subjectId) {
      state.review.cards = state.review.cards.filter((item) => item.id !== cardId);
      state.review.index = clamp(state.review.index, 0, Math.max(0, state.review.cards.length - 1));
      if (!state.review.cards.length) closeReview();
      else renderReview();
    }
    renderMistakes();
    toast("错题卡已删除。");
  }

  function renderExamWidgets() {
    const now = Date.now();
    const exams = examItems(now);

    const newest = exams[0] || null;
    const metric = $("#metric-exam");
    const metricCopy = $("#metric-exam-copy");
    if (newest) {
      metric.textContent = countdownText(newest.ms);
      metricCopy.textContent = newest.subject.name;
      metric.dataset.countdown = String(newest.ms);
      metric.dataset.countdownSeconds = "false";
    } else {
      metric.textContent = "未设置";
      metricCopy.textContent = "点此设置考试日期";
      delete metric.dataset.countdown;
      delete metric.dataset.countdownSeconds;
    }

    const spotlight = $("#exam-spotlight");
    if (spotlight) {
      spotlight.innerHTML = newest
        ? `<div class="exam-spotlight-head"><span class="exam-spotlight-label">最近一场</span><span class="exam-spotlight-subject" style="${subjectStyle(newest.subject)}"><i class="filter-dot"></i>${escapeHTML(newest.subject.name)}</span></div>
           <strong class="exam-spotlight-countdown" data-countdown="${newest.ms}" data-countdown-seconds="true">${escapeHTML(countdownText(newest.ms, true))}</strong>
           <p>${escapeHTML(formatDateLong(newest.date))} · ${escapeHTML(formatExamValue(newest.value).split(" ").pop())}${newest.isDefault ? " · 示例日期，可在考试日程修改" : ""}</p>
           <div class="exam-spotlight-actions">
             <button class="text-button exam-announce-button" type="button" data-announce-exam><svg class="icon"><use href="#i-volume"></use></svg>播报剩余时间</button>
             <button class="text-button" type="button" data-open-exam>调整考试时间 <svg class="icon"><use href="#i-arrow-right"></use></svg></button>
           </div>`
        : `<div class="empty-state compact"><strong>还没有考试日程</strong><p>把每科考试日期填进去，倒计时才会开始。</p><button class="text-button" type="button" data-open-exam>设置考试日程 <svg class="icon"><use href="#i-arrow-right"></use></svg></button></div>`;
    }

    const mini = $("#exam-mini-list");
    if (mini) mini.innerHTML = exams.length ? examListMarkup(exams.slice(1, 4)) : "";
    $("#metric-exam").closest(".metric-card")?.setAttribute("data-clickable", "true");
  }

  function sessionSubjectMark(session) {
    return escapeHTML(SUBJECT_BY_ID.get(session.subjectId)?.mark || "学");
  }

  function todaySessions() {
    const today = localDateISO(new Date());
    return DATA.sessions
      .filter((session) => session.date === today)
      .sort((left, right) => String(left.time).localeCompare(String(right.time), "zh-CN"));
  }

  function renderToday() {
    const today = new Date();
    const sessions = todaySessions();
    const dateChip = $("#today-panel-date");
    if (dateChip) dateChip.textContent = formatDateLong(today);
    $("#metric-today").textContent = `${sessions.length} 节`;
    $("#metric-today-copy").textContent = sessions.length ? `${sessions[0].time} 开始第一节课` : "今天没有排课，适合整理笔记";
    const container = $("#today-schedule");
    if (!container) return;
    container.innerHTML = sessions.length
      ? sessions.map((session) => {
          const subject = SUBJECT_BY_ID.get(session.subjectId);
          return `
            <div class="session-row" style="${subjectStyle(subject)}">
              <span class="session-time">${escapeHTML(session.time || session.section || "待定")}</span>
              <span class="subject-mark">${sessionSubjectMark(session)}</span>
              <span class="session-copy"><strong>${escapeHTML(session.content)}</strong><small>${escapeHTML(subject?.name || session.subject)} · ${session.type === "practice" ? "见习" : "理论"} · 节次 ${escapeHTML(sessionSectionText(session))} · 分组 ${escapeHTML(sessionGroupText(session))}</small><small>${escapeHTML(session.teacher || "教师待定")}${session.department ? ` · ${escapeHTML(session.department)}` : ""}</small></span>
              <span class="session-place">${escapeHTML(session.place || session.department || "")}</span>
            </div>`;
        }).join("")
      : `<div class="empty-state compact"><strong>今日没有课程卷轴</strong><p>把时间留给笔记、错题和下一步预习。</p></div>`;
  }

  function renderSubjectOverview() {
    const container = $("#subject-overview");
    if (!container) return;
    container.innerHTML = DATA.subjects.map((subject, index) => {
      const stats = subjectStats(subject);
      const exam = state.exams[subject.id];
      const examDate = exam ? new Date(exam) : null;
      return `
        <button class="subject-overview-card" type="button" data-subject-open="${escapeHTML(subject.id)}" style="${subjectStyle(subject)}">
          <span class="subject-overview-index">0${index + 1}</span>
          <span class="subject-overview-head"><span class="subject-mark">${escapeHTML(subject.mark)}</span><span><strong>${escapeHTML(subject.name)}</strong><small>${stats.doneChapters}/${stats.totalChapters} 章 · ${formatNumber(stats.totalHours)} 课时</small></span></span>
          <span class="subject-overview-progress"><span style="width:${clamp(stats.percent, 0, 100)}%"></span></span>
          <span class="subject-overview-foot"><b>${Math.round(stats.percent)}%</b><small>${examDate && !Number.isNaN(examDate.getTime()) ? `考试 ${formatDateCN(examDate)}` : "考试未设置"}</small></span>
        </button>`;
    }).join("");
  }

  function renderNextChapters() {
    const container = $("#next-chapters");
    if (!container) return;
    const next = [];
    DATA.subjects.forEach((subject) => {
      const chapter = subject.chapters.find((item) => !chapterRecord(item.id).done);
      if (chapter) next.push({ subject, chapter });
    });
    container.innerHTML = next.length
      ? next.slice(0, 3).map(({ subject, chapter }, index) => `
          <button class="next-chapter-row" type="button" data-open-chapter="${escapeHTML(chapter.id)}" data-open-subject="${escapeHTML(subject.id)}" style="${subjectStyle(subject)}">
            <span class="next-chapter-number">0${index + 1}</span>
            <span class="subject-mark small">${escapeHTML(subject.mark)}</span>
            <span class="next-chapter-copy"><strong>${escapeHTML(chapter.title)}</strong><small>${escapeHTML(subject.name)} · ${formatNumber(chapter.hours)} 课时</small></span>
            <span class="next-chapter-arrow"><svg class="icon"><use href="#i-arrow-right"></use></svg></span>
          </button>`).join("")
      : `<div class="empty-state compact"><strong>全部章节都已完成</strong><p>接下来只剩复习、错题和考试准备。</p></div>`;
  }

  function renderDashboard() {
    renderToday();
    renderExamWidgets();
    renderSubjectOverview();
    renderNextChapters();
  }

  function renderSubjectTabs() {
    const container = $("#subject-tabs");
    if (!container) return;
    container.innerHTML = DATA.subjects.map((subject) => {
      const active = subject.id === state.activeSubjectId;
      return `
        <button class="subject-tab${active ? " is-active" : ""}" type="button" role="tab" aria-selected="${active}" data-subject-open="${escapeHTML(subject.id)}" style="${subjectStyle(subject)}">
          <span class="subject-mark small">${escapeHTML(subject.mark)}</span>
          <span>${escapeHTML(subject.short)}</span>
        </button>`;
    }).join("");
  }

  function renderSubjectFocus() {
    const container = $("#subject-focus");
    const subject = SUBJECT_BY_ID.get(state.activeSubjectId) || DATA.subjects[0];
    if (!container || !subject) return;
    const stats = subjectStats(subject);
    const exam = state.exams[subject.id];
    const examDate = exam ? new Date(exam) : null;
    const preferredIndex = subject.avatar ? COMPANIONS.findIndex((companion) => companion.file === subject.avatar) : -1;
    const companionIndex = subjectCompanionCursor.get(subject.id) ?? (preferredIndex >= 0 ? preferredIndex : 0);
    const companion = COMPANIONS[companionIndex] || COMPANIONS[0];
    const nextCompanion = COMPANIONS[(companionIndex + 1) % COMPANIONS.length];
    container.innerHTML = `
      <div class="subject-focus-card" style="${subjectStyle(subject)}">
        <div class="subject-focus-mark">${escapeHTML(subject.mark)}</div>
        <div class="subject-focus-copy">
          <p class="panel-kicker">CURRENT SCROLL · ${escapeHTML(subject.short)}</p>
          <h2>${escapeHTML(subject.name)}</h2>
          <p>${stats.totalChapters} 个章节卷轴，按课时分配推进。${examDate && !Number.isNaN(examDate.getTime()) ? `考试：${escapeHTML(formatExamValue(exam))}` : "考试时间尚未设置。"}</p>
          <div class="subject-focus-progress"><span style="width:${clamp(stats.percent, 0, 100)}%"></span></div>
          <div class="subject-focus-meta"><span>${stats.doneChapters}/${stats.totalChapters} 章完成</span><span>${formatNumber(stats.doneHours)} / ${formatNumber(stats.totalHours)} 课时</span></div>
        </div>
        <div class="subject-focus-side">
          <div class="subject-focus-score" style="--score:${clamp(stats.percent, 0, 100)}"><strong>${Math.round(stats.percent)}%</strong><span>科目进度</span></div>
          <div class="subject-focus-companion" id="subject-focus-companion" title="${escapeHTML(companion.name)}" role="group" aria-label="科目随行头像：${escapeHTML(companion.name)}">
            <div class="subject-companion-stage" data-active-layer="0">
              <img class="is-active" id="subject-companion-a" src="${companion.src}" alt="">
              <img id="subject-companion-b" src="${nextCompanion.src}" alt="">
              <button class="subject-carousel-button is-prev" type="button" data-subject-companion-prev aria-label="上一张科目头像"><svg class="icon"><use href="#i-arrow-left"></use></svg></button>
              <button class="subject-carousel-button is-next" type="button" data-subject-companion-next aria-label="下一张科目头像"><svg class="icon"><use href="#i-arrow-right"></use></svg></button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function chapterSessionsMarkup(chapter) {
    const sessions = [...(chapter.sessions || [])].sort((left, right) => {
      return String(left.date).localeCompare(String(right.date)) || String(left.time).localeCompare(String(right.time), "zh-CN");
    });
    if (!sessions.length) {
      return `<div class="chapter-session-empty">进度表里暂无这一章的堂次记录，按大纲完成即可。</div>`;
    }
    return sessions.map((session) => `
      <div class="chapter-session-row">
        <span class="chapter-session-date">${escapeHTML(formatDateCN(parseLocalDate(session.date)))}</span>
        <span class="chapter-session-time">${escapeHTML(session.time || session.section || "")}</span>
        <span class="chapter-session-copy"><strong>${escapeHTML(session.content || chapter.title)}</strong><small>节次 ${escapeHTML(sessionSectionText(session))} · 分组 ${escapeHTML(sessionGroupText(session))} · ${session.type === "practice" ? "见习" : "理论"} · ${escapeHTML(session.teacher || "教师待定")}${session.place ? ` · ${escapeHTML(session.place)}` : ""}</small></span>
        <span class="chapter-session-hours">${formatNumber(session.hours)}h</span>
      </div>`).join("");
  }

  function renderCurrentView(view = state.view) {
    if (view === "dashboard") {
      renderDashboard();
    } else if (view === "schedule") {
      renderSchedule();
    } else if (view === "missions") {
      renderMissions();
    } else if (view === "mistakes") {
      renderMistakes();
    }
    renderSidebarSubjects();
  }

  function switchView(view) {
    if (!VIEW_META[view]) return;
    setView(view);
    renderCurrentView(view);
  }

  function openSubject(subjectId, chapterId) {
    const subject = SUBJECT_BY_ID.get(subjectId);
    if (!subject) return;
    state.activeSubjectId = subject.id;
    if (chapterId && subject.chapters.some((chapter) => chapter.id === chapterId)) {
      state.chapterOpen.add(chapterId);
    }
    setView("missions");
    renderCurrentView("missions");
    if (chapterId) {
      window.setTimeout(() => {
        const card = document.querySelector(`[data-chapter-id="${chapterId}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("is-focused");
        window.setTimeout(() => card.classList.remove("is-focused"), 1800);
      }, 80);
    }
  }

  function toggleChapter(chapterId) {
    if (state.chapterOpen.has(chapterId)) state.chapterOpen.delete(chapterId);
    else state.chapterOpen.add(chapterId);
    renderChapters();
  }

  function toggleAllChapters() {
    const subject = SUBJECT_BY_ID.get(state.activeSubjectId) || DATA.subjects[0];
    if (!subject) return;
    const allOpen = subject.chapters.every((chapter) => state.chapterOpen.has(chapter.id));
    subject.chapters.forEach((chapter) => {
      if (allOpen) state.chapterOpen.delete(chapter.id);
      else state.chapterOpen.add(chapter.id);
    });
    renderChapters();
  }

  function refreshProgressSurfaces() {
    renderProgress();
    renderSidebarSubjects();
    renderSubjectOverview();
    renderNextChapters();
    renderSubjectTabs();
    renderSubjectFocus();
  }

  function setChapterDone(chapterId, done) {
    const record = chapterRecord(chapterId);
    record.done = Boolean(done);
    record.updatedAt = new Date().toISOString();
    saveChapters();
    refreshProgressSurfaces();
    renderChapters();
  }

  function setChapterTask(chapterId, task, checked) {
    if (!["examHelp", "xuetang", "notes"].includes(task)) return;
    const record = chapterRecord(chapterId);
    record.tasks[task] = Boolean(checked);
    record.updatedAt = new Date().toISOString();
    saveChapters();
    const label = document.querySelector(`[data-subtask="${task}"][data-chapter="${chapterId}"]`)?.closest(".subtask-item");
    label?.classList.toggle("is-checked", Boolean(checked));
    if (!record.done) {
      const chapter = chapterById(chapterId);
      const subline = document.querySelector(`.chapter-card[data-chapter-id="${chapterId}"] .chapter-subline`);
      if (chapter && subline) {
        const completed = ["examHelp", "xuetang", "notes"].filter((key) => record.tasks[key]).length;
        subline.textContent = `${completed}/3 项小任务已落笔${chapter.sessions?.length ? ` · ${chapter.sessions.length} 次课堂` : ""}`;
      }
    }
  }

  let chapterNoteTimer = 0;
  function setChapterNote(chapterId, note) {
    const record = chapterRecord(chapterId);
    record.note = String(note || "");
    record.updatedAt = new Date().toISOString();
    window.clearTimeout(chapterNoteTimer);
    chapterNoteTimer = window.setTimeout(saveChapters, 220);
  }

  function handleAttachmentSelection(input) {
    const allowed = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"]);
    const maxBytes = 80 * 1024 * 1024;
    const files = Array.from(input.files || []);
    const accepted = [];
    let rejectedType = 0;
    let rejectedSize = 0;
    files.forEach((file) => {
      const extension = String(file.name || "").split(".").pop().toLowerCase();
      if (!allowed.has(extension)) {
        rejectedType += 1;
      } else if (file.size > maxBytes) {
        rejectedSize += 1;
      } else {
        accepted.push(file);
      }
    });
    state.pendingFiles.push(...accepted);
    input.value = "";
    renderPendingFiles();
    if (rejectedType || rejectedSize) {
      const reasons = [];
      if (rejectedType) reasons.push(`${rejectedType} 个格式不支持`);
      if (rejectedSize) reasons.push(`${rejectedSize} 个超过 80MB`);
      toast(`已加入 ${accepted.length} 个附件；${reasons.join("，")}。`);
    } else if (accepted.length) {
      toast(`已加入 ${accepted.length} 个附件，保存卡片后会写入本机。`);
    }
  }

  function updateCountdowns() {
    $$("[data-countdown]").forEach((element) => {
      const target = Number(element.dataset.countdown);
      if (!Number.isFinite(target)) return;
      element.textContent = countdownText(target, element.dataset.countdownSeconds === "true");
    });
  }

  function handleClick(event) {
    const clicked = (selector) => event.target.closest(selector);

    if (clicked("#hero-companion-prev")) {
      stepHeroCompanion(-1);
      return;
    }
    if (clicked("#hero-companion-next")) {
      stepHeroCompanion(1);
      return;
    }
    if (clicked("#hero-quote-prev")) {
      switchHeroQuote(heroQuoteIndex - 1);
      return;
    }
    if (clicked("#hero-quote-next")) {
      switchHeroQuote(heroQuoteIndex + 1);
      return;
    }
    if (clicked("[data-subject-companion-prev]")) {
      stepSubjectCompanion(-1);
      return;
    }
    if (clicked("[data-subject-companion-next]")) {
      stepSubjectCompanion(1);
      return;
    }

    const navButton = clicked(".nav-button[data-view]");
    if (navButton) {
      switchView(navButton.dataset.view);
      return;
    }

    const goButton = clicked("[data-go-view]");
    if (goButton) {
      switchView(goButton.dataset.goView);
      return;
    }

    if (clicked("#mobile-menu")) {
      $("#sidebar")?.classList.add("is-open");
      $("#sidebar-scrim")?.classList.add("is-visible");
      document.body.classList.add("menu-open");
      return;
    }
    if (clicked("#sidebar-scrim")) {
      closeSidebar();
      return;
    }

    const openChapterButton = clicked("[data-open-chapter]");
    if (openChapterButton) {
      openSubject(openChapterButton.dataset.openSubject, openChapterButton.dataset.openChapter);
      return;
    }

    const subjectButton = clicked("[data-subject-open]");
    if (subjectButton) {
      openSubject(subjectButton.dataset.subjectOpen);
      return;
    }

    const chapterToggle = clicked("[data-chapter-toggle]");
    if (chapterToggle) {
      toggleChapter(chapterToggle.dataset.chapterToggle);
      return;
    }

    if (clicked("#expand-all-chapters")) {
      toggleAllChapters();
      return;
    }

    const scheduleFilter = clicked("[data-schedule-subject]");
    if (scheduleFilter) {
      state.scheduleSubject = scheduleFilter.dataset.scheduleSubject || "all";
      renderSchedule();
      return;
    }

    const mistakeFilter = clicked("[data-mistake-subject]");
    if (mistakeFilter) {
      state.mistakeSubject = mistakeFilter.dataset.mistakeSubject || "all";
      renderMistakes();
      return;
    }

    if (clicked("#week-prev")) {
      state.scheduleWeek = clamp(state.scheduleWeek - 1, 1, MAX_WEEK);
      renderSchedule();
      return;
    }
    if (clicked("#week-next")) {
      state.scheduleWeek = clamp(state.scheduleWeek + 1, 1, MAX_WEEK);
      renderSchedule();
      return;
    }
    if (clicked("#week-now")) {
      state.scheduleWeek = semesterWeek();
      renderSchedule();
      return;
    }

    if (clicked("[data-announce-exam]")) {
      announceExamCountdown();
      return;
    }
    if (clicked("#open-exam-settings") || clicked("#top-exam-button") || clicked("[data-open-exam]") || clicked("#metric-exam")) {
      openExamDialog();
      return;
    }
    if (clicked("#close-exam-dialog")) {
      closeExamDialog();
      return;
    }
    if (clicked("#clear-exams")) {
      clearExams();
      return;
    }

    if (clicked("#add-mistake-button") || clicked("[data-add-mistake]")) {
      openMistakeDialog();
      return;
    }
    const editMistakeButton = clicked("[data-edit-mistake]");
    if (editMistakeButton) {
      openMistakeDialog(editMistakeButton.dataset.editMistake);
      return;
    }
    const deleteMistakeButton = clicked("[data-delete-mistake]");
    if (deleteMistakeButton) {
      deleteMistake(deleteMistakeButton.dataset.deleteMistake);
      return;
    }
    if (clicked("#close-mistake-dialog") || clicked("#cancel-mistake-edit")) {
      closeMistakeDialog();
      return;
    }

    const openAttachmentButton = clicked("[data-open-attachment]");
    if (openAttachmentButton) {
      openAttachment(openAttachmentButton.dataset.openAttachment);
      return;
    }

    const reviewCardButton = clicked("[data-review-mistake]");
    if (reviewCardButton) {
      const cardId = reviewCardButton.dataset.reviewMistake;
      const card = state.mistakes.find((item) => item.id === cardId);
      startReview(card?.subjectId, cardId);
      return;
    }
    if (clicked("#review-mistakes-button")) {
      const subjectId = state.mistakeSubject !== "all" ? state.mistakeSubject : null;
      startReview(subjectId);
      return;
    }
    if (clicked("#review-flip")) {
      state.review.flipped = !state.review.flipped;
      renderReview();
      return;
    }
    if (clicked("#review-prev")) {
      moveReview(-1);
      return;
    }
    if (clicked("#review-next")) {
      moveReview(1);
      return;
    }
    if (clicked("#review-done") || clicked("#close-review-dialog")) {
      saveReviewPosition();
      closeReview();
      return;
    }
  }

  function handleChange(event) {
    const chapterCheck = event.target.closest("[data-chapter-check]");
    if (chapterCheck) {
      setChapterDone(chapterCheck.dataset.chapterCheck, chapterCheck.checked);
      return;
    }
    const subtask = event.target.closest("[data-subtask][data-chapter]");
    if (subtask) {
      setChapterTask(subtask.dataset.chapter, subtask.dataset.subtask, subtask.checked);
      return;
    }
    if (event.target.matches("#mistake-files")) {
      handleAttachmentSelection(event.target);
    }
  }

  function handleInput(event) {
    if (event.target.matches("#chapter-search")) {
      state.chapterSearch = event.target.value;
      renderChapters();
      return;
    }
    if (event.target.matches("#mistake-search")) {
      state.mistakeSearch = event.target.value;
      renderMistakes();
      return;
    }
    if (event.target.matches("[data-chapter-note]")) {
      setChapterNote(event.target.dataset.chapterNote, event.target.value);
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);
    document.addEventListener("input", handleInput);
    $("#exam-form")?.addEventListener("submit", saveExamSettings);
    $("#mistake-form")?.addEventListener("submit", submitMistake);
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (!$("#review-dialog")?.open) return;
      if (event.key === "ArrowLeft") moveReview(-1);
      else if (event.key === "ArrowRight") moveReview(1);
      else if (event.key === " " && !event.target.closest("button")) {
        event.preventDefault();
        state.review.flipped = !state.review.flipped;
        renderReview();
      }
    });
  }

  function boot() {
    if (window.moleeDesktop?.isMac) document.body.classList.add("desktop-mac");
    syncSubjectCompanionAvatars();
    preloadCompanionArtwork();
    initCompanionCarousel();
    initQuoteCarousel();
    scheduleSubjectCompanionRotation();
    bindEvents();
    renderStaticTexts();
    renderProgress();
    renderSidebarSubjects();
    populateMistakeSubjects(state.mistakeSubject === "all" ? DATA.subjects[0]?.id : state.mistakeSubject);
    renderDashboard();
    renderSchedule();
    renderMissions();
    renderMistakes();

    const hashView = location.hash.replace(/^#/, "");
    const initialView = VIEW_META[hashView] ? hashView : "dashboard";
    setView(initialView, { keepScroll: true });
    renderCurrentView(initialView);
    updateCountdowns();
    window.setInterval(updateCountdowns, 1000);
    window.setInterval(() => {
      if (state.view === "dashboard") renderExamWidgets();
    }, 60000);
  }

  window.MOLEE_APP = {
    refreshAll() {
      refreshIndexes();
      syncSubjectCompanionAvatars();
      if (state.mistakeSubject !== "all" && !SUBJECT_BY_ID.has(state.mistakeSubject)) state.mistakeSubject = "all";
      if (state.scheduleSubject !== "all" && !SUBJECT_BY_ID.has(state.scheduleSubject)) state.scheduleSubject = "all";
      renderStaticTexts();
      renderProgress();
      renderSidebarSubjects();
      populateMistakeSubjects(state.mistakeSubject === "all" ? DATA.subjects[0]?.id : state.mistakeSubject);
      renderDashboard();
      renderSchedule();
      renderMissions();
      renderMistakes();
      renderExamEditors();
    },
    refreshIndexes,
    toast,
    getState: () => state,
    switchView,
    companions: COMPANIONS,
    builtinQuotes: NINJA_QUOTES,
    rescheduleCarousels() {
      scheduleHeroCompanionRotation();
      scheduleSubjectCompanionRotation();
      scheduleQuoteRotation();
    },
    reapplyPersonalization() {
      window.MOLEE_PERSONAL?.apply();
      renderStaticTexts();
      renderDashboard();
      renderMissions();
      renderMistakes();
    },
    refreshQuotes() {
      heroQuoteIndex = 0;
      applyHeroQuote(0);
    },
  };

  boot();
})();
