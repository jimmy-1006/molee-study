(() => {
  "use strict";

  const DATA = window.MOLEE_DATA;
  if (!DATA || !Array.isArray(DATA.subjects)) return;

  const STORAGE_KEY = "molee-study-catalog-v1";
  const WEEKDAY_CHAR = ["日", "一", "二", "三", "四", "五", "六"];

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function mondayOf(date) {
    const day = date.getDay();
    return addDays(date, day === 0 ? -6 : 1 - day);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const SLOT_PLAN = [
    { subjectId: "s01", weekday: 1, start: "08:00", end: "09:40", section: "1-2", place: "教学楼 A201", type: "theory" },
    { subjectId: "s06", weekday: 1, start: "14:00", end: "15:40", section: "5-6", place: "教学楼 B103", type: "theory" },
    { subjectId: "s02", weekday: 2, start: "10:00", end: "11:40", section: "3-4", place: "教学楼 A305", type: "theory" },
    { subjectId: "s07", weekday: 3, start: "08:00", end: "09:40", section: "1-2", place: "教学楼 C202", type: "theory" },
    { subjectId: "s03", weekday: 3, start: "14:00", end: "15:40", section: "5-6", place: "外语楼 302", type: "theory" },
    { subjectId: "s04", weekday: 4, start: "08:00", end: "09:40", section: "1-2", place: "计算机楼 401", type: "theory" },
    { subjectId: "s04", weekday: 4, start: "14:00", end: "15:40", section: "5-6", place: "计算机楼 机房 2", type: "practice", weeks: [4, 8, 12, 16] },
    { subjectId: "s05", weekday: 5, start: "10:00", end: "11:40", section: "3-4", place: "计算机楼 402", type: "theory" },
    { subjectId: "s05", weekday: 5, start: "14:00", end: "15:40", section: "5-6", place: "计算机楼 机房 1", type: "practice", weeks: [6, 10, 14] },
    { subjectId: "s08", weekday: 5, start: "16:00", end: "17:40", section: "7-8", place: "东区操场", type: "practice" },
  ];

  function buildSampleSessions(subjects) {
    const sessionStart = addDays(mondayOf(new Date()), -42);
    const sessions = [];
    SLOT_PLAN.forEach((slot) => {
      const subject = subjects.find((item) => item.id === slot.subjectId) || subjects[0];
      if (!subject) return;
      const weeks = slot.weeks || Array.from({ length: 18 }, (_, index) => index + 1);
      weeks.forEach((week) => {
        const date = addDays(sessionStart, (week - 1) * 7 + (slot.weekday - 1));
        const chapter = subject.chapters[(week - 1) % Math.max(1, subject.chapters.length)];
        sessions.push({
          id: uid("sm"),
          subjectId: subject.id,
          subject: subject.name,
          type: slot.type,
          week,
          date: isoDate(date),
          weekday: WEEKDAY_CHAR[date.getDay()],
          time: `${slot.start}-${slot.end}`,
          section: slot.section,
          content: chapter ? chapter.title : subject.name,
          hours: 2,
          teacher: "",
          department: "",
          group: "",
          place: slot.place,
          chapterIds: chapter ? [chapter.id] : [],
        });
      });
    });
    return { sessionStart: isoDate(sessionStart), sessions };
  }

  function sanitize(catalog) {
    if (!catalog || !Array.isArray(catalog.subjects)) return null;
    const seenSubjectIds = new Set();
    const subjects = catalog.subjects
      .filter((subject) => subject && String(subject.name || "").trim())
      .map((subject, index) => {
        let id = String(subject.id || `s${pad(index + 1)}`);
        while (seenSubjectIds.has(id)) id = uid("s");
        seenSubjectIds.add(id);
        const chapters = (Array.isArray(subject.chapters) ? subject.chapters : []).map((chapter, chapterIndex) => ({
          id: String(chapter?.id || `${id}-c${pad(chapterIndex + 1)}`),
          title: String(chapter?.title || `第 ${chapterIndex + 1} 章`).trim(),
          hours: Math.max(0, Number(chapter?.hours) || 0),
          description: String(chapter?.description || ""),
        }));
        return {
          id,
          name: String(subject.name).trim(),
          short: String(subject.short || subject.name.slice(0, 2)).trim(),
          mark: String(subject.mark || subject.name.slice(0, 1)).trim().slice(0, 2) || "学",
          theme: String(subject.theme || "ember"),
          theoryHours: Math.max(0, Number(subject.theoryHours) || 0),
          practiceHours: Math.max(0, Number(subject.practiceHours) || 0),
          avatar: String(subject.avatar || ""),
          chapters,
        };
      });
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const sessions = (Array.isArray(catalog.sessions) ? catalog.sessions : [])
      .filter((session) => session && subjectIds.has(String(session.subjectId)) && /^\d{4}-\d{2}-\d{2}$/.test(String(session.date || "")))
      .map((session) => ({
        ...session,
        id: String(session.id || uid("sm")),
        subjectId: String(session.subjectId),
        type: session.type === "practice" ? "practice" : "theory",
        week: Math.max(1, Number(session.week) || 1),
        hours: Math.max(0, Number(session.hours) || 0),
        chapterIds: Array.isArray(session.chapterIds) ? session.chapterIds : [],
      }));
    const meta = {
      appName: "molee.study",
      subtitle: "忍道 · 学习修习录",
      semester: String(catalog.meta?.semester || "本学期"),
      semesterStart: /^\d{4}-\d{2}-\d{2}$/.test(String(catalog.meta?.semesterStart || "")) ? catalog.meta.semesterStart : isoDate(mondayOf(new Date())),
      totalWeeks: Math.min(30, Math.max(1, Number(catalog.meta?.totalWeeks) || 18)),
    };
    return { meta, subjects, sessions };
  }

  function applyCatalog(catalog) {
    const clean = sanitize(catalog);
    if (!clean) return null;
    DATA.meta = { ...DATA.meta, ...clean.meta };
    DATA.subjects = clean.subjects;
    DATA.sessions = clean.sessions;
    return clean;
  }

  function currentCatalog() {
    return {
      meta: { ...DATA.meta },
      subjects: DATA.subjects,
      sessions: DATA.sessions,
    };
  }

  function saveCatalog(catalog) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog || currentCatalog()));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function seedCatalog() {
    const sample = buildSampleSessions(DATA.subjects);
    return sanitize({
      meta: {
        semester: "本学期",
        semesterStart: sample.sessionStart,
        totalWeeks: 18,
      },
      subjects: DATA.subjects,
      sessions: sample.sessions,
    });
  }

  const stored = loadStored();
  const applied = stored ? applyCatalog(stored) : null;

  if (!applied) {
    const seeded = seedCatalog();
    applyCatalog(seeded);
    saveCatalog(currentCatalog());
  }

  window.MOLEE_STORE = {
    KEY: STORAGE_KEY,
    load: loadStored,
    save: saveCatalog,
    apply: applyCatalog,
    current: currentCatalog,
    seed: seedCatalog,
    sanitize,
    saveCatalog,
    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* ignore */
      }
    },
  };
})();