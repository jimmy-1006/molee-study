(() => {
  "use strict";

  const DATA = window.MOLEE_DATA;
  const STORE = window.MOLEE_STORE;
  const APP = window.MOLEE_APP;
  if (!DATA || !STORE || !APP) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ONBOARD_KEY = "molee-study-onboarded-v1";
  const THEMES = [
    ["ember", "朱红"], ["crimson", "绯红"], ["rose", "樱粉"], ["violet", "紫藤"],
    ["teal", "青竹"], ["sky", "天蓝"], ["sunset", "晚霞"], ["leaf", "叶绿"],
  ];

  const ui = {
    courseId: null,
    chapterId: null,
    sessionId: null,
    importResult: null,
    onboardStep: 0,
    onboardChoice: "later",
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  const pad = (value) => String(value).padStart(2, "0");
  const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const weekdayChar = (date) => "日一二三四五六"[date.getDay()];

  function parseDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
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

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function subjectById(id) {
    return DATA.subjects.find((subject) => subject.id === id) || null;
  }

  function findChapter(chapterId) {
    for (const subject of DATA.subjects) {
      const chapter = subject.chapters.find((item) => item.id === chapterId);
      if (chapter) return { subject, chapter };
    }
    return null;
  }

  function toast(message) {
    APP.toast(message);
  }

  function persist() {
    STORE.saveCatalog(STORE.current());
  }

  function commit(message) {
    persist();
    APP.refreshAll();
    if (message) toast(message);
  }

  function writeProgressKeys() {
    const state = APP.getState();
    try {
      localStorage.setItem("molee-study-chapters-v1", JSON.stringify(state.chapterState));
      localStorage.setItem("molee-study-exams-v1", JSON.stringify(state.exams));
      localStorage.setItem("molee-study-mistakes-v1", JSON.stringify(state.mistakes));
    } catch (error) {
      toast("本地存储空间不足，部分进度可能没有保存。");
    }
  }

  function weekOf(date) {
    const start = parseDate(DATA.meta.semesterStart) || mondayOf(new Date());
    const startMonday = mondayOf(start);
    return Math.max(1, Math.floor((date.getTime() - startMonday.getTime()) / 604800000) + 1);
  }

  function matchChapter(subject, content) {
    const chapter = subject.chapters.find((item) => item.title === content);
    return chapter ? [chapter.id] : [];
  }

  function fillSelect(select, items, value) {
    select.innerHTML = items.map((item) => `<option value="${escapeHTML(item.value)}">${escapeHTML(item.label)}</option>`).join("");
    if (value && items.some((item) => item.value === value)) select.value = value;
  }

  function fillCourseSelect(select, value) {
    fillSelect(select, DATA.subjects.map((subject) => ({ value: subject.id, label: subject.name })), value);
  }

  function fillThemeSelect(select, value) {
    fillSelect(select, THEMES.map(([key, label]) => ({ value: key, label })), value || "ember");
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
  }

  /* ---------------- 课程 ---------------- */

  function openCourseDialog(courseId) {
    const subject = courseId ? subjectById(courseId) : null;
    ui.courseId = subject?.id || null;
    $("#course-dialog-title").textContent = subject ? "编辑课程" : "添加课程";
    $("#course-name").value = subject?.name || "";
    $("#course-short").value = subject?.short || "";
    $("#course-mark").value = subject?.mark || "";
    $("#course-theory").value = subject?.theoryHours ?? 0;
    $("#course-practice").value = subject?.practiceHours ?? 0;
    fillThemeSelect($("#course-theme"), subject?.theme || THEMES[DATA.subjects.length % THEMES.length][0]);
    const companions = APP.companions || [];
    fillSelect($("#course-avatar"), [{ value: "", label: "跟随轮播" }, ...companions.map((companion) => ({ value: companion.file, label: companion.name }))], subject?.avatar || "");
    $("#course-delete").hidden = !subject;
    openDialog("course-dialog");
    window.setTimeout(() => $("#course-name").focus(), 80);
  }

  function submitCourse(event) {
    event.preventDefault();
    const name = $("#course-name").value.trim();
    if (!name) {
      toast("先给这门课起个名字。");
      return;
    }
    const editing = ui.courseId ? subjectById(ui.courseId) : null;
    if (!editing && DATA.subjects.some((subject) => subject.name === name)) {
      toast("已经有同名课程了，换一个名字。");
      return;
    }
    const payload = {
      name,
      short: $("#course-short").value.trim() || name.slice(0, 2),
      mark: ($("#course-mark").value.trim() || name.slice(0, 1)).slice(0, 2),
      theme: $("#course-theme").value,
      theoryHours: Math.max(0, Number($("#course-theory").value) || 0),
      practiceHours: Math.max(0, Number($("#course-practice").value) || 0),
      avatar: $("#course-avatar").value || "",
    };
    if (editing) {
      Object.assign(editing, payload);
    } else {
      DATA.subjects.push({ id: uid("s"), chapters: [], ...payload });
    }
    closeDialog("course-dialog");
    commit(editing ? "课程已更新。" : "课程已添加。");
  }

  function purgeSubject(subject) {
    const chapterIds = new Set(subject.chapters.map((chapter) => chapter.id));
    DATA.subjects = DATA.subjects.filter((item) => item.id !== subject.id);
    DATA.sessions = DATA.sessions.filter((session) => session.subjectId !== subject.id);
    const state = APP.getState();
    Object.keys(state.chapterState).forEach((chapterId) => {
      if (chapterIds.has(chapterId)) delete state.chapterState[chapterId];
    });
    delete state.exams[subject.id];
    state.mistakes = state.mistakes.filter((card) => card.subjectId !== subject.id);
    if (state.activeSubjectId === subject.id) state.activeSubjectId = DATA.subjects[0]?.id || "";
    if (state.scheduleSubject === subject.id) state.scheduleSubject = "all";
    if (state.mistakeSubject === subject.id) state.mistakeSubject = "all";
    writeProgressKeys();
  }

  function deleteCourse() {
    const subject = ui.courseId ? subjectById(ui.courseId) : null;
    if (!subject) return;
    const sessions = DATA.sessions.filter((session) => session.subjectId === subject.id).length;
    const mistakes = APP.getState().mistakes.filter((card) => card.subjectId === subject.id).length;
    const detail = [`${subject.chapters.length} 个章节`, `${sessions} 节课`];
    if (mistakes) detail.push(`${mistakes} 张错题卡`);
    if (!window.confirm(`确定删除「${subject.name}」吗？

会同时删除 ${detail.join("、")}，且无法撤销。`)) return;
    closeDialog("course-dialog");
    purgeSubject(subject);
    commit("课程已删除。");
  }

  /* ---------------- 章节 ---------------- */

  function openChapterDialog(chapterId, presetSubjectId) {
    if (!DATA.subjects.length) {
      toast("请先添加一门课程。");
      openCourseDialog();
      return;
    }
    const found = chapterId ? findChapter(chapterId) : null;
    const subjectId = found?.subject.id || presetSubjectId || APP.getState().activeSubjectId || DATA.subjects[0].id;
    ui.chapterId = found?.chapter.id || null;
    $("#chapter-dialog-title").textContent = found ? "编辑章节" : "添加章节";
    fillCourseSelect($("#chapter-subject"), subjectId);
    $("#chapter-title").value = found?.chapter.title || "";
    $("#chapter-hours").value = found?.chapter.hours ?? 2;
    $("#chapter-description").value = found?.chapter.description || "";
    $("#chapter-delete").hidden = !found;
    openDialog("chapter-dialog");
    window.setTimeout(() => $("#chapter-title").focus(), 80);
  }

  function submitChapter(event) {
    event.preventDefault();
    const subject = subjectById($("#chapter-subject").value);
    if (!subject) return;
    const title = $("#chapter-title").value.trim();
    if (!title) {
      toast("章节名称不能为空。");
      return;
    }
    const payload = {
      title,
      hours: Math.max(0, Number($("#chapter-hours").value) || 0),
      description: $("#chapter-description").value.trim(),
    };
    const found = ui.chapterId ? findChapter(ui.chapterId) : null;
    if (found) {
      Object.assign(found.chapter, payload);
      if (found.subject.id !== subject.id) {
        found.subject.chapters = found.subject.chapters.filter((chapter) => chapter.id !== found.chapter.id);
        subject.chapters.push(found.chapter);
      }
    } else {
      subject.chapters.push({ id: uid(`${subject.id}-c`), ...payload });
    }
    closeDialog("chapter-dialog");
    commit(found ? "章节已更新。" : "章节已添加。");
  }

  function deleteChapter() {
    const found = ui.chapterId ? findChapter(ui.chapterId) : null;
    if (!found) return;
    if (!window.confirm(`确定删除章节「${found.chapter.title}」吗？这一章的完成记录也会一起删除。`)) return;
    found.subject.chapters = found.subject.chapters.filter((chapter) => chapter.id !== found.chapter.id);
    const state = APP.getState();
    delete state.chapterState[found.chapter.id];
    DATA.sessions = DATA.sessions.map((session) => ({
      ...session,
      chapterIds: (session.chapterIds || []).filter((id) => id !== found.chapter.id),
    }));
    writeProgressKeys();
    closeDialog("chapter-dialog");
    commit("章节已删除。");
  }

  /* ---------------- 课表 ---------------- */

  function openSessionDialog(sessionId, presetDate) {
    if (!DATA.subjects.length) {
      toast("请先添加一门课程。");
      openCourseDialog();
      return;
    }
    const session = sessionId ? DATA.sessions.find((item) => item.id === sessionId) : null;
    ui.sessionId = session?.id || null;
    $("#session-dialog-title").textContent = session ? "编辑课程安排" : "添加课程安排";
    fillCourseSelect($("#session-subject"), session?.subjectId || APP.getState().activeSubjectId || DATA.subjects[0].id);
    $("#session-type").value = session?.type === "practice" ? "practice" : "theory";
    $("#session-date").value = session?.date || presetDate || isoDate(new Date());
    const [start = "08:00", end = "09:40"] = String(session?.time || "").split("-");
    $("#session-start").value = start || "08:00";
    $("#session-end").value = end || "";
    $("#session-section").value = session?.section || "";
    $("#session-hours").value = session?.hours ?? 2;
    $("#session-content").value = session?.content || "";
    $("#session-place").value = session?.place || "";
    $("#session-teacher").value = session?.teacher || "";
    $("#session-repeat").innerHTML = Array.from({ length: 16 }, (_, index) => {
      const weeks = index + 1;
      return `<option value="${weeks}">${weeks === 1 ? "只排这一次" : `连续 ${weeks} 周`}</option>`;
    }).join("");
    $("#session-repeat").disabled = Boolean(session);
    $("#session-delete").hidden = !session;
    openDialog("session-dialog");
    window.setTimeout(() => $("#session-content").focus(), 80);
  }

  function submitSession(event) {
    event.preventDefault();
    const subject = subjectById($("#session-subject").value);
    const date = parseDate($("#session-date").value);
    const content = $("#session-content").value.trim();
    if (!subject || !date || !content) {
      toast("课程、日期和上课内容都要填。");
      return;
    }
    const start = $("#session-start").value || "08:00";
    const end = $("#session-end").value || "";
    const payload = {
      subjectId: subject.id,
      subject: subject.name,
      type: $("#session-type").value === "practice" ? "practice" : "theory",
      time: end ? `${start}-${end}` : start,
      section: $("#session-section").value.trim(),
      content,
      hours: Math.max(0, Number($("#session-hours").value) || 0),
      teacher: $("#session-teacher").value.trim(),
      department: "",
      group: "",
      place: $("#session-place").value.trim(),
      chapterIds: matchChapter(subject, content),
    };
    const editing = ui.sessionId ? DATA.sessions.find((item) => item.id === ui.sessionId) : null;
    if (editing) {
      Object.assign(editing, payload, { date: isoDate(date), weekday: weekdayChar(date), week: weekOf(date) });
    } else {
      const repeat = clamp(Number($("#session-repeat").value) || 1, 1, 16);
      for (let index = 0; index < repeat; index += 1) {
        const day = addDays(date, index * 7);
        DATA.sessions.push({
          ...payload,
          id: uid("sm"),
          date: isoDate(day),
          weekday: weekdayChar(day),
          week: weekOf(day),
        });
      }
    }
    closeDialog("session-dialog");
    commit(editing ? "课程安排已更新。" : "课程安排已添加。");
  }

  function deleteSession() {
    const session = ui.sessionId ? DATA.sessions.find((item) => item.id === ui.sessionId) : null;
    if (!session) return;
    if (!window.confirm(`确定删除这节课「${session.content}」吗？`)) return;
    DATA.sessions = DATA.sessions.filter((item) => item.id !== session.id);
    closeDialog("session-dialog");
    commit("这节课已删除。");
  }

  /* ---------------- 课程管理 ---------------- */

  function renderCourseManager() {
    const list = $("#course-manager-list");
    if (!DATA.subjects.length) {
      list.innerHTML = `<div class="empty-state compact"><strong>还没有课程</strong><p>先添加一门课，再回来管理章节和课表。</p></div>`;
      return;
    }
    const state = APP.getState();
    list.innerHTML = DATA.subjects.map((subject) => {
      const sessions = DATA.sessions.filter((session) => session.subjectId === subject.id).length;
      const mistakes = state.mistakes.filter((card) => card.subjectId === subject.id).length;
      return `
        <div class="course-manager-row">
          <span class="subject-mark">${escapeHTML(subject.mark)}</span>
          <span class="course-manager-copy">
            <strong>${escapeHTML(subject.name)}</strong>
            <small>${subject.chapters.length} 章 · ${sessions} 节课 · ${mistakes} 张错题</small>
          </span>
          <span class="course-manager-actions">
            <button class="ghost-button compact" type="button" data-manage-chapters="${escapeHTML(subject.id)}">加章节</button>
            <button class="ghost-button compact" type="button" data-edit-course="${escapeHTML(subject.id)}">编辑</button>
          </span>
        </div>`;
    }).join("");
  }

  /* ---------------- 学期设置 ---------------- */

  function openSettings() {
    $("#settings-semester").value = DATA.meta.semester || "本学期";
    $("#settings-start").value = DATA.meta.semesterStart || isoDate(mondayOf(new Date()));
    $("#settings-weeks").value = DATA.meta.totalWeeks || 18;
    openDialog("settings-dialog");
  }

  function applySemester(semester, start, weeks, silent) {
    DATA.meta.semester = semester || "本学期";
    DATA.meta.semesterStart = start;
    DATA.meta.totalWeeks = clamp(Number(weeks) || 18, 1, 30);
    const startDate = parseDate(start) || mondayOf(new Date());
    DATA.sessions = DATA.sessions.map((session) => {
      const date = parseDate(session.date);
      if (!date) return session;
      return { ...session, week: Math.max(1, Math.floor((mondayOf(date).getTime() - mondayOf(startDate).getTime()) / 604800000) + 1) };
    });
    persist();
    APP.refreshAll();
    if (!silent) toast("学期设置已保存。");
  }

  function saveSemesterFromSettings() {
    const start = $("#settings-start").value;
    if (!parseDate(start)) {
      toast("请选择第一周的周一。");
      return;
    }
    applySemester($("#settings-semester").value.trim(), start, $("#settings-weeks").value, false);
  }

  /* ---------------- 备份 ---------------- */

  function exportBackup() {
    const state = APP.getState();
    const payload = {
      app: "molee.study",
      version: 2,
      exportedAt: new Date().toISOString(),
      catalog: STORE.current(),
      progress: state.chapterState,
      exams: state.exams,
      mistakes: state.mistakes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `molee-study-backup-${isoDate(new Date())}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast("备份已导出。错题附件文件不包含在 JSON 里。");
  }

  function restoreBackupText(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      toast("这个文件不是有效的 JSON。");
      return false;
    }
    const catalog = parsed.catalog || parsed;
    const applied = STORE.apply(catalog);
    if (!applied) {
      toast("文件里没有找到课程数据。");
      return false;
    }
    const state = APP.getState();
    if (parsed.progress && typeof parsed.progress === "object") state.chapterState = parsed.progress;
    if (parsed.exams && typeof parsed.exams === "object") state.exams = parsed.exams;
    if (Array.isArray(parsed.mistakes)) state.mistakes = parsed.mistakes;
    writeProgressKeys();
    commit("备份已导入。");
    return true;
  }

  /* ---------------- AI 导入 ---------------- */

  const AI_PROMPT = `你是一名课程资料整理助手。我会给你教学大纲、课程表、截图或表格内容。请把它整理成下面的 JSON，只输出 JSON，不要解释。

{
  "meta": {
    "semester": "2026 秋季学期",
    "semesterStart": "2026-09-07",
    "totalWeeks": 18
  },
  "subjects": [
    {
      "name": "高等数学",
      "short": "高数",
      "mark": "数",
      "theme": "ember",
      "theoryHours": 64,
      "practiceHours": 16,
      "chapters": [
        { "title": "第一章 函数与极限", "hours": 6, "description": "" }
      ]
    }
  ],
  "sessions": [
    {
      "subject": "高等数学",
      "type": "theory",
      "date": "2026-09-07",
      "start": "08:00",
      "end": "09:40",
      "section": "1-2",
      "content": "函数与极限",
      "hours": 2,
      "place": "教学楼 A201",
      "teacher": ""
    }
  ]
}

规则：
1. 只输出 JSON，不要 Markdown 代码块，不要解释。
2. 日期格式 YYYY-MM-DD，时间格式 HH:MM（24 小时制）。
3. theme 只能是 ember / crimson / rose / violet / teal / sky / sunset / leaf 之一。
4. mark 是一个汉字；short 是 2 到 4 个字的简称。
5. sessions 里的 subject 必须和某个 subjects 的 name 完全一致。
6. 没有的信息留空字符串或 0，不要编造教师姓名和教室。
7. 如果只有周次没有日期，按 meta.semesterStart 所在周的周一推算第 1 周。
8. 同一门课、同一天、同一时间只保留一条。
9. 我没有提到的课程不要出现在结果里。`;

  function openImportDialog(panel = 1) {
    $("#ai-prompt").value = AI_PROMPT;
    setImportPanel(panel);
    ui.importResult = null;
    $("#confirm-import").disabled = true;
    openDialog("import-dialog");
  }

  function setImportPanel(panel) {
    $$("[data-import-panel]").forEach((section) => {
      section.hidden = section.dataset.importPanel !== String(panel);
    });
    $$("[data-import-step]").forEach((step) => {
      const value = Number(step.dataset.importStep);
      step.classList.toggle("is-active", value === panel);
      step.classList.toggle("is-done", value < panel);
    });
  }

  function normTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return "";
    return `${pad(clamp(Number(match[1]), 0, 23))}:${match[2]}`;
  }

  function stripJSON(text) {
    let value = String(text || "").trim();
    value = value.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start >= 0 && end > start) value = value.slice(start, end + 1);
    return value;
  }

  function normalizeImport(raw) {
    const problems = [];
    const metaIn = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
    const startRaw = String(metaIn.semesterStart || DATA.meta.semesterStart || "").slice(0, 10);
    const semesterStart = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : isoDate(mondayOf(new Date()));
    const totalWeeks = clamp(Number(metaIn.totalWeeks) || DATA.meta.totalWeeks || 18, 1, 30);
    const subjects = [];
    const byName = new Map();

    (Array.isArray(raw.subjects) ? raw.subjects : []).forEach((item, index) => {
      if (!item || typeof item !== "object") {
        problems.push({ where: `课程 #${index + 1}`, message: "不是一个有效的课程对象，已跳过" });
        return;
      }
      const name = String(item.name || item.course || "").trim();
      if (!name) {
        problems.push({ where: `课程 #${index + 1}`, message: "缺少课程名称，已跳过" });
        return;
      }
      if (byName.has(name)) {
        problems.push({ where: name, message: "课程名重复，章节已合并到前一条" });
        const target = byName.get(name);
        (Array.isArray(item.chapters) ? item.chapters : []).forEach((chapter) => {
          const title = String(chapter?.title || chapter?.name || "").trim();
          if (!title) return;
          if (!target.chapters.some((existing) => existing.title === title)) {
            target.chapters.push({ id: uid(`${target.id}-c`), title, hours: Math.max(0, Number(chapter.hours) || 2), description: String(chapter.description || "") });
          }
        });
        return;
      }
      const theme = THEMES.some(([key]) => key === item.theme) ? item.theme : THEMES[subjects.length % THEMES.length][0];
      const subject = {
        id: uid("s"),
        name,
        short: String(item.short || name.slice(0, 2)).trim(),
        mark: String(item.mark || name.slice(0, 1)).trim().slice(0, 2),
        theme,
        theoryHours: Math.max(0, Number(item.theoryHours) || 0),
        practiceHours: Math.max(0, Number(item.practiceHours) || 0),
        chapters: [],
      };
      (Array.isArray(item.chapters) ? item.chapters : []).forEach((chapter, chapterIndex) => {
        const title = String(chapter?.title || chapter?.name || "").trim();
        if (!title) {
          problems.push({ where: `${name} 第 ${chapterIndex + 1} 章`, message: "缺少章节名称，已跳过" });
          return;
        }
        subject.chapters.push({
          id: uid(`${subject.id}-c`),
          title,
          hours: Math.max(0, Number(chapter.hours) || 2),
          description: String(chapter.description || ""),
        });
      });
      byName.set(name, subject);
      subjects.push(subject);
    });

    if (!subjects.length) {
      problems.push({ where: "整体", message: "没有识别到任何课程，请检查 JSON 里的 subjects 数组" });
      return null;
    }

    const sessions = [];
    (Array.isArray(raw.sessions) ? raw.sessions : []).forEach((item, index) => {
      const where = `第 ${index + 1} 节课`;
      if (!item || typeof item !== "object") {
        problems.push({ where, message: "不是一个有效的课程安排，已跳过" });
        return;
      }
      const subjectName = String(item.subject || item.course || "").trim();
      const subject = byName.get(subjectName);
      if (!subject) {
        problems.push({ where, message: `找不到课程「${subjectName || "(空)"}」，已跳过` });
        return;
      }
      const date = parseDate(item.date);
      if (!date) {
        problems.push({ where, message: "日期不是 YYYY-MM-DD 格式，已跳过" });
        return;
      }
      const start = normTime(item.start) || "08:00";
      const end = normTime(item.end);
      const content = String(item.content || item.title || subject.name).trim();
      sessions.push({
        id: uid("sm"),
        subjectId: subject.id,
        subject: subject.name,
        type: item.type === "practice" ? "practice" : "theory",
        date: isoDate(date),
        weekday: weekdayChar(date),
        week: 1,
        time: end ? `${start}-${end}` : start,
        section: String(item.section || "").trim(),
        content,
        hours: Math.max(0, Number(item.hours) || 2),
        teacher: String(item.teacher || "").trim(),
        department: "",
        group: "",
        place: String(item.place || "").trim(),
        chapterIds: matchChapter(subject, content),
      });
    });

    const startDate = parseDate(semesterStart) || mondayOf(new Date());
    sessions.forEach((session) => {
      const date = parseDate(session.date);
      session.week = Math.max(1, Math.floor((mondayOf(date).getTime() - mondayOf(startDate).getTime()) / 604800000) + 1);
    });

    return {
      meta: { semester: String(metaIn.semester || DATA.meta.semester || "本学期"), semesterStart, totalWeeks },
      subjects,
      sessions,
      problems,
    };
  }

  function validateImport() {
    let raw;
    try {
      raw = JSON.parse(stripJSON($("#ai-result").value));
    } catch (error) {
      ui.importResult = null;
      $("#confirm-import").disabled = true;
      $("#import-summary").innerHTML = `<span class="warn"><b>!</b>无法解析 JSON</span>`;
      $("#import-problems").innerHTML = `<p class="import-problem">${escapeHTML(error.message)}</p><p class="import-problem">常见原因：AI 在 JSON 前后加了说明文字，或者少了一个括号。可以让 AI「只输出 JSON」再试一次。</p>`;
      $("#import-preview").innerHTML = "";
      setImportPanel(3);
      return;
    }
    const result = normalizeImport(raw);
    ui.importResult = result;
    if (!result) {
      $("#confirm-import").disabled = true;
      $("#import-summary").innerHTML = `<span class="warn"><b>!</b>没有可导入的数据</span>`;
      $("#import-problems").innerHTML = result ? "" : `<p class="import-problem">请确认 JSON 里有非空的 subjects 数组。</p>`;
      $("#import-preview").innerHTML = "";
      setImportPanel(3);
      return;
    }
    renderImportPreview(result);
    setImportPanel(3);
  }

  function renderImportPreview(result) {
    const chapterCount = result.subjects.reduce((sum, subject) => sum + subject.chapters.length, 0);
    $("#import-summary").innerHTML = `
      <span><b>${result.subjects.length}</b>门课程</span>
      <span><b>${chapterCount}</b>个章节</span>
      <span><b>${result.sessions.length}</b>节课</span>
      ${result.problems.length ? `<span class="warn"><b>${result.problems.length}</b>条提示</span>` : `<span class="ok">格式检查通过</span>`}`;

    const problems = result.problems.slice(0, 10);
    $("#import-problems").innerHTML = result.problems.length
      ? `<h4>需要留意的行</h4>${problems.map((problem) => `<p class="import-problem"><b>${escapeHTML(problem.where)}</b>${escapeHTML(problem.message)}</p>`).join("")}${result.problems.length > problems.length ? `<p class="import-problem">还有 ${result.problems.length - problems.length} 条，导入时会跳过这些行。</p>` : ""}`
      : `<p class="import-ok">没有发现格式问题，可以放心导入。</p>`;

    const subjectRows = result.subjects.map((subject) => `<tr><td>${escapeHTML(subject.name)}</td><td>${subject.chapters.length}</td><td>${result.sessions.filter((session) => session.subjectId === subject.id).length}</td></tr>`).join("");
    const sessionRows = result.sessions.slice(0, 30).map((session) => `<tr><td>${escapeHTML(session.date)}</td><td>${escapeHTML(session.time)}</td><td>${escapeHTML(session.subject)}</td><td>${escapeHTML(session.content)}</td></tr>`).join("");
    $("#import-preview").innerHTML = `
      <details open><summary>课程与章节</summary>
        <table class="import-table"><thead><tr><th>课程</th><th>章节</th><th>课表</th></tr></thead><tbody>${subjectRows}</tbody></table>
      </details>
      <details><summary>课程表预览（前 30 节）</summary>
        <table class="import-table"><thead><tr><th>日期</th><th>时间</th><th>课程</th><th>内容</th></tr></thead><tbody>${sessionRows || `<tr><td colspan="4">没有课程表数据</td></tr>`}</tbody></table>
      </details>`;

    $("#confirm-import").disabled = false;
    $("#import-mode").value = "merge";
  }

  function mergeCatalog(result) {
    const current = STORE.current();
    const idMap = new Map();
    result.subjects.forEach((subject) => {
      const existing = current.subjects.find((item) => item.name === subject.name);
      if (existing) {
        idMap.set(subject.id, existing.id);
        subject.chapters.forEach((chapter) => {
          if (!existing.chapters.some((item) => item.title === chapter.title)) existing.chapters.push(chapter);
        });
        existing.theoryHours = existing.theoryHours || subject.theoryHours;
        existing.practiceHours = existing.practiceHours || subject.practiceHours;
      } else {
        current.subjects.push(subject);
        idMap.set(subject.id, subject.id);
      }
    });
    const keyOf = (session) => `${session.subjectId}|${session.date}|${session.time}|${session.content}`;
    const seen = new Set(current.sessions.map(keyOf));
    result.sessions.forEach((session) => {
      const subjectId = idMap.get(session.subjectId) || session.subjectId;
      const candidate = { ...session, subjectId, subject: current.subjects.find((item) => item.id === subjectId)?.name || session.subject };
      if (seen.has(keyOf(candidate))) return;
      seen.add(keyOf(candidate));
      current.sessions.push(candidate);
    });
    return current;
  }

  function confirmImport() {
    if (!ui.importResult) return;
    const mode = $("#import-mode").value;
    const catalog = mode === "replace" ? ui.importResult : mergeCatalog(ui.importResult);
    const applied = STORE.apply(catalog);
    if (!applied) {
      toast("导入失败，请检查数据格式。");
      return;
    }
    const state = APP.getState();
    if (!state.subjects?.length) {
      state.activeSubjectId = DATA.subjects[0]?.id || "";
    } else if (!subjectById(state.activeSubjectId)) {
      state.activeSubjectId = DATA.subjects[0]?.id || "";
    }
    closeDialog("import-dialog");
    commit(`已导入 ${applied.subjects.length} 门课程、${applied.sessions.length} 节课。`);
  }
  /* ---------------- 新手引导 ---------------- */

  function openOnboarding() {
    ui.onboardStep = 0;
    ui.onboardChoice = "later";
    $("#onboard-semester").value = DATA.meta.semester || "本学期";
    $("#onboard-start").value = DATA.meta.semesterStart || isoDate(mondayOf(new Date()));
    $("#onboard-weeks").value = DATA.meta.totalWeeks || 18;
    $("#onboard-courses").value = DATA.subjects.map((subject) => subject.name).join("\n");
    $("#onboarding").hidden = false;
    document.body.classList.add("onboarding-open");
    renderOnboardStep();
  }

  function closeOnboarding(markDone) {
    $("#onboarding").hidden = true;
    document.body.classList.remove("onboarding-open");
    if (markDone) {
      try {
        localStorage.setItem(ONBOARD_KEY, "1");
      } catch (error) {
        /* ignore */
      }
    }
  }

  function renderOnboardStep() {
    $$("[data-onboard-step]").forEach((section) => {
      section.classList.toggle("is-active", Number(section.dataset.onboardStep) === ui.onboardStep);
    });
    $("#onboarding-progress").style.setProperty("--onboard-progress", `${(ui.onboardStep / 4) * 100}%`);
    $("#onboard-dots").innerHTML = Array.from({ length: 5 }, (_, index) => {
      const classes = ["onboard-dot"];
      if (index === ui.onboardStep) classes.push("is-active");
      if (index < ui.onboardStep) classes.push("is-done");
      return `<i class="${classes.join(" ")}"></i>`;
    }).join("");
    $("#onboard-back").textContent = ui.onboardStep === 0 ? "先逛逛" : "上一步";
    $("#onboard-next").innerHTML = ui.onboardStep === 4
      ? '进入修习总览 <svg class="icon"><use href="#i-check"></use></svg>'
      : ui.onboardStep === 0
        ? '开始设置 <svg class="icon"><use href="#i-arrow-right"></use></svg>'
        : '下一步 <svg class="icon"><use href="#i-arrow-right"></use></svg>';
    if (ui.onboardStep === 4) {
      const chapters = DATA.subjects.reduce((sum, subject) => sum + subject.chapters.length, 0);
      $("#onboard-summary-semester").textContent = DATA.meta.semester || "本学期";
      $("#onboard-summary-courses").textContent = `${DATA.subjects.length} 门课程 · ${chapters} 个章节`;
    }
  }

  function applyOnboardCourses() {
    const names = $("#onboard-courses").value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!names.length) {
      toast("至少留一门课。");
      return false;
    }
    const current = DATA.subjects.map((subject) => subject.name);
    const unchanged = names.length === current.length && names.every((name, index) => name === current[index]);
    if (unchanged) return true;

    const next = names.map((name, index) => {
      const existing = DATA.subjects.find((subject) => subject.name === name);
      if (existing) return existing;
      return {
        id: uid("s"),
        name,
        short: name.slice(0, 2),
        mark: name.slice(0, 1),
        theme: THEMES[index % THEMES.length][0],
        theoryHours: 0,
        practiceHours: 0,
        chapters: [],
      };
    });

    const keepIds = new Set(next.map((subject) => subject.id));
    const removed = DATA.subjects.filter((subject) => !keepIds.has(subject.id));
    const state = APP.getState();
    removed.forEach((subject) => {
      subject.chapters.forEach((chapter) => delete state.chapterState[chapter.id]);
      delete state.exams[subject.id];
      state.mistakes = state.mistakes.filter((card) => card.subjectId !== subject.id);
    });
    DATA.subjects = next;
    DATA.sessions = DATA.sessions.filter((session) => keepIds.has(session.subjectId));
    state.activeSubjectId = DATA.subjects[0]?.id || "";
    state.scheduleSubject = "all";
    state.mistakeSubject = "all";
    writeProgressKeys();
    commit();
    return true;
  }

  function onboardNext() {
    if (ui.onboardStep === 1) {
      const start = $("#onboard-start").value;
      if (!parseDate(start)) {
        toast("先选一个开学日期。");
        return;
      }
      applySemester($("#onboard-semester").value.trim(), start, $("#onboard-weeks").value, true);
    }
    if (ui.onboardStep === 2 && !applyOnboardCourses()) return;
    if (ui.onboardStep === 4) {
      closeOnboarding(true);
      APP.refreshAll();
      if (ui.onboardChoice === "ai") openImportDialog(1);
      else if (ui.onboardChoice === "manual") openSessionDialog(null, isoDate(new Date()));
      return;
    }
    ui.onboardStep = Math.min(4, ui.onboardStep + 1);
    renderOnboardStep();
  }

  function onboardBack() {
    if (ui.onboardStep === 0) {
      closeOnboarding(true);
      return;
    }
    ui.onboardStep = Math.max(0, ui.onboardStep - 1);
    renderOnboardStep();
  }

  /* ---------------- 帮助抽屉 ---------------- */

  function renderHelp() {
    $("#help-drawer-body").innerHTML = `
      <section class="help-section">
        <h3><span>01</span>三分钟上手</h3>
        <ol class="help-steps">
          <li><b>设学期</b>左下角「学习设置」里填开学日期和总周数。</li>
          <li><b>建课程</b>左边「修习科目」旁的 <em>+</em>，一门课一行。</li>
          <li><b>排课表</b>课程表右上角「添加课表」，支持连续多周。</li>
          <li><b>设考试</b>右上角「考试日程」，倒计时自动开始。</li>
        </ol>
      </section>
      <section class="help-section">
        <h3><span>02</span>课程和章节</h3>
        <ul class="help-list">
          <li>课程决定侧边栏、筛选器和统计口径。</li>
          <li>章节是进度单位，按课时加权；三项小任务只作过程核对。</li>
          <li>删除课程会连带删除它的章节、课表和错题，操作前会二次确认。</li>
        </ul>
      </section>
      <section class="help-section">
        <h3><span>03</span>课表的三种进法</h3>
        <ul class="help-list">
          <li><b>手动</b>：知道时间地点，几分钟排完。</li>
          <li><b>AI</b>：把教务系统导出的表格或截图交给 AI 整理。</li>
          <li><b>备份</b>：同学给你 JSON 备份，直接导入。</li>
          <li>重复周次：选「连续 N 周」，从所选日期起每周同一天自动生成。</li>
        </ul>
      </section>
      <section class="help-section">
        <h3><span>04</span>让 AI 帮你整理</h3>
        <ol class="help-steps">
          <li>点「学习设置 → AI / 数据导入」。</li>
          <li>复制提示词，连同教学大纲或课表一起发给任意 AI。</li>
          <li>把 AI 返回的整段内容粘回程序，点「校验并预览」。</li>
          <li>红色提示行会被跳过，确认无误后点「确认导入」。</li>
        </ol>
        <p class="help-note">不需要配置 Key，也不会上传任何内容；用的是你自己的 AI 账号。</p>
      </section>
      <section class="help-section">
        <h3><span>05</span>考试与播报</h3>
        <ul class="help-list">
          <li>主页「考试倒计时」右上角的笔，可以逐科设置日期时间。</li>
          <li>喇叭按钮会用系统语音播报最近一场考试还剩几天几小时。</li>
        </ul>
      </section>
      <section class="help-section">
        <h3><span>06</span>备份与换电脑</h3>
        <ul class="help-list">
          <li>数据只存在本机，清理浏览器数据会丢失。</li>
          <li>换设备前用「导出备份」，在新电脑上「导入备份」。</li>
          <li>备份包含课程、章节、课表、进度、考试和错题文字；附件文件不包含。</li>
        </ul>
      </section>
      <section class="help-section">
        <button class="ink-button" type="button" id="help-replay-onboarding">重看新手引导</button>
      </section>`;
  }

  function openHelp() {
    $("#help-drawer").classList.add("is-open");
    $("#help-drawer").setAttribute("aria-hidden", "false");
    $("#help-scrim").hidden = false;
  }

  function closeHelp() {
    $("#help-drawer").classList.remove("is-open");
    $("#help-drawer").setAttribute("aria-hidden", "true");
    $("#help-scrim").hidden = true;
  }

  /* ---------------- 数据工具 ---------------- */

  function resetToSample() {
    if (!window.confirm("恢复示例数据会覆盖当前的课程、章节和课表。错题与进度会保留。继续吗？")) return;
    STORE.reset();
    location.reload();
  }

  function clearAll() {
    if (!window.confirm("确定清空全部数据吗？课程、章节、课表、进度、考试和错题都会被删除，且无法撤销。")) return;
    ["molee-study-chapters-v1", "molee-study-exams-v1", "molee-study-mistakes-v1", "molee-study-review-v1"].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        /* ignore */
      }
    });
    STORE.apply({ meta: { ...DATA.meta, semester: "本学期" }, subjects: [], sessions: [] });
    STORE.saveCatalog(STORE.current());
    closeDialog("settings-dialog");
    APP.refreshAll();
    toast("已清空，可以从「添加课程」重新开始。");
  }

  async function copyPrompt() {
    const text = $("#ai-prompt").value;
    try {
      await navigator.clipboard.writeText(text);
      toast("提示词已复制，去粘给 AI 吧。");
    } catch (error) {
      const field = $("#ai-prompt");
      field.focus();
      field.select();
      document.execCommand("copy");
      toast("提示词已复制。");
    }
  }

  function downloadPrompt() {
    const blob = new Blob([$("#ai-prompt").value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "molee-study-ai-prompt.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* ---------------- 事件 ---------------- */

  function handleClick(event) {
    const hit = (selector) => event.target.closest(selector);

    if (hit("#open-help")) { openHelp(); return; }
    if (hit("#close-help") || hit("#help-scrim")) { closeHelp(); return; }
    if (hit("#help-replay-onboarding")) { closeHelp(); openOnboarding(); return; }

    if (hit("#add-course-button") || hit("#manager-add-course")) { openCourseDialog(); return; }
    if (hit("#manage-courses-button") || hit("#settings-manage-courses")) {
      closeDialog("settings-dialog");
      renderCourseManager();
      openDialog("courses-dialog");
      return;
    }
    const editCourseButton = hit("[data-edit-course]");
    if (editCourseButton) { openCourseDialog(editCourseButton.dataset.editCourse); return; }
    const manageChapters = hit("[data-manage-chapters]");
    if (manageChapters) {
      closeDialog("courses-dialog");
      openChapterDialog(null, manageChapters.dataset.manageChapters);
      return;
    }
    if (hit("#empty-add-course")) { openCourseDialog(); return; }
    if (hit("#course-delete")) { deleteCourse(); return; }

    if (hit("#add-chapter-button")) { openChapterDialog(null, APP.getState().activeSubjectId); return; }
    const addChapter = hit("[data-add-chapter]");
    if (addChapter) { openChapterDialog(null, addChapter.dataset.addChapter); return; }
    const editChapter = hit("[data-edit-chapter]");
    if (editChapter) { openChapterDialog(editChapter.dataset.editChapter); return; }
    if (hit("#chapter-delete")) { deleteChapter(); return; }

    if (hit("#add-session-button")) { openSessionDialog(null, isoDate(new Date())); return; }
    const editSession = hit("[data-edit-session]");
    if (editSession) { openSessionDialog(editSession.dataset.editSession); return; }
    if (hit("#session-delete")) { deleteSession(); return; }

    if (hit("#open-settings")) { openSettings(); return; }
    if (hit("#save-semester")) { saveSemesterFromSettings(); return; }
    if (hit("#settings-export")) { exportBackup(); return; }
    if (hit("#settings-import")) { closeDialog("settings-dialog"); openImportDialog(1); return; }
    if (hit("#settings-replay-guide")) { closeDialog("settings-dialog"); openOnboarding(); return; }
    if (hit("#settings-reset")) { resetToSample(); return; }
    if (hit("#settings-clear")) { clearAll(); return; }

    const closeButton = hit("[data-close-dialog]");
    if (closeButton) { closeDialog(closeButton.dataset.closeDialog); return; }

    if (hit("#copy-ai-prompt")) { copyPrompt(); return; }
    if (hit("#download-ai-prompt")) { downloadPrompt(); return; }
    const gotoPanel = hit("[data-import-goto]");
    if (gotoPanel) { setImportPanel(Number(gotoPanel.dataset.importGoto)); return; }
    if (hit("#validate-import")) { validateImport(); return; }
    if (hit("#confirm-import")) { confirmImport(); return; }

    if (hit("#onboard-next")) { onboardNext(); return; }
    if (hit("#onboard-back")) { onboardBack(); return; }
    const choice = hit("[data-onboard-choice]");
    if (choice) {
      ui.onboardChoice = choice.dataset.onboardChoice;
      $$("[data-onboard-choice]").forEach((button) => button.classList.toggle("is-selected", button === choice));
      ui.onboardStep = 4;
      renderOnboardStep();
      return;
    }
  }

  async function handleChange(event) {
    if (event.target.id === "settings-import-file") {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (restoreBackupText(text)) closeDialog("settings-dialog");
      } catch (error) {
        toast("读取文件失败，请重试。");
      } finally {
        event.target.value = "";
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("#help-drawer").classList.contains("is-open")) {
        closeHelp();
      }
    });
    $("#course-form")?.addEventListener("submit", submitCourse);
    $("#chapter-form")?.addEventListener("submit", submitChapter);
    $("#session-form")?.addEventListener("submit", submitSession);
  }

  function boot() {
    renderHelp();
    bindEvents();
    let seen = false;
    try {
      seen = localStorage.getItem(ONBOARD_KEY) === "1";
    } catch (error) {
      seen = false;
    }
    if (!seen) window.setTimeout(openOnboarding, 600);
  }

  boot();
})();