(() => {
  "use strict";

  const PERSONAL = window.MOLEE_PERSONAL;
  const APP = window.MOLEE_APP;
  if (!PERSONAL || !APP) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const dialog = $("#personalize-dialog");
  let nicknameTimer = null;
  let uploadInProgress = false;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function current() {
    return PERSONAL.settings;
  }

  function notify(message) {
    APP.toast(message);
  }

  function themeName(id) {
    return PERSONAL.THEMES[id]?.name || "自定义";
  }

  function renderThemes() {
    const container = $("#pn-themes");
    if (!container) return;
    const active = current().theme;
    container.innerHTML = Object.entries(PERSONAL.THEMES).map(([id, theme]) => `
      <button class="pn-theme${id === active ? " is-selected" : ""}" type="button" data-pn-theme="${escapeHTML(id)}" style="--swatch:${escapeHTML(theme.accent)}" aria-pressed="${id === active}">
        <span class="pn-theme-dot" aria-hidden="true"></span>
        <b>${escapeHTML(theme.name)}</b>
      </button>`).join("");
  }

  function renderBackgrounds() {
    const container = $("#pn-bg-choices");
    if (!container) return;
    const settings = current();
    const background = settings.background;
    const choices = PERSONAL.BACKGROUNDS.map((item) => ({ ...item, kind: "builtin" }));
    if (background.kind === "custom" && background.src) {
      choices.push({ id: "custom", name: "自定义图片", src: background.src, kind: "custom" });
    }
    container.innerHTML = choices.map((choice) => {
      const selected = choice.kind === background.kind && (choice.kind === "custom" || choice.id === background.id);
      return `
        <button class="pn-bg-choice${selected ? " is-selected" : ""}" type="button" data-pn-bg-kind="${choice.kind}" data-pn-bg-id="${escapeHTML(choice.id)}" aria-pressed="${selected}" title="${escapeHTML(choice.name)}">
          <img src="${escapeHTML(choice.src)}" alt="${escapeHTML(choice.name)}">
          <span>${escapeHTML(choice.name)}</span>
        </button>`;
    }).join("");

    const uploadLabel = $("#pn-bg-upload-label");
    if (uploadLabel) uploadLabel.textContent = background.kind === "custom" ? "更换图片" : "上传图片";
  }

  function renderSliders() {
    const settings = current();
    const background = settings.background;
    const values = {
      "#pn-opacity": Math.round(background.opacity * 100),
      "#pn-size": Math.round(background.size),
      "#pn-x": Math.round(background.x),
      "#pn-y": Math.round(background.y),
      "#pn-alpha": Math.round(settings.surfaceAlpha * 100),
    };
    Object.entries(values).forEach(([selector, value]) => {
      const input = $(selector);
      if (input) input.value = String(value);
    });
    $("#pn-opacity-value").textContent = `${values["#pn-opacity"]}%`;
    $("#pn-size-value").textContent = `${values["#pn-size"]}%`;
    $("#pn-x-value").textContent = `${values["#pn-x"]}%`;
    $("#pn-y-value").textContent = `${values["#pn-y"]}%`;
    $("#pn-alpha-value").textContent = `${values["#pn-alpha"]}%`;
  }

  function renderFontChoices() {
    const scale = Number(current().fontScale);
    $$("[data-font-scale]").forEach((button) => {
      const selected = Math.abs(Number(button.dataset.fontScale) - scale) < 0.01;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderToggles() {
    const settings = current();
    const companions = $("#pn-companions");
    const quotes = $("#pn-quotes");
    if (companions) companions.checked = settings.showCompanions;
    if (quotes) quotes.checked = settings.showQuotes;
    $("#pn-companions-label").textContent = settings.showCompanions ? "显示" : "隐藏";
    $("#pn-quotes-label").textContent = settings.showQuotes ? "显示" : "隐藏";
    $("#pn-interval").value = String(settings.companionMinutes);
  }

  function renderTasks() {
    current().tasks.forEach((task, index) => {
      const input = $(`#pn-task-${index}`);
      if (input && document.activeElement !== input) input.value = task;
    });
  }

  function activeQuoteList() {
    const custom = current().customQuotes;
    return Array.isArray(custom) && custom.length ? custom : (APP.builtinQuotes || []);
  }

  function renderQuotes() {
    const container = $("#pn-quotes-editor");
    if (!container) return;
    const isCustom = Boolean(current().customQuotes?.length);
    const quotes = activeQuoteList();
    container.innerHTML = quotes.map((quote, index) => `
      <div class="pn-quote-row">
        <span class="pn-quote-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="pn-quote-copy"><strong>${escapeHTML(quote.text)}</strong><small>—— ${escapeHTML(quote.author || "佚名")}${isCustom ? "" : " · 内置"}</small></span>
        <button class="pn-quote-delete" type="button" data-pn-quote-delete="${index}" aria-label="删除第 ${index + 1} 句语录" title="删除"><svg class="icon"><use href="#i-close"></use></svg></button>
      </div>`).join("");
  }

  function renderAll() {
    const nickname = $("#pn-nickname");
    if (nickname && document.activeElement !== nickname) nickname.value = current().nickname || "";
    renderThemes();
    renderBackgrounds();
    renderSliders();
    renderFontChoices();
    renderToggles();
    renderTasks();
    renderQuotes();
  }

  function openPersonalize() {
    if (!dialog) return;
    renderAll();
    if (!dialog.open) dialog.showModal();
  }

  function applyTheme(id) {
    if (!PERSONAL.THEMES[id]) return;
    if (!PERSONAL.update({ theme: id })) {
      notify("主题保存失败，请检查浏览器存储空间。");
      return;
    }
    renderThemes();
  }

  function applyBackground(kind, id) {
    let source = "assets/backgrounds/sakura.jpg";
    if (kind === "custom") {
      source = current().background.src;
    } else {
      const background = PERSONAL.BACKGROUNDS.find((item) => item.id === id);
      if (!background) return;
      source = background.src;
    }
    if (!PERSONAL.update({ background: { kind, id, src: source } })) {
      notify("背景保存失败，请检查浏览器存储空间。");
      return;
    }
    renderBackgrounds();
  }

  function applyFontScale(value) {
    const scale = Number(value);
    if (![0.9, 1, 1.12, 1.2].includes(scale)) return;
    if (!PERSONAL.update({ fontScale: scale })) {
      notify("字号保存失败，请检查浏览器存储空间。");
      return;
    }
    renderFontChoices();
  }

  function addQuote() {
    const textInput = $("#pn-quote-text");
    const authorInput = $("#pn-quote-author");
    const text = textInput?.value.trim() || "";
    const author = authorInput?.value.trim() || "佚名";
    if (!text) {
      textInput?.focus();
      notify("先写一句想看到的语录。");
      return;
    }
    const base = current().customQuotes?.length ? current().customQuotes.slice() : (APP.builtinQuotes || []).slice();
    if (base.length >= 60) {
      notify("最多保存 60 句，轮播已经很热闹了。");
      return;
    }
    const next = [...base, { text, author }];
    if (!PERSONAL.update({ customQuotes: next })) {
      notify("语录保存失败，请检查浏览器存储空间。");
      return;
    }
    APP.refreshQuotes();
    if (textInput) textInput.value = "";
    if (authorInput) authorInput.value = "";
    renderQuotes();
    textInput?.focus();
    notify("已加入首页轮播。");
  }

  function deleteQuote(index) {
    const list = activeQuoteList();
    if (list.length <= 1) {
      notify("至少保留一句语录。");
      return;
    }
    const next = list.filter((_, itemIndex) => itemIndex !== index);
    if (!PERSONAL.update({ customQuotes: next })) {
      notify("语录保存失败，请检查浏览器存储空间。");
      return;
    }
    APP.refreshQuotes();
    renderQuotes();
  }

  function resetQuotes() {
    if (!PERSONAL.update({ customQuotes: null })) {
      notify("语录恢复失败，请检查浏览器存储空间。");
      return;
    }
    APP.refreshQuotes();
    renderQuotes();
    notify("已恢复内置忍者语录。");
  }

  function resetAll() {
    if (!window.confirm("恢复后，昵称、主题、背景、字号、任务名称和自定义语录都会回到初始状态。继续吗？")) return;
    PERSONAL.resetAll();
    APP.reapplyPersonalization();
    APP.rescheduleCarousels();
    APP.refreshQuotes();
    renderAll();
    notify("个性化设置已全部恢复默认。");
  }

  function commitSlider() {
    if (!PERSONAL.commit()) notify("设置保存失败，请检查浏览器存储空间。");
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image-load-failed"));
      image.src = url;
    });
  }

  async function compressBackground(file) {
    if (!file.type.startsWith("image/")) throw new Error("not-an-image");
    if (file.size > 25 * 1024 * 1024) throw new Error("too-large");
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const attempts = [
        [1920, 0.84],
        [1600, 0.8],
        [1280, 0.76],
        [1024, 0.7],
      ];
      for (const [maxEdge, quality] of attempts) {
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fffaf2";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", quality);
        if (data.length <= 1800000) return data;
      }
      throw new Error("compressed-image-too-large");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function uploadBackground(file) {
    if (!file || uploadInProgress) return;
    const input = $("#pn-bg-upload");
    const label = $("#pn-bg-upload-label");
    uploadInProgress = true;
    if (label) label.textContent = "处理中…";
    try {
      const source = await compressBackground(file);
      if (!PERSONAL.update({ background: { kind: "custom", id: "custom", src: source } })) {
        notify("这张图片超出了本地存储空间，请换一张更小的图片。");
        renderAll();
        return;
      }
      renderAll();
      notify("背景图已更新，位置和透明度可以继续微调。");
    } catch (error) {
      notify(error.message === "too-large" ? "图片不能超过 25MB。" : "图片读取失败，请换一张 JPG 或 PNG。");
      if (label) label.textContent = current().background.kind === "custom" ? "更换图片" : "上传图片";
    } finally {
      uploadInProgress = false;
      if (input) input.value = "";
    }
  }

  function handleClick(event) {
    const hit = (selector) => event.target.closest(selector);
    if (hit("#open-personalize")) {
      openPersonalize();
      return;
    }

    const theme = hit("[data-pn-theme]");
    if (theme) {
      applyTheme(theme.dataset.pnTheme);
      return;
    }

    const background = hit("[data-pn-bg-kind]");
    if (background) {
      applyBackground(background.dataset.pnBgKind, background.dataset.pnBgId);
      return;
    }

    const font = hit("[data-font-scale]");
    if (font) {
      applyFontScale(font.dataset.fontScale);
      return;
    }

    const deleteButton = hit("[data-pn-quote-delete]");
    if (deleteButton) {
      deleteQuote(Number(deleteButton.dataset.pnQuoteDelete));
      return;
    }

    if (hit("#pn-quote-add")) { addQuote(); return; }
    if (hit("#pn-quotes-reset")) { resetQuotes(); return; }
    if (hit("#pn-bg-reset")) {
      PERSONAL.resetBackground();
      renderBackgrounds();
      renderSliders();
      notify("背景已恢复默认。");
      return;
    }
    if (hit("#pn-reset-all")) { resetAll(); return; }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("#pn-nickname")) {
      window.clearTimeout(nicknameTimer);
      nicknameTimer = window.setTimeout(() => {
        if (!PERSONAL.update({ nickname: target.value.trim() })) notify("昵称保存失败，请检查浏览器存储空间。");
        APP.reapplyPersonalization();
      }, 140);
      return;
    }

    const backgroundKeys = {
      "pn-opacity": ["opacity", 100, "%"],
      "pn-size": ["size", 1, "%"],
      "pn-x": ["x", 1, "%"],
      "pn-y": ["y", 1, "%"],
    };
    if (backgroundKeys[target.id]) {
      const [key, divisor, suffix] = backgroundKeys[target.id];
      const value = Number(target.value) / divisor;
      PERSONAL.preview({ background: { [key]: value } });
      $(`#${target.id}-value`).textContent = `${target.value}${suffix}`;
      return;
    }

    if (target.matches("#pn-alpha")) {
      PERSONAL.preview({ surfaceAlpha: Number(target.value) / 100 });
      $("#pn-alpha-value").textContent = `${target.value}%`;
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches("#pn-bg-upload")) {
      uploadBackground(target.files?.[0]);
      return;
    }
    if (target.matches("#pn-companions")) {
      if (!PERSONAL.update({ showCompanions: target.checked })) notify("设置保存失败，请检查浏览器存储空间。");
      renderToggles();
      return;
    }
    if (target.matches("#pn-quotes")) {
      if (!PERSONAL.update({ showQuotes: target.checked })) notify("设置保存失败，请检查浏览器存储空间。");
      renderToggles();
      return;
    }
    if (target.matches("#pn-interval")) {
      if (!PERSONAL.update({ companionMinutes: Number(target.value) })) {
        notify("轮播频率保存失败，请检查浏览器存储空间。");
        renderToggles();
        return;
      }
      APP.rescheduleCarousels();
      notify(`人物插画改为每 ${target.value} 分钟切换。`);
      return;
    }
    if (target.matches("#pn-task-0, #pn-task-1, #pn-task-2")) {
      const tasks = current().tasks.map((task, index) => {
        const input = $(`#pn-task-${index}`);
        return (input?.value.trim() || PERSONAL.defaults.tasks[index]).slice(0, 8);
      });
      if (!PERSONAL.update({ tasks })) {
        notify("任务名称保存失败，请检查浏览器存储空间。");
        renderTasks();
        return;
      }
      renderTasks();
      APP.refreshAll();
      notify("章节任务名称已更新。");
      return;
    }
    if (target.matches("#pn-opacity, #pn-size, #pn-x, #pn-y, #pn-alpha")) commitSlider();
  }

  function handleKeydown(event) {
    if (!dialog?.open) return;
    if (event.key === "Enter" && event.target.matches("#pn-quote-text, #pn-quote-author")) {
      event.preventDefault();
      addQuote();
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("keydown", handleKeydown);
})();
