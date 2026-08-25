(function () {
  const data = window.NeverBlogData;
  const defaultData = JSON.parse(JSON.stringify(data));
  const state = {
    isLoggedIn: false,
    sessionLoaded: false,
    musicIndex: 0,
    seeking: false,
    musicReady: false,
    navigating: false,
    userId: null,
    cloudOwnerId: null,
    adminId: null,
    isAdmin: false,
    currentProfile: null,
    activityScore: 0,
    activityTitle: "初入人",
    activityCheckedToday: false,
    activityNextScore: 50,
    activityNextTitle: "漂泊者",
    cloudMutationVersion: 0,
    mediaDataLoaded: false,
    mediaRefreshNonce: 0,
    mediaRefreshPromise: null,
    mediaLastRefreshedAt: 0,
    notesLoadVersion: 0,
    notesReturnOpen: false,
    navigationVersion: 0,
    navigationController: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const params = () => new URLSearchParams(window.location.search);
  const pageName = () => document.body.dataset.page || "home";

  // Brand icons are rendered as inline SVG so a slow/missing icon font cannot
  // make the contact row disappear on a cold page load.
  function contactIconMarkup(type) {
    const common = 'class="contact-brand-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    if (type === "github") return `<svg ${common} fill="currentColor"><path d="M12 .7a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.4 1.23-3.25-.12-.3-.53-1.54.12-3.2 0 0 1-.33 3.3 1.24A11.4 11.4 0 0 1 12 6.36c1.02 0 2.04.14 3 .42 2.3-1.57 3.3-1.24 3.3-1.24.65 1.66.24 2.9.12 3.2.77.85 1.23 1.93 1.23 3.25 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v2.65c0 .32.22.69.83.57A12 12 0 0 0 12 .7Z"/></svg>`;
    if (type === "instagram") return `<svg ${common} fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>`;
    if (type === "douyin") return `<svg ${common} fill="currentColor"><path d="M14.2 3h3.05c.25 1.72 1.23 2.9 2.95 3.6v3.1a8.2 8.2 0 0 1-2.95-1.02v6.1a5.22 5.22 0 1 1-5.22-5.22c.37 0 .74.04 1.1.12v3.16a2.16 2.16 0 1 0 1.07 1.94V3Z"/></svg>`;
    return '<span class="contact-icon-email" aria-hidden="true">@</span>';
  }

  function requireLogin(message = "请先登录后再使用此功能。") {
    if (state.isLoggedIn) return true;
    alert(message);
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.href = `./login.html?next=${encodeURIComponent(next)}`;
    return false;
  }

  function hasActivityAccess(requiredScore) {
    return state.isAdmin || (state.isLoggedIn && state.activityScore >= requiredScore);
  }

  function showActivityNotice(title, message, options = {}) {
    let modal = $("[data-activity-notice-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal activity-notice-modal";
      modal.dataset.activityNoticeModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-activity-notice-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-activity-notice-close aria-label="关闭">×</button><div class="activity-notice-icon" aria-hidden="true">✦</div><p class="mini-title">ACTIVITY RIGHTS</p><h2 data-activity-notice-title></h2><p data-activity-notice-message></p><div class="publish-confirm-actions" data-activity-notice-actions></div></section>`;
      document.body.appendChild(modal);
    }
    $("[data-activity-notice-title]", modal).textContent = title;
    $("[data-activity-notice-message]", modal).textContent = message;
    const actions = $("[data-activity-notice-actions]", modal);
    actions.innerHTML = options.login
      ? '<button class="ghost-button" type="button" data-activity-notice-close>先看看</button><a class="primary-button" href="./login.html">去登录</a>'
      : '<button class="primary-button" type="button" data-activity-notice-close>我知道了</button><a class="ghost-button" href="./activity.html">查看活跃榜</a>';
    $all("[data-activity-notice-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
  }

  function requireActivityAccess(requiredScore, rightName) {
    if (hasActivityAccess(requiredScore)) return true;
    if (!state.isLoggedIn) {
      showActivityNotice("登录后参与", `登录并达到 ${requiredScore} 活跃度后，即可使用${rightName}。`, { login: true });
    } else {
      showActivityNotice("活跃度尚未解锁", `你的活跃度为 ${state.activityScore}，达到 ${requiredScore} 后即可使用${rightName}。`);
    }
    return false;
  }

  function ensureActivityNavLink() {
    $all(".top-nav").forEach((nav) => {
      if ($("a[href='./activity.html']", nav)) return;
      const link = document.createElement("a");
      link.href = "./activity.html";
      link.textContent = "活跃榜";
      const projectsLink = $("a[href='./projects.html']", nav);
      nav.insertBefore(link, projectsLink || $("a[href='./about.html']", nav) || null);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  // Supabase rows use arrays, while older/imported rows may use comma text.
  // All article UI reads this one normalized representation.
  function parseCommaTags(value, limit = 24) {
    const raw = Array.isArray(value) ? value : [value];
    return [...new Set(raw
      .flatMap((item) => String(item || "").split(/[，,]/))
      .map((item) => item.trim().replace(/^#/, ""))
      .filter(Boolean))]
      .slice(0, limit);
  }

  const HIGHLIGHT_COLORS = new Set(["#ffddd8", "#d8f2e2", "#dce9ff"]);
  const PROFILE_TAGS = ["注重感情", "独处", "自由", "全球游", "世界游", "热爱阅读", "探索未知", "爱动脑子", "脑洞大", "敏感", "爱学习", "吃货一枚", "学霸一枚", "热爱生活", "热爱旅游", "喜欢美女", "喜欢帅哥", "爱音乐"];
  const ADMIN_PROFILE_TAGS = ["注重感情", "独处", "自由", "世界游", "热爱阅读", "探索未知"];
  const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
  const WHISPER_EMOJIS = ["😀", "😂", "🥹", "😭", "😡", "🥳", "❤️", "👍", "✨", "🌈", "🍜", "☕", "🎮", "📚", "🌙", "🔥"];
  const ACTIVITY_LEVELS = [
    { score: 10, title: "初入人", right: "解锁发布、评论功能" },
    { score: 50, title: "漂泊者", right: "解锁更多专属阅读内容" },
    { score: 100, title: "知罗者", right: "权益正在开发中" },
    { score: 200, title: "熟知罗者", right: "权益正在开发中" },
    { score: 300, title: "深知罗者", right: "权益正在开发中" },
    { score: 500, title: "拾光罗客", right: "权益正在开发中" },
    { score: 800, title: "拾星罗客", right: "权益正在开发中" },
    { score: 1000, title: "罗客星使", right: "权益正在开发中" },
    { score: 2000, title: "全站星使", right: "权益正在开发中" },
    { score: 4000, title: "罗客神", right: "权益正在开发中" }
  ];
  const ACTIVITY_RULES = [
    ["注册用户", "+10", "注册后自动获得"], ["完善 MBTI", "+20", "资料填写后自动计算"],
    ["完善性别", "+10", "资料填写后自动计算"], ["完善标签", "+20", "选择至少一个标签"],
    ["每日签到", "+20", "按中国时间每日一次"], ["点赞", "+5", "每个有效点赞"],
    ["文章/动态评论", "+5", "评论和回复均计算"], ["发布碎碎念", "+5", "每一条有效发布"]
  ];

  function activityLevelForScore(score) {
    const value = Math.max(0, Number(score) || 0);
    if (!value) return { score: 0, title: "全站公开" };
    return [...ACTIVITY_LEVELS].reverse().find((level) => value >= level.score) || ACTIVITY_LEVELS[0];
  }
  const CODE_LANGUAGES = [
    ["auto", "自动识别"], ["javascript", "JavaScript"], ["typescript", "TypeScript"], ["html", "HTML/XML"], ["css", "CSS"],
    ["python", "Python"], ["java", "Java"], ["c", "C"], ["cpp", "C++"], ["csharp", "C#"], ["go", "Go"], ["rust", "Rust"],
    ["sql", "SQL"], ["json", "JSON"], ["bash", "Bash"], ["powershell", "PowerShell"], ["php", "PHP"], ["ruby", "Ruby"],
    ["kotlin", "Kotlin"], ["swift", "Swift"], ["markdown", "Markdown"], ["yaml", "YAML"]
  ];

  function formatPlainRichText(value) {
    let html = escapeHtml(value || "");
    const links = [];
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
      const token = `@@XIAOLUO_LINK_${links.length}@@`;
      links.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
      return token;
    });
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.+?)__/g, "<u>$1</u>");
    html = html.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    return html.replace(/@@XIAOLUO_LINK_(\d+)@@/g, (_match, index) => links[Number(index)] || "");
  }

  function sanitizeRichHtml(value) {
    const source = document.createElement("div");
    source.innerHTML = String(value || "");
    const output = document.createElement("div");
    const appendClean = (node, parent) => {
      if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.nodeValue || "")); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      if (tag === "br") { parent.append(document.createElement("br")); return; }
      if (tag === "pre") {
        const sourceCode = node.querySelector("code") || node;
        const language = String(sourceCode.dataset.language || [...sourceCode.classList].find((name) => name.startsWith("language-"))?.slice(9) || "auto").toLowerCase();
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        const safeLanguage = /^[a-z0-9+#.-]{1,24}$/.test(language) ? language : "auto";
        pre.dataset.language = safeLanguage;
        code.dataset.language = safeLanguage;
        if (safeLanguage !== "auto") code.className = `language-${safeLanguage}`;
        code.textContent = sourceCode.textContent || "";
        pre.append(code);
        parent.append(pre);
        return;
      }
      if (["ul", "ol", "li"].includes(tag)) {
        const element = document.createElement(tag);
        [...node.childNodes].forEach((child) => appendClean(child, element));
        parent.append(element);
        return;
      }
      if (["h1", "h2", "h3", "h4", "h5", "blockquote"].includes(tag)) {
        const element = document.createElement(tag);
        [...node.childNodes].forEach((child) => appendClean(child, element));
        parent.append(element);
        return;
      }
      if (tag === "img") {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        if (/^(https?:\/\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i.test(src)) {
          const image = document.createElement("img");
          image.src = src;
          image.alt = alt.slice(0, 180);
          const width = Number.parseInt(node.getAttribute("width") || node.style.width, 10);
          const height = Number.parseInt(node.getAttribute("height") || node.style.height, 10);
          if (Number.isFinite(width) && width > 20 && width <= 4000) image.width = width;
          if (Number.isFinite(height) && height > 20 && height <= 4000) image.height = height;
          image.loading = "lazy";
          parent.append(image);
        }
        return;
      }
      const mapped = tag === "b" ? "strong" : tag;
      if (["strong", "u"].includes(mapped)) {
        const element = document.createElement(mapped);
        [...node.childNodes].forEach((child) => appendClean(child, element));
        parent.append(element);
        return;
      }
      if (tag === "a") {
        const href = node.getAttribute("href") || "";
        if (/^https?:\/\//i.test(href)) {
          const link = document.createElement("a");
          link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
          [...node.childNodes].forEach((child) => appendClean(child, link));
          parent.append(link);
        } else [...node.childNodes].forEach((child) => appendClean(child, parent));
        return;
      }
      if (tag === "span") {
        const color = (node.style.backgroundColor || "").toLowerCase();
        const palette = { "rgb(255, 221, 216)": "#ffddd8", "rgb(216, 242, 226)": "#d8f2e2", "rgb(220, 233, 255)": "#dce9ff" };
        const selected = HIGHLIGHT_COLORS.has(color) ? color : palette[color];
        if (selected) {
          const span = document.createElement("span");
          span.className = "rich-highlight";
          span.style.backgroundColor = selected;
          [...node.childNodes].forEach((child) => appendClean(child, span));
          parent.append(span);
        } else [...node.childNodes].forEach((child) => appendClean(child, parent));
        return;
      }
      if (["div", "p"].includes(tag)) {
        // Keep each editor block as its own block on the reading page. Flattening
        // div/p here made a heading merge into the following line after saving.
        const element = document.createElement(tag);
        [...node.childNodes].forEach((child) => appendClean(child, element));
        parent.append(element);
        return;
      }
      [...node.childNodes].forEach((child) => appendClean(child, parent));
    };
    [...source.childNodes].forEach((node) => appendClean(node, output));
    return output.innerHTML;
  }

  function elementForRange(range, selector) {
    if (!range) return null;
    const nodes = [range.startContainer, range.endContainer, range.commonAncestorContainer]
      .map((node) => node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)
      .filter(Boolean);
    return nodes.map((node) => node.closest?.(selector)).find(Boolean) || null;
  }

  function normalizedHighlightColor(element) {
    if (!element) return "";
    const color = String(element.style?.backgroundColor || window.getComputedStyle(element).backgroundColor || "")
      .replace(/\s/g, "").toLowerCase();
    const palette = {
      "rgb(255,221,216)": "#ffddd8",
      "rgb(216,242,226)": "#d8f2e2",
      "rgb(220,233,255)": "#dce9ff"
    };
    return HIGHLIGHT_COLORS.has(color) ? color : (palette[color] || "");
  }

  function cleanEditorHighlights(input) {
    $all("span.rich-highlight, span[style*='background-color']", input).forEach((span) => {
      const color = normalizedHighlightColor(span);
      if (color) {
        span.className = "rich-highlight";
        span.style.backgroundColor = color;
        return;
      }
      // Transparent native formatting spans must not trap the caret or affect
      // the text typed on the following line.
      span.replaceWith(...span.childNodes);
    });
  }

  function linkifyRichHtml(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value || "");
    const textNodes = [];
    const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest("a, pre, code") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) {
      if (/https?:\/\/[^\s<]+/i.test(node.textContent || "")) textNodes.push(node);
      node = walker.nextNode();
    }
    textNodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      const parts = (textNode.textContent || "").split(/(https?:\/\/[^\s<]+)/gi);
      parts.forEach((part) => {
        if (!/^https?:\/\/[^\s<]+$/i.test(part)) {
          fragment.append(document.createTextNode(part));
          return;
        }
        const link = document.createElement("a");
        link.href = part;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = part;
        fragment.append(link);
      });
      textNode.replaceWith(fragment);
    });
    return holder.innerHTML;
  }

  function normalizeRichHtml(value) {
    return linkifyRichHtml(sanitizeRichHtml(value));
  }

  function formatRichText(value) {
    const raw = String(value || "");
    return /<\/?[a-z][\s\S]*>/i.test(raw) ? normalizeRichHtml(raw) : formatPlainRichText(raw);
  }

  function linkify(value) { return formatRichText(value); }

  function enhanceFormatToolbar(toolbar) {
    if (toolbar.querySelector('[data-format-action="orderedList"]')) return;
    const divider = $(".format-toolbar-divider", toolbar);
    const group = document.createDocumentFragment();
    const heading = document.createElement("select");
    heading.className = "format-heading-select";
    heading.dataset.formatHeading = "";
    heading.title = "设置标题层级";
    heading.innerHTML = '<option value="p">正文</option><option value="h1">一级标题</option><option value="h2">二级标题</option><option value="h3">三级标题</option><option value="h4">四级标题</option><option value="h5">五级标题</option>';
    group.append(heading);
    [["orderedList", "1.", "有序列表"], ["unorderedList", "•", "无序列表"], ["quote", "❝", "插入引用"], ["codeBlock", "</>", "插入代码块"]].forEach(([action, label, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.formatAction = action;
      button.title = title;
      button.textContent = label;
      if (action === "codeBlock") button.className = "format-code-button";
      group.append(button);
    });
    toolbar.insertBefore(group, divider || null);
  }

  function openRichLinkDialog(input) {
    const selection = window.getSelection();
    const savedRange = selection?.rangeCount && input.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    const selectedText = savedRange?.toString() || "链接文字";
    let modal = $("[data-rich-link-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal code-block-modal";
      modal.dataset.richLinkModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-rich-link-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="rich-link-title"><button class="modal-close" type="button" data-rich-link-close aria-label="关闭">×</button><p class="mini-title">INSERT LINK</p><h2 id="rich-link-title">插入超链接</h2><form data-rich-link-form><label><span>显示文字</span><input name="label" required></label><label><span>链接地址</span><input name="url" type="url" placeholder="https://" required></label><div class="publish-confirm-actions"><button class="ghost-button" type="button" data-rich-link-close>取消</button><button class="primary-button" type="submit">插入链接</button></div></form></section>';
      document.body.appendChild(modal);
    }
    const form = $("[data-rich-link-form]", modal);
    form.reset();
    form.label.value = selectedText;
    $all("[data-rich-link-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    form.onsubmit = (event) => {
      event.preventDefault();
      const label = form.label.value.trim();
      const url = form.url.value.trim();
      if (!label || !/^https?:\/\//i.test(url)) return;
      input.focus();
      if (savedRange) {
        const currentSelection = window.getSelection();
        currentSelection.removeAllRanges();
        currentSelection.addRange(savedRange);
      }
      document.execCommand("insertHTML", false, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      modal.classList.remove("open");
    };
    modal.classList.add("open");
    window.setTimeout(() => form.label.select(), 40);
  }

  function openCodeBlockDialog(input) {
    const selection = window.getSelection();
    const savedRange = selection?.rangeCount && input.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
    let modal = $("[data-code-block-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal code-block-modal";
      modal.dataset.codeBlockModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-code-block-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="code-block-title"><button class="modal-close" type="button" data-code-block-close aria-label="关闭">×</button><p class="mini-title">CODE BLOCK</p><h2 id="code-block-title">插入代码块</h2><p>选择语言后会自动进行语法高亮。</p><form data-code-block-form><label><span>编程语言</span><select name="language">${CODE_LANGUAGES.map(([value, name]) => `<option value="${value}">${name}</option>`).join("")}</select></label><label><span>代码内容</span><textarea name="code" rows="10" spellcheck="false" required placeholder="在这里粘贴代码…"></textarea></label><div class="publish-confirm-actions"><button class="ghost-button" type="button" data-code-block-close>取消</button><button class="primary-button" type="submit">插入代码</button></div></form></section>`;
      document.body.appendChild(modal);
    }
    const form = $("[data-code-block-form]", modal);
    form.reset();
    form.code.value = savedRange?.toString() || "";
    $all("[data-code-block-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    form.onsubmit = (event) => {
      event.preventDefault();
      const language = form.language.value;
      const code = form.code.value;
      if (!code.trim()) return;
      input.focus();
      if (savedRange) {
        const currentSelection = window.getSelection();
        currentSelection.removeAllRanges();
        currentSelection.addRange(savedRange);
      }
      const languageAttribute = language === "auto" ? 'data-language="auto"' : `class="language-${language}" data-language="${language}"`;
      document.execCommand("insertHTML", false, `<div class="editor-code-buffer"><br></div><pre data-language="${language}"><code ${languageAttribute}>${escapeHtml(code)}</code></pre><div class="editor-code-buffer"><br></div>`);
      ensureCodeBlockBuffers(input);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      window.setTimeout(() => highlightCodeBlocks(input), 0);
      modal.classList.remove("open");
    };
    modal.classList.add("open");
    window.setTimeout(() => form.code.focus(), 40);
  }

  function highlightCodeBlocks(root = document) {
    const blocks = $all("pre code", root).filter((block) => !block.dataset.highlighted);
    if (!blocks.length) return;
    const run = () => blocks.forEach((block) => { try { window.hljs.highlightElement(block); } catch (_) {} });
    if (window.hljs) { run(); return; }
    if (!window.__xiaoluoHighlightPromise) {
      window.__xiaoluoHighlightPromise = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js";
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
      });
    }
    window.__xiaoluoHighlightPromise.then(run);
  }

  function getEditorSelectionRange(input) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !input.contains(selection.anchorNode)) return null;
    return selection.getRangeAt(0).cloneRange();
  }

  function restoreEditorSelection(input, range) {
    input.focus({ preventScroll: true });
    if (!range) return;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function editorBlockAt(range, input) {
    const node = range?.startContainer?.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range?.startContainer?.parentElement;
    const block = node?.closest?.("h1, h2, h3, h4, h5, blockquote, p, div, li");
    return block && input.contains(block) && block !== input ? block : null;
  }

  function placeEditorCaret(node, offset = 0) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertCleanParagraphAfter(block, range) {
    const paragraph = document.createElement("div");
    if (range) {
      const caret = range.cloneRange();
      caret.collapse(false);
      const tail = document.createRange();
      tail.setStart(caret.startContainer, caret.startOffset);
      tail.setEnd(block, block.childNodes.length);
      const remainder = tail.extractContents();
      paragraph.append(remainder);
    }
    if (!paragraph.childNodes.length) paragraph.append(document.createElement("br"));
    block.after(paragraph);
    placeEditorCaret(paragraph, 0);
  }

  function exitEditorInlineFormat(input, range) {
    restoreEditorSelection(input, range);
    const heading = editorBlockAt(range, input)?.closest("h1, h2, h3, h4, h5");
    if (heading) {
      // Do not delegate this to execCommand: Chromium sometimes leaves an
      // empty heading behind, which makes the next Enter appear to do nothing.
      const tail = range.cloneRange();
      tail.collapse(false);
      tail.setEnd(heading, heading.childNodes.length);
      const paragraph = document.createElement("div");
      paragraph.append(tail.extractContents());
      if (!paragraph.childNodes.length) paragraph.append(document.createElement("br"));
      heading.after(paragraph);
      placeEditorCaret(paragraph, 0);
      document.execCommand("styleWithCSS", false, false);
      if (document.queryCommandState("bold")) document.execCommand("bold", false, false);
      if (document.queryCommandState("underline")) document.execCommand("underline", false, false);
      document.execCommand("hiliteColor", false, "transparent");
      cleanEditorHighlights(input);
      return true;
    }
    document.execCommand("insertParagraph");
    // Browsers split headings correctly with insertParagraph; explicitly turn
    // the new block back into body text so Enter never needs a second press.
    document.execCommand("formatBlock", false, "div");
    document.execCommand("hiliteColor", false, "transparent");
    if (document.queryCommandState("bold")) document.execCommand("bold", false, false);
    if (document.queryCommandState("underline")) document.execCommand("underline", false, false);
    cleanEditorHighlights(input);
    return true;
  }

  function resetEmptyEditorTypingState(input, range) {
    const block = editorBlockAt(range, input);
    if (!block || block.textContent.trim() || /^H[1-5]$/i.test(block.tagName)) return;
    restoreEditorSelection(input, range);
    document.execCommand("styleWithCSS", false, false);
    if (document.queryCommandState("bold")) document.execCommand("bold", false, false);
    if (document.queryCommandState("underline")) document.execCommand("underline", false, false);
    document.execCommand("hiliteColor", false, "transparent");
  }

  function rootEditorLineBlock(input, range) {
    const directChild = (node) => {
      let current = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      while (current?.parentElement && current.parentElement !== input) current = current.parentElement;
      return current?.parentElement === input ? current : null;
    };
    const current = directChild(range?.startContainer);
    if (!current) return null;
    if (current.nodeType === Node.ELEMENT_NODE && /^(H[1-5]|P|DIV|LI)$/i.test(current.tagName)) return current;
    const children = [...input.childNodes];
    let start = Math.max(0, children.indexOf(current));
    let end = start + 1;
    while (start > 0 && children[start - 1]?.nodeName !== "BR") start -= 1;
    while (end < children.length && children[end]?.nodeName !== "BR") end += 1;
    const lineRange = document.createRange();
    lineRange.setStart(input, start);
    lineRange.setEnd(input, end);
    const wrapper = document.createElement("div");
    wrapper.append(lineRange.extractContents());
    input.insertBefore(wrapper, input.childNodes[start] || null);
    return wrapper;
  }

  function applyEditorHeading(input, heading, savedRange) {
    const range = savedRange || getEditorSelectionRange(input);
    restoreEditorSelection(input, range);
    if (!range) return;
    // Native formatBlock keeps the browser undo stack intact and applies the
    // heading only to the selected/current block.
    document.execCommand("formatBlock", false, heading === "p" ? "div" : heading);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function ensureCodeBlockBuffers(input) {
    $all("pre", input).forEach((pre) => {
      const insertBuffer = (position) => {
        const buffer = document.createElement("div");
        buffer.className = "editor-code-buffer";
        buffer.append(document.createElement("br"));
        pre[position](buffer);
      };
      if (!pre.previousElementSibling || /^(PRE|H[1-5]|BLOCKQUOTE)$/i.test(pre.previousElementSibling.tagName)) insertBuffer("before");
      if (!pre.nextElementSibling || pre.nextElementSibling.tagName === "PRE") insertBuffer("after");
    });
  }

  function bindEditorImageResize(input) {
    let activeImage = null;
    let startX = 0;
    let startWidth = 0;
    const finish = () => {
      if (!activeImage) return;
      activeImage.classList.remove("is-resizing");
      activeImage = null;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    input.addEventListener("pointerdown", (event) => {
      const image = event.target.closest("img");
      if (!image || !input.contains(image)) return;
      $all("img.is-selected", input).forEach((item) => item.classList.remove("is-selected"));
      image.classList.add("is-selected");
      const rect = image.getBoundingClientRect();
      const nearRightHandle = event.clientX >= rect.right - 26
        && (event.clientY <= rect.top + 26 || event.clientY >= rect.bottom - 26);
      if (event.button !== 0 || !nearRightHandle) return;
      event.preventDefault();
      activeImage = image;
      startX = event.clientX;
      startWidth = rect.width;
      image.classList.add("is-resizing");
      image.setPointerCapture?.(event.pointerId);
    });
    input.addEventListener("pointermove", (event) => {
      if (!activeImage) return;
      const maxWidth = Math.max(120, input.clientWidth - 28);
      const width = Math.round(Math.min(maxWidth, Math.max(120, startWidth + event.clientX - startX)));
      activeImage.style.width = `${width}px`;
      activeImage.style.height = "auto";
      activeImage.setAttribute("width", String(width));
      activeImage.removeAttribute("height");
    });
    input.addEventListener("pointerup", finish);
    input.addEventListener("pointercancel", finish);
  }

  function bindSelectionFormatToolbar(input, toolbar, rememberSelection) {
    if (input.dataset.selectionToolbarBound) return;
    input.dataset.selectionToolbarBound = "true";
    const floating = document.createElement("div");
    floating.className = "selection-format-toolbar";
    floating.hidden = true;
    floating.setAttribute("role", "toolbar");
    floating.setAttribute("aria-label", "选中文字格式工具");
    floating.innerHTML = [
      '<button type="button" data-floating-action="bold" title="加粗">B</button>',
      '<button type="button" data-floating-action="underline" title="下划线"><u>U</u></button>',
      '<button type="button" data-floating-action="link" title="插入超链接">↗</button>',
      '<button type="button" data-floating-action="orderedList" title="有序列表">1.</button>',
      '<button type="button" data-floating-action="unorderedList" title="无序列表">•</button>',
      '<button type="button" data-floating-action="codeBlock" title="代码块">&lt;/&gt;</button>',
      '<button type="button" data-floating-heading="h1" title="一级标题">H1</button>',
      '<button type="button" data-floating-heading="h2" title="二级标题">H2</button>',
      '<button type="button" data-floating-heading="h3" title="三级标题">H3</button>',
      '<button type="button" data-floating-heading="h4" title="四级标题">H4</button>',
      '<button type="button" data-floating-heading="h5" title="五级标题">H5</button>',
      '<button type="button" data-floating-action="quote" title="引用">❝</button>',
      '<button type="button" data-floating-action="highlight" data-highlight-color="#ffddd8" class="format-highlight red" title="红色高亮"></button>',
      '<button type="button" data-floating-action="highlight" data-highlight-color="#d8f2e2" class="format-highlight green" title="绿色高亮"></button>',
      '<button type="button" data-floating-action="highlight" data-highlight-color="#dce9ff" class="format-highlight blue" title="蓝色高亮"></button>'
    ].join("");
    document.body.appendChild(floating);

    const hide = () => { floating.hidden = true; };
    const showForSelection = () => {
      const range = getEditorSelectionRange(input);
      if (!range || range.collapsed || !range.toString().trim()) { hide(); return; }
      rememberSelection();
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) { hide(); return; }
      floating.hidden = false;
      const width = floating.offsetWidth || 280;
      floating.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`;
      floating.style.top = `${Math.max(8, rect.top - floating.offsetHeight - 10)}px`;
    };

    ["pointerdown", "mousedown"].forEach((eventName) => floating.addEventListener(eventName, (event) => event.preventDefault()));
    floating.addEventListener("click", (event) => {
      const action = event.target.closest("[data-floating-action]")?.dataset.floatingAction;
      const heading = event.target.closest("[data-floating-heading]")?.dataset.floatingHeading;
      if (heading) {
        const headingSelect = toolbar.querySelector("[data-format-heading]");
        if (headingSelect) {
          headingSelect.value = heading;
          headingSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (action) {
        const button = toolbar.querySelector(`[data-format-action="${action}"]${event.target.closest("[data-highlight-color]") ? `[data-highlight-color="${event.target.closest("[data-highlight-color]").dataset.highlightColor}"]` : ""}`);
        button?.click();
      }
      window.setTimeout(showForSelection, 0);
    });
    input.addEventListener("mouseup", () => window.setTimeout(showForSelection, 0));
    input.addEventListener("keyup", () => window.setTimeout(showForSelection, 0));
    input.addEventListener("blur", () => window.setTimeout(hide, 120));
    document.addEventListener("scroll", hide, true);
    document.addEventListener("selectionchange", () => {
      const selection = window.getSelection();
      if (!selection?.anchorNode || !input.contains(selection.anchorNode)) hide();
    });
  }

  function bindTextFormatToolbars(scope = document) {
    $all("[data-format-toolbar]", scope).forEach((toolbar) => {
      if (toolbar.dataset.bound) return;
      enhanceFormatToolbar(toolbar);
      toolbar.dataset.bound = "true";
      const input = toolbar.parentElement?.querySelector("[data-format-input]");
      if (!input) return;
      let savedRange = null;
      const rememberSelection = () => {
        const range = getEditorSelectionRange(input);
        if (range) savedRange = range;
      };
      bindSelectionFormatToolbar(input, toolbar, rememberSelection);
      ["focus", "keyup", "mouseup", "select"].forEach((eventName) => input.addEventListener(eventName, rememberSelection));
      input.addEventListener("focus", () => {
        resetEmptyEditorTypingState(input, getEditorSelectionRange(input) || savedRange);
      });
      const headingSelect = $("[data-format-heading]", toolbar);
      headingSelect?.addEventListener("mousedown", rememberSelection);
      headingSelect?.addEventListener("change", () => {
        applyEditorHeading(input, headingSelect.value, savedRange || getEditorSelectionRange(input));
        rememberSelection();
        headingSelect.value = "p";
      });
      $all("[data-format-action]", toolbar).forEach((button) => {
        button.addEventListener("mousedown", (event) => { rememberSelection(); event.preventDefault(); });
        button.onclick = () => {
          if (input.isContentEditable) {
            const range = savedRange || getEditorSelectionRange(input);
            const action = button.dataset.formatAction;
            // Inline styles are selection-only, like standard note editors.
            // This prevents a stray toolbar click from changing the style of later typing.
            if (["bold", "underline", "highlight"].includes(action) && (!range || range.collapsed)) return;
            restoreEditorSelection(input, range);
            if (action === "bold") { document.execCommand("styleWithCSS", false, false); document.execCommand("bold"); }
            else if (action === "underline") { document.execCommand("styleWithCSS", false, false); document.execCommand("underline"); }
            else if (action === "orderedList") document.execCommand("insertOrderedList");
            else if (action === "unorderedList") document.execCommand("insertUnorderedList");
            else if (action === "quote") {
              const quote = elementForRange(range, "blockquote");
              document.execCommand("formatBlock", false, quote ? "div" : "blockquote");
            }
            else if (action === "codeBlock") { openCodeBlockDialog(input); return; }
            else if (action === "highlight") {
              const color = button.dataset.highlightColor || "#dce9ff";
              const highlighted = elementForRange(range, ".rich-highlight, span[style*='background-color']");
              const current = normalizedHighlightColor(highlighted);
              document.execCommand("styleWithCSS", false, true);
              document.execCommand("hiliteColor", false, current === color ? "transparent" : color);
              cleanEditorHighlights(input);
            }
            else if (action === "link") { openRichLinkDialog(input); return; }
            input.dispatchEvent(new Event("input", { bubbles: true }));
            rememberSelection();
            return;
          }
          const start = input.selectionStart;
          const end = input.selectionEnd;
          const selected = input.value.slice(start, end) || "文字";
          let insert = selected;
          if (button.dataset.formatAction === "bold") insert = `**${selected}**`;
          if (button.dataset.formatAction === "underline") insert = `__${selected}__`;
          if (button.dataset.formatAction === "link") {
            const url = window.prompt("请输入链接地址", "https://");
            if (!url || !/^https?:\/\//i.test(url)) return;
            insert = `[${selected}](${url})`;
          }
          input.setRangeText(insert, start, end, "end");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        };
      });
      if (input.isContentEditable) {
        document.execCommand("enableObjectResizing", false, true);
        ensureCodeBlockBuffers(input);
        bindEditorImageResize(input);
        input.addEventListener("keydown", (event) => {
          const range = getEditorSelectionRange(input) || savedRange;
          if (event.key === "Enter" && range) {
            const heading = editorBlockAt(range, input)?.closest("h1, h2, h3, h4, h5");
            const highlight = elementForRange(range, ".rich-highlight, span[style*='background-color']");
            if (heading || highlight) {
              event.preventDefault();
              exitEditorInlineFormat(input, range);
              input.dispatchEvent(new Event("input", { bubbles: true }));
              rememberSelection();
              return;
            }
          }
          if (event.key === "Backspace" && range?.collapsed) {
            const block = editorBlockAt(range, input);
            const atStart = range.startOffset === 0;
            if (block && atStart && block.previousElementSibling?.tagName === "PRE") event.preventDefault();
          }
          if (!(event.ctrlKey || event.metaKey)) return;
          if (event.key.toLowerCase() === "b") {
            if (!range || range.collapsed) return;
            event.preventDefault(); document.execCommand("styleWithCSS", false, false); document.execCommand("bold"); input.dispatchEvent(new Event("input", { bubbles: true })); rememberSelection();
          }
          if (event.key.toLowerCase() === "u") {
            if (!range || range.collapsed) return;
            event.preventDefault(); document.execCommand("styleWithCSS", false, false); document.execCommand("underline"); input.dispatchEvent(new Event("input", { bubbles: true })); rememberSelection();
          }
        });
        input.addEventListener("dblclick", (event) => {
          // Selection is only for copying and formatting through the toolbar;
          // a double click must never mutate the selected text or its size.
          event.stopPropagation();
          rememberSelection();
        });
        input.addEventListener("click", (event) => {
          const link = event.target.closest("a[href]");
          if (!link || !input.contains(link)) return;
          event.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        });
        input.addEventListener("contextmenu", (event) => {
          const image = event.target.closest("img");
          if (!image || !input.contains(image)) return;
          event.preventDefault();
          confirmPublish("删除这张图片？", "删除后不会再保存到文章正文中。", "删除图片").then((confirmed) => {
            if (!confirmed) return;
            image.remove();
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
        });
        input.addEventListener("paste", async (event) => {
          const images = [...(event.clipboardData?.items || [])]
            .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
            .map((item) => item.getAsFile())
            .filter(Boolean);
          if (!images.length) return;
          event.preventDefault();
          if (!state.userId || !window.XiaoLuoSupabase?.isConfigured) {
            alert("请登录管理员账号后再粘贴图片。");
            return;
          }
          const range = getEditorSelectionRange(input) || savedRange;
          try {
            const urls = await runWithLoading("正在压缩图片中…", async () => uploadOptimizedImages(state.userId, "post-inline-images", images));
            restoreEditorSelection(input, range);
            document.execCommand("insertHTML", false, urls.map((url) => `<img src="${escapeHtml(url)}" alt="文章图片">`).join("<br>"));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            rememberSelection();
          } catch (error) {
            showCloudError(error);
          }
        });
        input.addEventListener("blur", () => {
          const normalized = normalizeRichHtml(input.innerHTML);
          if (normalized !== input.innerHTML) input.innerHTML = normalized;
          highlightCodeBlocks(input);
        });
        input.addEventListener("input", () => {
          cleanEditorHighlights(input);
          $all("pre code", input).forEach((block) => delete block.dataset.highlighted);
          $all("pre", input).forEach((pre) => {
            if (!pre.textContent.trim()) pre.remove();
          });
          ensureCodeBlockBuffers(input);
        });
      }
    });
  }

  function editorContentValue(form) {
    const input = $("[data-editor-content]", form);
    return input ? normalizeRichHtml(input.innerHTML) : (form.content?.value || "");
  }

  function setEditorContent(form, value) {
    const input = $("[data-editor-content]", form);
    if (input) {
      input.innerHTML = formatRichText(value);
      window.requestAnimationFrame(() => highlightCodeBlocks(input));
    }
    else if (form.content) form.content.value = value || "";
  }

  function contentEntryValue(form) {
    const input = $("[data-content-text]", form);
    return input ? sanitizeRichHtml(input.innerHTML) : (form.text?.value || "");
  }

  function renderPostContent(parts) {
    return (parts || []).filter(Boolean).map((part) => `<div class="post-content-part">${formatRichText(part).replace(/\n/g, "<br>")}</div>`).join("");
  }

  function articleContentWithOutline(parts) {
    const holder = document.createElement("div");
    holder.innerHTML = renderPostContent(parts);
    const outline = [];
    $all("h1, h2, h3, h4, h5", holder).forEach((heading, index) => {
      const text = (heading.textContent || "").trim();
      if (!text) return;
      const id = `article-outline-${index + 1}`;
      heading.id = id;
      outline.push({ id, text, level: Number(heading.tagName.slice(1)) });
    });
    return { html: holder.innerHTML, outline };
  }

  function formatExcerpt(paragraphs) {
    const items = (paragraphs || []).filter(Boolean).slice(0, 2);
    if (!items.length) return "<p>点击查看文章详情。</p>";
    // 首页摘要：剥离 HTML 标签，纯文本截断，避免列表/代码块撑开卡片
    const plain = items.map((item) => String(item).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
    const truncated = plain.length > 180 ? plain.slice(0, 180) + "…" : plain;
    return `<p>${escapeHtml(truncated)}</p>`;
  }

  function sortTimelineByDate(items) {
    return [...items].sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`));
  }

  function setSavingMessage(message) {
    const target = $("[data-saving-message]");
    if (target) target.textContent = message;
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  }

  async function compressImageForUpload(file, options = {}) {
    if (!file?.type?.startsWith("image/") || file.type === "image/gif") return file;
    setSavingMessage("正在压缩图片中…");
    const maxSide = options.maxSide || 1600;
    const targetBytes = options.targetBytes || 400 * 1024;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      let width = bitmap.width;
      let height = bitmap.height;
      const initialScale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.max(1, Math.round(width * initialScale));
      height = Math.max(1, Math.round(height * initialScale));
      let blob = null;
      for (let pass = 0; pass < 5; pass += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        for (const quality of [.82, .72, .62, .52, .44]) {
          blob = await canvasToBlob(canvas, quality);
          if (blob && blob.size <= targetBytes) break;
        }
        if (blob && blob.size <= targetBytes) break;
        width = Math.max(480, Math.round(width * .8));
        height = Math.max(480, Math.round(height * .8));
      }
      if (!blob || blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      return new File([blob], `${baseName}.webp`, { type: "image/webp" });
    } catch (error) {
      console.warn("Image compression skipped:", error.message);
      return file;
    } finally {
      bitmap?.close();
    }
  }

  async function uploadOptimizedImage(userId, folder, file, options) {
    const optimized = await compressImageForUpload(file, options);
    setSavingMessage("正在上传图片…");
    return window.XiaoLuoSupabase.uploadFile(userId, folder, optimized);
  }

  async function uploadOptimizedImages(userId, folder, files, options) {
    const urls = [];
    for (const file of files) urls.push(await uploadOptimizedImage(userId, folder, file, options));
    return urls;
  }

  function commentThreadHtml(comments, deleteAttribute) {
    const byParent = new Map();
    comments.forEach((comment) => {
      const key = comment.parent_id || "root";
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(comment);
    });
    const draw = (parentId = "root", depth = 0) => (byParent.get(parentId) || []).map((comment) => {
      const name = comment.profile?.display_name || "普通用户";
      const avatar = comment.profile?.avatar_url || "";
      const replies = byParent.get(comment.id) || [];
      const replyBlock = replies.length ? `<button class="comment-toggle-replies" type="button" data-toggle-comment-replies aria-expanded="false">查看 ${replies.length} 条回复</button><div class="comment-replies" data-comment-replies hidden>${draw(comment.id, depth + 1)}</div>` : "";
      return `<article class="comment-item${depth ? " comment-reply" : ""}"><button class="comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${escapeHtml(comment.user_id)}" aria-label="查看${escapeHtml(name)}的资料"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${escapeHtml(name.slice(0, 1) || "普")}</button><div class="comment-content"><div><strong>${escapeHtml(name)}</strong><time>${formatPostDate(comment.created_at)}</time></div><p>${escapeHtml(comment.content)}</p><button class="comment-reply-button" type="button" data-reply-comment="${comment.id}" data-reply-name="${escapeHtml(name)}">回复</button>${replyBlock}</div>${state.isAdmin ? `<button class="comment-delete" type="button" ${deleteAttribute}="${comment.id}">删除</button>` : ""}</article>`;
    }).join("");
    return draw() || '<p class="comment-empty">还没有评论。</p>';
  }

  function bindReplyButtons(scope, form, setReply) {
    $all("[data-reply-comment]", scope).forEach((button) => {
      button.onclick = () => {
        setReply(button.dataset.replyComment);
        form.content.placeholder = `回复 ${button.dataset.replyName}…`;
        form.content.focus();
      };
    });
    $all("[data-toggle-comment-replies]", scope).forEach((button) => {
      button.onclick = () => {
        const replies = button.nextElementSibling;
        if (!replies) return;
        const expanded = button.getAttribute("aria-expanded") === "true";
        replies.hidden = expanded;
        button.setAttribute("aria-expanded", String(!expanded));
        const count = replies.querySelectorAll(":scope > .comment-item").length;
        button.textContent = expanded ? `查看 ${count} 条回复` : "收起回复";
      };
    });
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "00:00";
    const min = Math.floor(seconds / 60).toString().padStart(2, "0");
    const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }

  function formatPostDate(value) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value} 00:00`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatRelativeDays(value) {
    if (!value) return "暂无更新";
    const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
    if (days === 0) return "今天更新";
    return `${days} 天前更新`;
  }

  function renderSiteStats() {
    const launched = new Date(data.site.launchedAt || Date.now());
    const runningDays = Math.max(1, Math.floor((Date.now() - launched.getTime()) / 86400000) + 1);
    $all("[data-site-running-days]").forEach((el) => { el.textContent = `第 ${runningDays} 天`; });
    $all("[data-site-last-update]").forEach((el) => { el.textContent = formatRelativeDays(data.site.lastUpdatedAt); });
  }

  function readSavedSettings() {
    return {};
  }

  function readSavedContent() {
    return {};
  }

  function userStorageKey(name) {
    return state.userId ? `xiaoluo-user-${state.userId}-${name}` : "";
  }

  function migrateLegacyUserData() {
    if (!state.userId) return;
    const oldSettings = localStorage.getItem("xiaoluo-site-settings");
    const oldContent = localStorage.getItem("xiaoluo-content-data");
    const settingsKey = userStorageKey("site-settings");
    const contentKey = userStorageKey("content-data");
    if (oldSettings && !localStorage.getItem(settingsKey)) {
      try {
        const safeSettings = JSON.parse(oldSettings);
        delete safeSettings.homeBackgroundDataUrl;
        delete safeSettings.avatarDataUrl;
        localStorage.setItem(settingsKey, JSON.stringify(safeSettings));
      } catch {
        localStorage.removeItem(settingsKey);
      }
    }
    if (oldContent && !localStorage.getItem(contentKey)) localStorage.setItem(contentKey, oldContent);
    localStorage.removeItem("xiaoluo-site-settings");
    localStorage.removeItem("xiaoluo-content-data");
  }

  function clearOversizedSettings() {
    const key = userStorageKey("site-settings");
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved.homeBackgroundDataUrl && !saved.avatarDataUrl) return;
      delete saved.homeBackgroundDataUrl;
      delete saved.avatarDataUrl;
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      localStorage.removeItem(key);
    }
  }

  function saveContent() {
    // Content is persisted in Supabase; no browser cache is used.
  }

  function applySavedContent() {
    // Content is loaded from Supabase after the auth session is available.
  }

  function resetPublicView() {
    Object.keys(data).forEach((key) => delete data[key]);
    Object.assign(data, JSON.parse(JSON.stringify(defaultData)));
    data.posts = [];
    data.categories = [];
    data.tags = [];
    data.albums = [];
    data.moments = [];
    data.progress = [];
    state.cloudOwnerId = null;
  }

  function applySavedSettings() {
    const saved = readSavedSettings();
    if (saved.heroTitle) data.site.heroTitle = saved.heroTitle;
    if (saved.profileBio) data.site.profileBio = saved.profileBio;
    if (saved.profileName) data.site.profileName = saved.profileName;
    if (saved.avatarText) data.site.avatarText = saved.avatarText;
    if (saved.avatarDataUrl) data.site.avatarDataUrl = saved.avatarDataUrl;
    if (saved.contacts) data.site.contacts = { ...data.site.contacts, ...saved.contacts };
    if (saved.homeBackgroundDataUrl) data.site.homeBackground.imageUrl = saved.homeBackgroundDataUrl;
  }

  function initBrand() {
    applySavedSettings();
    const favicon = document.querySelector("link[rel='icon']") || document.head.appendChild(document.createElement("link"));
    favicon.rel = "icon";
    favicon.href = "./assets/images/xiaoluo-blog-icon.jpg";
    $all("[data-site-name]").forEach((el) => { el.textContent = data.site.name; });
    $all("[data-site-logo]").forEach((el) => { el.textContent = ""; el.style.backgroundImage = "url('./assets/images/xiaoluo-blog-icon.jpg')"; });
    $all("[data-profile-avatar]").forEach((el) => {
      const fallback = el.classList.contains("avatar") ? (data.site.logoText || "罗") : (data.site.avatarText || data.site.logoText || "罗");
      el.textContent = fallback;
      const avatarUrl = data.site.avatarDataUrl || "";
      el.classList.toggle("has-avatar-image", Boolean(avatarUrl));
      el.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
      if (avatarUrl && !el.dataset.avatarChecked) {
        el.dataset.avatarChecked = "true";
        const image = new Image();
        image.onerror = () => {
          el.classList.remove("has-avatar-image");
          el.style.backgroundImage = "url('./assets/images/xiaoluo-blog-icon.jpg')";
          el.textContent = fallback;
        };
        image.src = avatarUrl;
      } else if (el.classList.contains("avatar")) {
        el.classList.add("has-avatar-image");
        el.style.backgroundImage = "url('./assets/images/xiaoluo-blog-icon.jpg')";
      }
      if (el.classList.contains("avatar") && state.adminId) {
        el.dataset.profileUserId = state.adminId;
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", "查看作者资料");
      }
    });
    $all("[data-profile-name]").forEach((el) => { el.textContent = data.site.profileName; });
    $all("[data-profile-bio]").forEach((el) => { el.textContent = data.site.profileBio; });
    $all("[data-about-title]").forEach((el) => { el.textContent = data.site.aboutTitle; });
    $all("[data-about-bio]").forEach((el) => { el.textContent = data.site.aboutBio; });
    $all("[data-about-side-bio]").forEach((el) => { el.textContent = data.site.aboutSideBio; });
    $all("[data-hero-title]").forEach((el) => { el.textContent = data.site.heroTitle; });
    $all("[data-hero-subtitle]").forEach((el) => { el.textContent = data.site.heroSubtitle; });

    const hero = $("[data-hero-cover]");
    if (hero) {
      if (data.site.homeBackground.imageUrl) {
        hero.style.backgroundImage = `linear-gradient(90deg, rgba(15, 27, 51, 0.62), rgba(15, 27, 51, 0.12) 56%, rgba(25, 40, 65, 0.28)), url("${data.site.homeBackground.imageUrl}")`;
        hero.classList.add("has-home-cover");
      } else {
        hero.style.backgroundImage = "";
        hero.classList.remove("has-home-cover");
      }
    }

    const form = $("[data-site-settings-form]");
    if (form) {
      if (form.heroTitle) form.heroTitle.value = data.site.heroTitle;
      if (form.profileBio) form.profileBio.value = data.site.profileBio;
      if (form.announcement) form.announcement.value = data.site.announcement || "";
      if (form.entryLoaderEnabled) form.entryLoaderEnabled.checked = data.site.contacts?.entry_loader_enabled !== false;
      if (form.profileName) form.profileName.value = data.site.profileName;
      const homeCoverPreview = $("[data-home-cover-preview]", form);
      if (homeCoverPreview) {
        homeCoverPreview.hidden = !data.site.homeBackground.imageUrl;
        homeCoverPreview.src = data.site.homeBackground.imageUrl || "";
      }
      if (form.contactEmail) form.contactEmail.value = data.site.contacts.email || "";
      if (form.contactGithub) form.contactGithub.value = data.site.contacts.github || "";
      if (form.contactDouyin) form.contactDouyin.value = data.site.contacts.douyin || "";
      if (form.contactInstagram) form.contactInstagram.value = data.site.contacts.instagram || "";
    }
    const aboutForm = $("[data-about-settings-form]");
    if (aboutForm) { aboutForm.aboutTitle.value = data.site.aboutTitle; aboutForm.aboutBio.value = data.site.aboutBio; aboutForm.aboutSideBio.value = data.site.aboutSideBio; }

    $all("[data-contact-item]").forEach((item) => {
      const type = item.dataset.contactItem;
      const value = data.site.contacts[type] || "";
      const control = $("[data-contact-link]", item);
      const icon = $(".contact-icon", item);
      const tooltip = $("[data-contact-value]", item);
      if (tooltip) tooltip.textContent = value || "暂未填写";
      item.classList.toggle("has-contact", Boolean(value));
      if (icon && ["github", "douyin", "instagram"].includes(type)) icon.innerHTML = contactIconMarkup(type);
      if (!control) return;
    });
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  function initContactCopy() {
    if (document.body.dataset.contactCopyBound) return;
    document.body.dataset.contactCopyBound = "true";
    document.addEventListener("click", async (event) => {
      const control = event.target.closest("[data-contact-link]");
      if (!control) return;
      const item = control.closest("[data-contact-item]");
      const value = data.site.contacts[item?.dataset.contactItem] || "";
      if (!value) return;
      try {
        await copyText(value);
        const tooltip = $("[data-contact-value]", item);
        if (tooltip) tooltip.textContent = "已复制";
        window.setTimeout(() => { if (tooltip) tooltip.textContent = value; }, 1200);
      } catch {
        alert("复制失败，请手动复制。");
      }
    });
  }

  function profileTagsHtml(tags) {
    return (tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  }

  function showWhisperLoginModal() {
    if (state.isLoggedIn) return false;
    let modal = $("[data-whisper-login-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal whisper-login-modal";
      modal.dataset.whisperLoginModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-whisper-login-close aria-label="关闭提示"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="whisper-login-title"><button class="modal-close" type="button" data-whisper-login-close aria-label="关闭">×</button><p class="mini-title">XIAOLUO WHISPERS</p><h2 id="whisper-login-title">登录后参与碎碎念</h2><p>登录后可以发表碎碎念、查看完整内容，和大家一起吃瓜。</p><div class="publish-confirm-actions"><button class="ghost-button" type="button" data-whisper-login-close>暂不登录</button><a class="primary-button" href="./login.html">去登录</a></div></section>`;
      document.body.appendChild(modal);
    }
    $all("[data-whisper-login-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
    return true;
  }

  async function openProfileDetail(userId) {
    if (!userId || !window.XiaoLuoSupabase?.getPublicProfile) return;
    let modal = $("[data-profile-detail-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal profile-detail-modal";
      modal.dataset.profileDetailModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-profile-detail-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="profile-detail-name"><button class="modal-close" type="button" data-profile-detail-close aria-label="关闭">×</button><div data-profile-detail-content><p class="empty-state">正在读取个人资料…</p></div></section>`;
      document.body.appendChild(modal);
      $all("[data-profile-detail-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    }
    const content = $("[data-profile-detail-content]", modal);
    content.innerHTML = '<p class="empty-state">正在读取个人资料…</p>';
    modal.classList.add("open");
    try {
      const profile = await window.XiaoLuoSupabase.getPublicProfile(userId);
      if (!profile) throw new Error("没有找到这位用户的资料。");
      let activity = null;
      try { activity = await window.XiaoLuoSupabase.getUserActivitySummary?.(profile.id); } catch (_) {}
      const name = profile.display_name || (profile.is_admin ? "小罗" : "普通用户");
      const avatar = profile.avatar_url || (profile.is_admin ? "./assets/images/xiaoluo-blog-icon.jpg" : "");
      const tags = profile.is_admin ? ADMIN_PROFILE_TAGS : (Array.isArray(profile.personal_tags) ? profile.personal_tags.slice(0, 4) : []);
      const isOwnEditableProfile = state.userId === profile.id;
      let whisperSummary = null;
      if (window.XiaoLuoSupabase.getPublicWhisperSummary) {
        try { whisperSummary = await window.XiaoLuoSupabase.getPublicWhisperSummary(profile.id); } catch (_) {}
      }
      // Logged-in visitors can still see their summary while the public RPC is being deployed.
      if (!whisperSummary && state.isLoggedIn && window.XiaoLuoSupabase.listWhispers) {
        try {
          const previews = await window.XiaoLuoSupabase.listWhispers(profile.id, 1);
          const count = window.XiaoLuoSupabase.getWhisperCount
            ? await window.XiaoLuoSupabase.getWhisperCount(profile.id)
            : previews.length;
          whisperSummary = { count, previews };
        } catch (_) {}
      }
      const whisperPreviews = (whisperSummary?.previews || []).slice(0, 1).map((item) => `<article><p class="whisper-rich-text">${renderWhisperContent(item.content || "")}</p><time>${formatPostDate(item.created_at)}</time></article>`).join("");
      const whisperSection = whisperSummary ? `<section class="profile-whisper-summary"><div class="profile-whisper-summary-heading"><strong>碎碎念</strong><span>共 ${whisperSummary.count} 条</span></div>${whisperPreviews ? `<div class="profile-whisper-previews">${whisperPreviews}</div>` : '<p class="profile-whisper-empty">还没有发布碎碎念。</p>'}<button class="profile-whisper-count" type="button" data-user-whispers="${profile.id}"><strong>${state.isLoggedIn ? "查看全部" : "登录后吃瓜"}</strong><span>${state.isLoggedIn ? "进入完整碎碎念" : "登录后才能查看详情与参与发布"}</span></button></section>` : "";
      content.innerHTML = `<div class="profile-detail-hero"><span class="profile-detail-avatar${avatar ? " has-image" : ""}"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${escapeHtml(name.slice(0, 1))}</span><div><p class="mini-title">${profile.is_admin ? "AUTHOR PROFILE" : "USER PROFILE"}</p><h2 id="profile-detail-name">${escapeHtml(name)}</h2>${activity ? `<span class="profile-activity-title">${escapeHtml(activity.title)} · ${activity.score} 活跃度</span>` : ""}${profile.mbti ? `<strong class="profile-mbti">${escapeHtml(profile.mbti)}</strong>` : ""}</div></div>${tags.length ? `<div class="profile-detail-tags">${profileTagsHtml(tags)}</div>` : ""}<dl class="profile-detail-fields">${profile.gender ? `<div><dt>性别</dt><dd>${escapeHtml(profile.gender)}</dd></div>` : ""}${profile.personal_bio ? `<div class="profile-detail-bio"><dt>个人介绍</dt><dd>${escapeHtml(profile.personal_bio)}</dd></div>` : ""}</dl>${whisperSection}${isOwnEditableProfile ? '<button class="primary-button small" type="button" data-user-profile-button>编辑我的资料</button>' : ""}`;
    } catch (error) {
      content.innerHTML = `<p class="empty-state">${escapeHtml(error.message || "暂时无法读取资料。")}</p>`;
    }
  }

  function initProfileDetails() {
    if (document.body.dataset.profileDetailsBound) return;
    document.body.dataset.profileDetailsBound = "true";
    document.addEventListener("click", (event) => {
      const whisperLink = event.target.closest("[data-user-whispers]");
      if (whisperLink) {
        event.preventDefault();
        if (!state.isLoggedIn) { showWhisperLoginModal(); return; }
        window.location.href = `./whispers.html?user=${encodeURIComponent(whisperLink.dataset.userWhispers)}`;
        return;
      }
      const trigger = event.target.closest("[data-profile-user-id]");
      if (!trigger) return;
      event.preventDefault();
      event.stopPropagation();
      openProfileDetail(trigger.dataset.profileUserId);
    });
    document.addEventListener("keydown", (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const trigger = event.target.closest?.("[data-profile-user-id]");
      if (!trigger) return;
      event.preventDefault();
      openProfileDetail(trigger.dataset.profileUserId);
    });
  }

  function initUserProfileSettings() {
    if (document.body.dataset.userProfileBound) return;
    document.body.dataset.userProfileBound = "true";
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-user-profile-button]");
      if (!trigger || !state.isLoggedIn) return;
      $("[data-profile-detail-modal]")?.classList.remove("open");
      let modal = $("[data-user-profile-modal]");
      if (!modal) {
        modal = document.createElement("div");
        modal.className = "modal user-profile-modal";
        modal.dataset.userProfileModal = "";
      modal.innerHTML = `<div class="modal-backdrop" data-user-profile-close></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="个人资料"><button class="modal-close" type="button" data-user-profile-close aria-label="关闭">×</button><p class="mini-title">PROFILE SETTINGS</p><h2>个人资料</h2><form data-user-profile-form><div class="profile-avatar-upload"><span class="profile-avatar-preview" data-profile-avatar-preview>普</span><label class="avatar-upload-button">上传头像<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"></label><small>JPG、PNG 或 WebP，最大 2MB</small></div><div class="profile-form-grid"><label><span>昵称</span><input name="displayName" type="text" maxlength="24" required></label><label><span>性别（选填）</span><select name="gender"><option value="">不显示</option><option value="男">男</option><option value="女">女</option><option value="保密">保密</option></select></label><label><span>MBTI 人格（选填）</span><select name="mbti"><option value="">不显示</option>${MBTI_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}</select></label></div><label><span>个人介绍（选填）</span><textarea name="personalBio" rows="3" maxlength="300" placeholder="介绍一下自己，不填写则不显示"></textarea></label><fieldset class="profile-tag-picker"><legend>个人标签（最多选择 4 个）</legend><div>${PROFILE_TAGS.map((tag) => `<label><input name="personalTags" type="checkbox" value="${tag}"><span>${tag}</span></label>`).join("")}</div><small>已选择 <strong data-profile-tag-count>0</strong> / 4</small></fieldset><button class="primary-button small" type="submit">保存资料</button></form><section class="profile-security"><h3>修改密码</h3><form data-password-form><label><span>当前密码</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label><span>新密码</span><input name="newPassword" type="password" autocomplete="new-password" minlength="6" required></label><button class="primary-button small" type="submit">更新密码</button></form></section><section class="profile-signout"><button class="ghost-button" type="button" data-profile-signout>退出登录</button></section><section class="profile-danger"><h3>注销账户</h3><p>注销会永久删除你的个人资料、头像、点赞和评论，无法恢复。</p><form data-delete-account-form><label><span>输入当前密码确认</span><input name="password" type="password" autocomplete="current-password" required></label><button class="danger-button" type="submit">永久注销</button></form></section></section>`;
        document.body.appendChild(modal);
      }
      const form = $("[data-user-profile-form]", modal);
      form.displayName.value = state.currentProfile?.display_name || "普通用户";
      form.gender.value = state.currentProfile?.gender || "";
      form.mbti.value = state.currentProfile?.mbti || "";
      form.personalBio.value = state.currentProfile?.personal_bio || "";
      const selectedTags = Array.isArray(state.currentProfile?.personal_tags) ? state.currentProfile.personal_tags.slice(0, 4) : [];
      $all('input[name="personalTags"]', form).forEach((checkbox) => { checkbox.checked = selectedTags.includes(checkbox.value); });
      const tagPicker = $(".profile-tag-picker", form);
      if (tagPicker) tagPicker.hidden = state.isAdmin;
      const updateTagCount = () => { $("[data-profile-tag-count]", form).textContent = $all('input[name="personalTags"]:checked', form).length; };
      $all('input[name="personalTags"]', form).forEach((checkbox) => { checkbox.onchange = () => { const checked = $all('input[name="personalTags"]:checked', form); if (checked.length > 4) { checkbox.checked = false; alert("个人标签最多选择 4 个。"); } updateTagCount(); }; });
      updateTagCount();
      const avatarPreview = $("[data-profile-avatar-preview]", modal);
      const refreshPreview = (url) => { avatarPreview.textContent = (form.displayName.value || "普").slice(0, 1); avatarPreview.style.backgroundImage = url ? `url('${url}')` : ""; avatarPreview.classList.toggle("has-image", Boolean(url)); };
      refreshPreview(state.currentProfile?.avatar_url || "");
      modal.classList.add("open");
      $all("[data-user-profile-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
      form.onsubmit = async (submitEvent) => {
        submitEvent.preventDefault();
        const name = form.displayName.value.trim();
        if (!name) return;
        const submit = $("button[type='submit']", form);
        submit.disabled = true;
        submit.textContent = "保存中…";
        try {
          const file = form.avatar.files?.[0];
          if (file && file.size > 2 * 1024 * 1024) throw new Error("头像文件不能超过 2MB。");
          const avatarUrl = file ? await runWithLoading("正在压缩图片中…", () => uploadOptimizedImage(state.userId, "avatars", file, { maxSide: 720, targetBytes: 220 * 1024 })) : (state.currentProfile?.avatar_url || "");
          const ownTags = state.isAdmin ? (state.currentProfile?.personal_tags || []) : $all('input[name="personalTags"]:checked', form).map((checkbox) => checkbox.value);
          state.currentProfile = await window.XiaoLuoSupabase.updateOwnIdentity(state.userId, { display_name: name, avatar_url: avatarUrl, gender: form.gender.value, personal_tags: ownTags, personal_bio: form.personalBio.value.trim(), mbti: form.mbti.value });
          modal.classList.remove("open");
          await refreshAuthState();
          renderCurrentPage();
        } catch (error) { showCloudError(error); }
        finally { submit.disabled = false; submit.textContent = "保存资料"; }
      };
      form.avatar.onchange = () => { const file = form.avatar.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { form.avatar.value = ""; alert("头像文件不能超过 2MB。"); return; } const reader = new FileReader(); reader.onload = () => refreshPreview(reader.result); reader.readAsDataURL(file); };
      $("[data-password-form]", modal).onsubmit = async (submitEvent) => { submitEvent.preventDefault(); const passwordForm = submitEvent.currentTarget; const button = $("button", passwordForm); try { button.disabled = true; await runWithLoading("正在更新密码…", async () => { const session = await window.XiaoLuoSupabase.getSession(); await window.XiaoLuoSupabase.verifyPassword(session.user.email, passwordForm.currentPassword.value); await window.XiaoLuoSupabase.updatePassword(passwordForm.newPassword.value); }); passwordForm.reset(); alert("密码已更新，请使用新密码登录。"); } catch (error) { showCloudError(error); } finally { button.disabled = false; } };
      $("[data-profile-signout]", modal).onclick = async () => { await window.XiaoLuoSupabase.signOut(); window.location.href = "./index.html"; };
      $("[data-delete-account-form]", modal).onsubmit = async (submitEvent) => { submitEvent.preventDefault(); const deleteForm = submitEvent.currentTarget; const password = deleteForm.password.value; if (!password) return; if (!await confirmPublish("确认永久注销账户？", "此操作无法撤销。", "永久注销")) return; const button = $("button", deleteForm); try { button.disabled = true; await runWithLoading("正在永久注销账户，请稍候…", async () => { const session = await window.XiaoLuoSupabase.getSession(); await window.XiaoLuoSupabase.verifyPassword(session?.user?.email, password); await window.XiaoLuoSupabase.requestAccountDeletion(password); }); try { await window.XiaoLuoSupabase.signOut(); } catch (_) {} modal.classList.remove("open"); showAccountDeletedNotice(); } catch (error) { showCloudError(error); } finally { button.disabled = false; } };
    });
  }

  function showAccountDeletedNotice() {
    let modal = $("[data-account-deleted-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal account-deleted-modal";
      modal.dataset.accountDeletedModal = "";
      modal.innerHTML = `<div class="modal-backdrop"></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="account-deleted-title"><p class="mini-title">ACCOUNT DELETED</p><h2 id="account-deleted-title">账户已永久注销</h2><p>你的个人资料和相关数据已删除。</p><div class="publish-confirm-actions"><button class="primary-button" type="button" data-return-home-after-delete>返回首页</button></div></section>`;
      document.body.appendChild(modal);
    }
    $("[data-return-home-after-delete]", modal).onclick = () => { window.location.href = "./index.html"; };
    modal.classList.add("open");
  }

  function initDashboardSectionSpy() {
    const sidebar = $(".admin-sidebar");
    if (!sidebar || sidebar.dataset.spyBound) return;
    sidebar.dataset.spyBound = "true";
    const links = $all('a[href^="#"]', sidebar);
    const sections = links.map((link) => $(link.getAttribute("href"))).filter(Boolean);
    if (!sections.length) return;
    const headerOffset = () => ($(".site-header")?.getBoundingClientRect().height || 70) + 20;
    links.forEach((link) => {
      link.addEventListener("click", (event) => {
        const section = $(link.getAttribute("href"));
        if (!section) return;
        event.preventDefault();
        window.scrollTo({ top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - headerOffset()), behavior: "smooth" });
        history.replaceState(null, "", link.getAttribute("href"));
        links.forEach((item) => item.classList.toggle("active", item === link));
      });
    });
    const update = () => {
      const point = headerOffset();
      let active = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= point) active = section;
      });
      links.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${active.id}`));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  async function refreshAuthState() {
    const session = await window.XiaoLuoSupabase?.getSession?.();
    state.isLoggedIn = Boolean(session);
    state.userId = session?.user?.id || null;
    state.isAdmin = false;
    state.currentProfile = null;
    state.activityScore = state.isLoggedIn ? 10 : 0;
    state.activityTitle = "初入人";
    state.activityCheckedToday = false;
    if (state.userId && window.XiaoLuoSupabase?.isConfigured) {
      try {
        const profile = await window.XiaoLuoSupabase.getProfile(state.userId);
        state.currentProfile = profile || null;
        state.isAdmin = Boolean(profile?.is_admin);
      } catch (error) {
        console.warn("Admin role check failed:", error.message);
      }
      try {
        const activity = await window.XiaoLuoSupabase.getActivityStatus?.();
        if (activity) {
          state.activityScore = activity.score;
          state.activityTitle = activity.title;
          state.activityCheckedToday = activity.checkedToday;
          state.activityNextScore = activity.nextScore;
          state.activityNextTitle = activity.nextTitle;
        }
      } catch (error) {
        console.warn("Activity status load failed; run supabase/activity-system.sql:", error.message);
      }
    }
    migrateLegacyUserData();
    clearOversizedSettings();
    // Auth refreshes are frequent (token renewal, likes, comments and profile
    // updates). They must never clear the already loaded blog content.
    state.sessionLoaded = true;
    applyAuthUI();
    return session;
  }

  // 只根据内存中已有的 state 更新登录相关 UI，不发网络请求，不重置数据
  function applyAuthUI() {
    document.body.classList.toggle("is-logged-in", state.isLoggedIn);
    $all("[data-auth-only]").forEach((el) => { el.hidden = !state.isLoggedIn; });
    $all("[data-guest-only]").forEach((el) => { el.hidden = state.isLoggedIn; });
    $all(".user-entry").forEach((el) => {
      el.hidden = true;
    });
    $all(".header-actions").forEach((actions) => {
      let status = $("[data-account-status]", actions);
      const statusTag = "BUTTON";
      if (!status) {
        status = document.createElement(statusTag.toLowerCase());
        status.dataset.accountStatus = "";
        actions.appendChild(status);
      }
      if (status.tagName !== statusTag) {
        const replacement = document.createElement(statusTag.toLowerCase());
        replacement.dataset.accountStatus = "";
        status.replaceWith(replacement);
        status = replacement;
      }
      status.className = `account-status${state.isAdmin ? " is-author" : ""}`;
      status.hidden = !state.isLoggedIn;
      status.type = "button";
      status.dataset.profileUserId = state.userId || "";
      delete status.dataset.userProfileButton;
      status.removeAttribute("href");
      if (state.isAdmin) {
        status.setAttribute("aria-label", "作者已登录，查看作者资料");
        status.innerHTML = '<img src="./font_fuhbx0kh6gc/作者.svg" alt="" aria-hidden="true"><span>作者</span><em class="login-state">已登录</em>';
      } else {
        const name = state.currentProfile?.display_name || "普通用户";
        const avatar = state.currentProfile?.avatar_url || "";
        const initial = escapeHtml(name.slice(0, 1) || "普");
        status.innerHTML = `<span class="account-avatar${avatar ? " has-image" : ""}"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${initial}</span><span>${escapeHtml(name)}</span><em class="login-state">已登录</em>`;
        status.setAttribute("aria-label", "查看我的个人资料");
        status.setAttribute("title", "查看我的个人资料");
      }
      let checkin = $("[data-activity-checkin]", actions);
      if (!checkin) {
        checkin = document.createElement("button");
        checkin.type = "button";
        checkin.className = "activity-checkin-button";
        checkin.dataset.activityCheckin = "";
        actions.appendChild(checkin);
      }
      checkin.hidden = !state.isLoggedIn;
      checkin.disabled = state.activityCheckedToday;
      checkin.innerHTML = state.activityCheckedToday
        ? `<i aria-hidden="true"></i><span>今日已签</span><em>${state.activityScore}</em>`
        : `<i aria-hidden="true"></i><span>每日签到</span><em>+20</em>`;
      checkin.onclick = async () => {
        if (state.activityCheckedToday) return;
        checkin.disabled = true;
        checkin.classList.add("is-loading");
        checkin.querySelector("span").textContent = "签到中…";
        try {
          const activity = await window.XiaoLuoSupabase.dailyActivityCheckIn();
          state.activityScore = activity.score;
          state.activityTitle = activity.title;
          state.activityCheckedToday = true;
          checkin.innerHTML = `<i aria-hidden="true"></i><span>今日已签</span><em>${state.activityScore}</em>`;
          showActivityNotice("签到成功", `活跃度 +20，目前为 ${state.activityScore}，称号「${state.activityTitle}」。`);
          if (pageName() === "activity") { renderActivityLeaderboard(); renderActivityHeatmap(); }
        } catch (error) {
          checkin.disabled = false;
          showCloudError(error);
        } finally { checkin.classList.remove("is-loading"); }
      };
      let logout = $("[data-header-logout]", actions);
      if (!logout) {
        logout = document.createElement("button");
        logout.type = "button";
        logout.dataset.headerLogout = "";
        logout.dataset.placeholderAction = "logout";
        logout.className = "header-logout";
        logout.setAttribute("aria-label", "退出登录");
        logout.setAttribute("title", "退出登录");
        logout.innerHTML = '<span class="logout-icon" aria-hidden="true"></span>';
        actions.appendChild(logout);
      }
      logout.hidden = !state.isLoggedIn;
    });
    $all("[data-admin-only], .top-nav a[href='./dashboard.html']").forEach((el) => { el.hidden = !state.isAdmin; });
    $all("[data-music-manage]").forEach((el) => { el.hidden = !state.isAdmin; });
    $all("[data-dashboard-status-title]").forEach((el) => {
      el.textContent = state.isAdmin ? "管理员已登录，管理博客内容" : "小罗的个人博客";
    });
    $all("[data-dashboard-status-text]").forEach((el) => {
      el.textContent = state.isAdmin ? "现在可以进入后台管理文章、动态和资料。" : "点赞无需登录，登录后可参与评论。";
    });
  }

  async function loadCloudData() {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    const loadMutationVersion = state.cloudMutationVersion;
    try {
      const adminProfile = await api.getAdminProfile();
      if (!adminProfile) return;
      state.adminId = adminProfile.id;
      const ownerId = adminProfile.id;
      const [categories, tags, moments, progress, projects, mediaItems, mediaTypes, mediaReviews, notes, commonSites, posts, musicTracks, lockedMomentTeasers] = await Promise.all([
        api.listTaxonomy("categories", ownerId),
        api.listTaxonomy("tags", ownerId),
        api.listContent("moments", ownerId),
        api.listContent("progress_logs", ownerId),
        api.listContent("projects", ownerId).catch(() => []),
        api.listContent("media_items", ownerId).catch(() => []),
        api.listContent("media_types", ownerId).catch(() => []),
        api.listContent("media_reviews", ownerId).catch(() => []),
        state.isAdmin ? api.listContent("notes", state.userId).catch(() => []) : Promise.resolve([]),
        state.isLoggedIn ? api.listContent("common_sites", ownerId).catch(() => []) : Promise.resolve([]),
        state.isAdmin ? api.listPosts(ownerId) : api.listPublishedPosts(ownerId),
        api.listMusicTracks(ownerId),
        api.listMomentTeasers ? api.listMomentTeasers(ownerId).catch(() => []) : Promise.resolve([])
      ]);
      if (loadMutationVersion !== state.cloudMutationVersion) return;
      data.site.profileName = adminProfile.display_name || data.site.profileName;
      data.site.avatarText = (adminProfile.display_name || data.site.profileName).slice(0, 1);
      data.site.avatarDataUrl = adminProfile.avatar_url || "";
      data.site.heroTitle = adminProfile.home_title || data.site.heroTitle;
      data.site.profileBio = adminProfile.home_bio || data.site.profileBio;
      data.site.homeBackground.imageUrl = adminProfile.home_background_url || "";
      data.site.aboutTitle = adminProfile.about_title || data.site.aboutTitle;
      data.site.aboutBio = adminProfile.about_bio || data.site.aboutBio;
      data.site.aboutSideBio = adminProfile.about_side_bio || data.site.aboutSideBio;
      data.site.announcement = adminProfile.announcement || "";
      data.site.contacts = { ...data.site.contacts, ...(adminProfile.contacts || {}) };
      data.site.launchedAt = adminProfile.created_at || data.site.launchedAt;
      const updateDates = [adminProfile.updated_at, ...posts.map((item) => item.updated_at || item.created_at), ...moments.map((item) => item.updated_at || item.created_at), ...progress.map((item) => item.updated_at || item.created_at), ...projects.map((item) => item.updated_at || item.created_at), ...mediaItems.map((item) => item.updated_at || item.created_at), ...musicTracks.map((item) => item.updated_at || item.created_at)].filter(Boolean);
      data.site.lastUpdatedAt = updateDates.sort((a, b) => new Date(b) - new Date(a))[0] || "";
      data.categories = categories.map((item) => ({ id: item.id, name: item.name, description: "" }));
      data.tags = tags.map((item) => ({ id: item.id, name: item.name }));
      const visibleMoments = moments.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [], isPublic: Boolean(item.is_public) }));
      const lockedMoments = lockedMomentTeasers.filter((item) => !visibleMoments.some((moment) => moment.id === item.id)).map((item) => ({ id: item.id, title: "生活圈内容已锁定", date: item.entry_date, text: "登录后活跃值达到50可以解锁内容", images: [], isLocked: true, isPublic: false }));
      data.moments = sortTimelineByDate([...visibleMoments, ...lockedMoments]);
      data.progress = sortTimelineByDate(progress.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [] })));
      data.projects = projects.map((item) => ({ id: item.id, title: item.title, description: item.description || "", coverUrl: item.cover_url || "", projectUrl: item.project_url || "", attachments: item.attachments || [], createdAt: item.created_at || "" }));
      data.mediaReviews = mediaReviews.map((item) => ({ id: item.id, mediaItemId: item.media_item_id, title: item.review_title || "观后感", review: item.review || "", isPublic: item.is_public !== false }));
      const reviewsByItem = new Map(data.mediaReviews.map((item) => [item.mediaItemId, item]));
      data.mediaItems = mediaItems.map((item) => { const review = reviewsByItem.get(item.id); return { id: item.id, title: item.title, reviewTitle: review?.title || "观后感", review: review?.review || "", reviewPublic: item.review_is_public !== false, noteUrl: item.note_url || "", coverUrl: item.cover_url || "", rating: Number(item.rating) || 0, mediaType: item.media_type || "未分类", tags: Array.isArray(item.tags) ? item.tags : [], people: item.people || "", watchedYear: Number(item.watched_year) || 0, watchedMonth: Number(item.watched_month) || 0, watchedDay: Number(item.watched_day) || 0, createdAt: item.created_at || "" }; });
      state.mediaDataLoaded = true;
      state.mediaLastRefreshedAt = Date.now();
      data.mediaTypes = mediaTypes.map((item) => ({ id: item.id, name: item.name, isHidden: Boolean(item.is_hidden) }));
      data.notes = notes.map((item) => ({ id: item.id, title: item.title, body: item.body || "", attachments: Array.isArray(item.attachments) ? item.attachments : [], isDone: Boolean(item.is_done), folder: item.folder || "", isPinned: Boolean(item.is_pinned), createdAt: item.created_at || "", updatedAt: item.updated_at || item.created_at || "" }));
      data.commonSites = commonSites.map((item) => ({ id: item.id, title: item.title, url: item.url, description: item.description || "", iconUrl: item.icon_url || "", createdAt: item.created_at || "" }));
      data.posts = posts.map((item) => ({ id: item.id, userId: item.user_id || ownerId, title: item.title, author: data.site.profileName, category: item.category || "未分类", tags: parseCommaTags(item.tags), attachments: item.attachments || [], musicAttachment: item.music_attachment || null, status: item.status || "published", minActivityScore: Number(item.min_activity_score) || 0, publishedAt: formatPostDate(item.created_at), coverUrl: item.cover_url || "", coverClass: "gradient-a", excerpt: (item.content || "").replace(/<[^>]+>/g, "").slice(0, 110), content: [item.content || ""], featured: false }));
      if (musicTracks.length) data.music = musicTracks.map((track) => ({ id: track.id, title: track.title, artist: track.artist || "小罗Blog", category: track.category || "", src: track.file_url }));
      state.cloudOwnerId = ownerId;
      initBrand();
      populateFilters();
      if (pageName() === "dashboard" && state.isAdmin) renderContentManagers();
      if (pageName() === "dashboard" && state.isAdmin) renderDashboardStats();
      if (pageName() === "dashboard" && state.isAdmin) renderRegisteredUsers();
      if (pageName() === "home") renderHome();
      renderSiteStats();
      document.dispatchEvent(new CustomEvent("xiaoluo-music-library-updated"));
      if (pageName() === "articles") renderArticles();
      if (pageName() === "categories") renderCategories();
      if (pageName() === "article-detail") renderDetail();
      if (pageName() === "life") renderLifeTimeline();
      if (pageName() === "progress") renderTimeline("[data-progress-timeline]", data.progress);
      if (pageName() === "projects") renderProjects();
      if (pageName() === "media-list") renderMediaList();
      if (pageName() === "about") renderAbout();
      if (pageName() === "photos") renderGallery();
      if (pageName() === "editor") prepareEditorForEdit();
    } catch (error) {
      state.mediaDataLoaded = true;
      if (pageName() === "media-list") renderMediaList();
      console.warn("Supabase content load failed:", error.message);
    }
  }

  function watchAuthState() {
    const client = window.XiaoLuoSupabase?.client;
    if (!client || state.authListenerReady) return;
    state.authListenerReady = true;
    client.auth.onAuthStateChange(() => {
      window.setTimeout(() => refreshAuthState(), 0);
    });
  }

  function initTheme() {
    const saved = localStorage.getItem("neverblog-theme");
    if (saved === "dark") document.body.classList.add("dark-mode");
    syncThemeAppearance();
  }

  function ensureFunctionNav() {
    $all(".top-nav").forEach((nav) => {
      const projectLink = $("a[href='./projects.html']", nav);
      if (!projectLink || projectLink.closest(".nav-menu-group")) return;
      const group = document.createElement("div");
      group.className = "nav-menu-group";
      group.dataset.functionMenu = "";
      group.innerHTML = '<button class="nav-menu-trigger" type="button" data-function-menu-toggle aria-expanded="false"><span>功能块</span><i class="nav-menu-chevron" aria-hidden="true"></i></button><div class="nav-submenu"><a href="./projects.html">个人项目</a><a href="./media-list.html">书籍影单</a></div>';
      projectLink.replaceWith(group);
    });
  }

  function syncThemeAppearance() {
    const isDark = document.body.classList.contains("dark-mode");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#101a2c" : "#edf4ff");
    $all("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", isDark ? "切换为日间模式" : "切换为夜间模式");
      button.setAttribute("title", isDark ? "切换为日间模式" : "切换为夜间模式");
    });
  }

  function bindThemeButtons() {
    $all("[data-theme-toggle]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem("neverblog-theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
        syncThemeAppearance();
      });
    });
  }

  function initLiveClock() {
    const draw = () => {
      const now = new Date();
      const timeZone = "Asia/Shanghai";
      $all("[data-live-clock]").forEach((el) => { el.textContent = now.toLocaleTimeString("zh-CN", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" }); });
      $all("[data-live-date]").forEach((el) => { el.textContent = now.toLocaleDateString("zh-CN", { timeZone, year: "numeric", month: "long", day: "numeric", weekday: "long" }); });
      const hourParts = new Intl.DateTimeFormat("zh-CN", { timeZone, hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
      const hour = Number(hourParts.find((part) => part.type === "hour")?.value || 0);
      const greeting = hour < 6
        ? "小伙伴，凌晨好，夜深了，记得早点休息。"
        : hour < 11
          ? "小伙伴，早上好，记得吃早餐。"
          : hour < 14
            ? "小伙伴，中午好，记得按时吃午饭。"
            : hour < 19
            ? "小伙伴，下午好，记得喝杯下午茶。"
            : "小伙伴，晚上好，忙完也要记得休息。";
      $all("[data-announcement-greeting]").forEach((el) => { el.textContent = greeting; });
    };
    draw();
    if (window.__xiaoluoClockTimer) return;
    window.__xiaoluoClockTimer = window.setInterval(draw, 1000);
  }

  function bindNavToggle() {
    const toggle = $("[data-nav-toggle]");
    const nav = $("[data-nav]");
    if (!toggle || !nav || toggle.dataset.bound) return;
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }

  function bindFunctionMenus() {
    if (document.body.dataset.functionMenusBound) return;
    document.body.dataset.functionMenusBound = "true";
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-function-menu-toggle]");
      if (trigger) {
        event.preventDefault();
        const group = trigger.closest("[data-function-menu]");
        const willOpen = !group.classList.contains("is-open");
        $all("[data-function-menu].is-open").forEach((item) => item.classList.remove("is-open"));
        group.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
        return;
      }
      if (!event.target.closest("[data-function-menu]")) {
        $all("[data-function-menu].is-open").forEach((group) => {
          group.classList.remove("is-open");
          $("[data-function-menu-toggle]", group)?.setAttribute("aria-expanded", "false");
        });
      }
      if (event.target.closest(".top-nav a")) $("[data-nav]")?.classList.remove("open");
    });
  }

  function setActiveNav() {
    const current = location.pathname.split("/").pop() || "index.html";
    $all(".top-nav a").forEach((link) => {
      const target = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
      link.classList.toggle("active", target === current);
    });
    $all("[data-function-menu]").forEach((group) => {
      const active = Boolean($(".nav-submenu a.active", group));
      group.classList.toggle("has-active", active);
      $("[data-function-menu-toggle]", group)?.classList.toggle("active", active);
    });
  }

  function postCard(post) {
    const rawContent = Array.isArray(post.content)
      ? post.content.map((block) => typeof block === "string" ? block : (block?.text || "")).join("\n")
      : String(post.content || "");
    const textHolder = document.createElement("div");
    textHolder.innerHTML = formatRichText(rawContent);
    // Count actual visible characters, not HTML tags or the shortened card excerpt.
    const wordCount = [...(textHolder.textContent || "").replace(/\s/g, "")].length;
    return `
      <article class="article-card glass-card ${post.coverUrl ? "has-cover" : "no-cover"}" data-post-id="${escapeHtml(post.id)}">
        <a class="article-card-hit" href="./article-detail.html?id=${post.id}" aria-label="阅读 ${escapeHtml(post.title)}"></a>
        ${post.coverUrl ? `<span class="article-cover ${post.coverClass}"><img src="${post.coverUrl}" alt="${escapeHtml(post.title)} 封面"></span>` : ""}
        <div class="article-body">
          <div class="article-card-header">
            <h3>${escapeHtml(post.title)}</h3>
            <div class="article-card-topline">
            <p class="mini-title">${escapeHtml(post.category)}</p>
            <div class="tag-row">
              <div class="tag-row-left">${post.minActivityScore ? `<span class="activity-read-label">${escapeHtml(activityLevelForScore(post.minActivityScore).title)}可读</span>` : ""}${post.tags.map((tag) => `<a href="./articles.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
            </div>
            </div>
          </div>
          <div class="article-excerpt">${formatExcerpt(post.content || [post.excerpt])}</div>
          ${post.attachments?.length ? `<p class="article-attachment-hint">含 ${post.attachments.length} 个附件，进入详情可下载</p>` : ""}
          <div class="article-card-footer">
            <div class="article-meta"><span class="article-card-date">${formatPostDate(post.publishedAt)}</span><span class="article-card-author">${escapeHtml(post.author)}</span></div>
            <div class="article-card-stats" data-post-card-id="${escapeHtml(post.id)}"><span data-post-card-likes>点赞 0</span><span data-post-card-views>阅读 0</span><span class="article-word-count">${wordCount}字</span></div>
          </div>
        </div>
      </article>
    `;
  }

  function populateFilters() {
    $all("[data-category-filter]").forEach((select) => {
      const selected = select.value;
      select.innerHTML = '<option value="">全部分类</option>';
      data.categories.forEach((cat) => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`));
      select.value = selected;
    });

    const tagFilter = $("[data-tag-filter]");
    if (tagFilter) {
      const selected = tagFilter.value;
      tagFilter.innerHTML = '<option value="">全部标签</option>';
      const names = [...new Set([
        ...data.tags.map((tag) => typeof tag === "string" ? tag : tag.name),
        ...data.posts.flatMap((post) => parseCommaTags(post.tags))
      ].filter(Boolean))];
      names.forEach((tag) => tagFilter.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`));
      tagFilter.value = selected;
    }

    const categoryChips = $("[data-category-chips-manager]");
    const tagChips = $("[data-tag-chips-manager]");
    if (categoryChips) categoryChips.innerHTML = data.categories.map((category) => `<span class="taxonomy-chip">${escapeHtml(category.name)}<button type="button" data-remove-category="${escapeHtml(category.id)}" aria-label="删除分类">×</button></span>`).join("");
    if (tagChips) tagChips.innerHTML = data.tags.map((tag) => `<span class="taxonomy-chip">#${escapeHtml(typeof tag === "string" ? tag : tag.name)}<button type="button" data-remove-tag="${escapeHtml(typeof tag === "string" ? tag : tag.id)}" aria-label="删除标签">×</button></span>`).join("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
    });
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function requireCloudSession() {
    if (!state.userId || !window.XiaoLuoSupabase?.isConfigured) {
      throw new Error("登录状态已失效，请刷新页面后重新登录。");
    }
  }

  function showCloudError(error) {
    const message = error?.message || "操作失败，请稍后重试。";
    alert(`操作失败：${message}`);
  }

  function confirmPublish(title, message, confirmLabel = "确认发布") {
    return new Promise((resolve) => {
      let modal = $("[data-publish-confirm-modal]");
      if (!modal) {
        document.body.insertAdjacentHTML("beforeend", `
          <div class="modal publish-confirm-modal" data-publish-confirm-modal aria-hidden="true">
            <button class="modal-backdrop" type="button" data-publish-cancel aria-label="取消发布"></button>
            <section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title">
              <button class="modal-close" type="button" data-publish-cancel aria-label="关闭">×</button>
              <p class="mini-title">CONFIRM PUBLISH</p>
              <h2 id="publish-confirm-title" data-publish-confirm-title></h2>
              <p data-publish-confirm-message></p>
              <div class="publish-confirm-actions"><button class="ghost-button" type="button" data-publish-cancel>取消</button><button class="primary-button" type="button" data-publish-confirm></button></div>
            </section>
          </div>
        `);
        modal = $("[data-publish-confirm-modal]");
      }
      $("[data-publish-confirm-title]", modal).textContent = title;
      $("[data-publish-confirm-message]", modal).textContent = message;
      $("[data-publish-confirm]", modal).textContent = confirmLabel;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      const close = (accepted) => {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        $all("[data-publish-cancel], [data-publish-confirm]", modal).forEach((button) => button.removeEventListener("click", handler));
        resolve(accepted);
      };
      const handler = (event) => close(event.currentTarget.hasAttribute("data-publish-confirm"));
      $all("[data-publish-cancel], [data-publish-confirm]", modal).forEach((button) => button.addEventListener("click", handler));
    });
  }

  function runWithLoading(message, task) {
    let cancelled = false;
    let overlay = $("[data-saving-overlay]");
    if (!overlay) {
      document.body.insertAdjacentHTML("beforeend", `<div class="saving-overlay" data-saving-overlay hidden><section class="saving-card glass-card"><span class="saving-spinner"></span><strong data-saving-message></strong><button class="ghost-button" type="button" data-saving-cancel>中止</button></section></div>`);
      overlay = $("[data-saving-overlay]");
    }
    $("[data-saving-message]", overlay).textContent = message;
    overlay.hidden = false;
    const cancel = $("[data-saving-cancel]", overlay);
    cancel.onclick = () => { cancelled = true; cancel.disabled = true; cancel.textContent = "正在中止"; };
    return task(() => cancelled).finally(() => {
      overlay.hidden = true;
      cancel.disabled = false;
      cancel.textContent = "中止";
    });
  }

  function initContentManagement() {
    const categoryForm = $("[data-category-form]");
    const tagForm = $("[data-tag-form]");
    if (categoryForm && !categoryForm.dataset.bound) {
      categoryForm.dataset.bound = "true";
      categoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          requireCloudSession();
          const name = categoryForm.category.value.trim();
          if (!name || data.categories.some((item) => item.name === name)) return;
          const item = await window.XiaoLuoSupabase.addTaxonomy("categories", state.userId, name);
          data.categories.push({ id: item.id, name: item.name, description: "" });
          categoryForm.reset();
          populateFilters();
        } catch (error) { showCloudError(error); }
      });
    }
    if (tagForm && !tagForm.dataset.bound) {
      tagForm.dataset.bound = "true";
      tagForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          requireCloudSession();
          const tag = tagForm.tag.value.trim();
          if (!tag || data.tags.some((item) => (typeof item === "string" ? item : item.name) === tag)) return;
          const item = await window.XiaoLuoSupabase.addTaxonomy("tags", state.userId, tag);
          data.tags.push({ id: item.id, name: item.name });
          tagForm.reset();
          populateFilters();
        } catch (error) { showCloudError(error); }
      });
    }
    $all("[data-content-form]").forEach((form) => {
      if (form.dataset.bound) return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
        requireCloudSession();
        const type = form.dataset.contentForm;
        const contentName = type === "album" ? "照片墙" : type === "moment" ? "生活圈" : "进步簿";
        if (!await confirmPublish(`确认发布到${contentName}？`, "发布后会立即保存到 Supabase，并在前台显示。")) return;
        await runWithLoading("正在上传并保存，请稍候…", async (cancelled) => {
        const files = Array.from(form.images?.files || []);
        const maxFiles = type === "moment" ? 9 : 12;
        if (files.length > maxFiles) {
          alert(`一次最多添加 ${maxFiles} 张图片。`);
          return;
        }
        const folder = type === "album" ? "albums" : type === "moment" ? "moments" : "progress";
        const images = await uploadOptimizedImages(state.userId, folder, files);
        if (cancelled()) return;
        const entry = {
          id: `${type}-${Date.now()}`,
          title: form.title.value.trim(),
          date: form.date?.value || today(),
          text: contentEntryValue(form).trim(),
          images
        };
        if (type === "album") {
          const row = await window.XiaoLuoSupabase.addContent("albums", { user_id: state.userId, title: entry.title, meta: form.meta.value.trim() || entry.date, description: form.description.value.trim() || "", image_urls: images });
          data.albums.unshift({ id: row.id, title: row.title, meta: row.meta, description: row.description, images: row.image_urls, photoClass: "photo-a" });
        } else if (type === "moment") {
          const row = await window.XiaoLuoSupabase.addContent("moments", { user_id: state.userId, title: entry.title, body: entry.text, entry_date: entry.date, image_urls: images });
          data.moments = sortTimelineByDate([...data.moments, { id: row.id, title: row.title, text: row.body, date: row.entry_date, images: row.image_urls, isPublic: Boolean(row.is_public) }]);
        } else {
          const row = await window.XiaoLuoSupabase.addContent("progress_logs", { user_id: state.userId, title: entry.title, body: entry.text, entry_date: entry.date, image_urls: images });
          data.progress = sortTimelineByDate([...data.progress, { id: row.id, title: row.title, text: row.body, date: row.entry_date, images: row.image_urls }]);
        }
        form.reset();
        const richText = $("[data-content-text]", form);
        if (richText) richText.innerHTML = "";
        renderContentManagers();
        alert("已保存。");
        return;
        alert("已保存到 Supabase，前台页面会立即显示。");
        });
        } catch (error) { showCloudError(error); }
      });
    });
    if (!document.body.dataset.contentManagerBound) {
      document.body.dataset.contentManagerBound = "true";
      document.addEventListener("click", async (event) => {
        const category = event.target.closest("[data-remove-category]");
        const tag = event.target.closest("[data-remove-tag]");
        const remove = event.target.closest("[data-remove-content]");
        const edit = event.target.closest("[data-edit-content]");
        try {
        if (category) {
          await window.XiaoLuoSupabase.deleteTaxonomy("categories", category.dataset.removeCategory, state.userId);
          data.categories = data.categories.filter((item) => item.id !== category.dataset.removeCategory);
          populateFilters();
        }
        if (tag) {
          await window.XiaoLuoSupabase.deleteTaxonomy("tags", tag.dataset.removeTag, state.userId);
          data.tags = data.tags.filter((item) => (typeof item === "string" ? item : item.id) !== tag.dataset.removeTag);
          populateFilters();
        }
        if (remove) {
          const { type, id } = remove.dataset;
          const table = type === "album" ? "albums" : type === "moment" ? "moments" : "progress_logs";
          const list = type === "album" ? data.albums : type === "moment" ? data.moments : data.progress;
          const item = list.find((entry) => entry.id === id);
          if (!await confirmPublish("确认删除整条帖子？", "标题、文字和其中所有图片都会删除，且无法恢复。", "确认删除")) return;
          if (item?.images?.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(item.images);
          await window.XiaoLuoSupabase.deleteContent(table, id, state.userId);
          if (type === "album") data.albums = data.albums.filter((item) => item.id !== id);
          if (type === "moment") data.moments = data.moments.filter((item) => item.id !== id);
          if (type === "progress") data.progress = data.progress.filter((item) => item.id !== id);
          renderContentManagers();
          renderDashboardStats();
        }
        const manageImages = event.target.closest("[data-manage-timeline-post]");
        if (manageImages) {
          const { type, id } = manageImages.dataset;
          const list = type === "moment" ? data.moments : data.progress;
          const item = list.find((entry) => entry.id === id);
          openContentPostEditor(type, item);
        }
        if (edit) {
          const { type, id } = edit.dataset;
          const list = type === "album" ? data.albums : type === "moment" ? data.moments : data.progress;
          const item = list.find((entry) => (entry.id || `${entry.date}--${entry.title}`) === id);
          if (!item) return;
          const title = window.prompt("修改标题", item.title);
          if (title === null || !title.trim()) return;
          const textKey = type === "album" ? "description" : "text";
          const text = window.prompt("修改内容", item[textKey] || "");
          item.title = title.trim();
          if (text !== null) item[textKey] = text.trim();
          const table = type === "album" ? "albums" : type === "moment" ? "moments" : "progress_logs";
          const row = type === "album" ? { title: item.title, description: item.description } : { title: item.title, body: item.text };
          await window.XiaoLuoSupabase.updateContent(table, id, state.userId, row);
          renderContentManagers();
          renderDashboardStats();
        }
        } catch (error) { showCloudError(error); }
      });
    }
  }

  function openContentImageManager(type, item) {
    if (!state.isAdmin || !item) return;
    let modal = $("[data-content-images-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal content-images-modal";
      modal.dataset.contentImagesModal = "";
      modal.innerHTML = `<div class="modal-backdrop" data-content-images-close></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="管理帖子"><button class="modal-close" type="button" data-content-images-close aria-label="关闭">x</button><p class="mini-title">POST MANAGEMENT</p><h2>管理帖子</h2><button class="danger-button" type="button" data-delete-timeline-post>删除整条帖子</button><div class="content-images-grid" data-content-images-grid></div></section>`;
      document.body.appendChild(modal);
    }
    const table = type === "moment" ? "moments" : "progress_logs";
    const draw = () => {
      const grid = $("[data-content-images-grid]", modal);
      grid.innerHTML = (item.images || []).map((url, index) => `<figure><img src="${url}" alt="帖子图片 ${index + 1}"><button class="danger-button" type="button" data-delete-content-image="${index}">删除图片</button></figure>`).join("") || '<p class="comment-empty">这条帖子没有图片。</p>';
      $("[data-delete-timeline-post]", modal).onclick = async () => {
        if (!await confirmPublish("确认删除整条帖子？", "标题、文字和其中所有图片都会删除，且无法恢复。", "确认删除")) return;
        try {
          if (item.images?.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(item.images);
          await window.XiaoLuoSupabase.deleteContent(table, item.id, state.userId);
          const list = type === "moment" ? data.moments : data.progress;
          const nextList = list.filter((entry) => entry.id !== item.id);
          if (type === "moment") data.moments = nextList; else data.progress = nextList;
          modal.classList.remove("open");
          renderCurrentPage();
        } catch (error) { showCloudError(error); }
      };
      $all("[data-delete-content-image]", grid).forEach((button) => {
        button.onclick = async () => {
          const index = Number(button.dataset.deleteContentImage);
          if (!await confirmPublish("确认删除这张图片？", "删除后无法恢复。", "确认删除")) return;
          const [removed] = item.images.splice(index, 1);
          try {
            await window.XiaoLuoSupabase.deleteFilesByPublicUrls([removed]);
            await window.XiaoLuoSupabase.updateContent(table, item.id, state.userId, { image_urls: item.images });
            renderContentManagers();
            renderDashboardStats();
            if (!item.images.length) modal.classList.remove("open"); else draw();
          } catch (error) { item.images.splice(index, 0, removed); showCloudError(error); }
        };
      });
    };
    $all("[data-content-images-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    draw();
    modal.classList.add("open");
  }

  function openContentPostEditor(type, item) {
    if (!state.isAdmin || !item) return;
    let modal = $("[data-content-post-editor]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal content-post-editor-modal";
      modal.dataset.contentPostEditor = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-content-editor-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="编辑帖子"><button class="modal-close" type="button" data-content-editor-close aria-label="关闭">×</button><p class="mini-title">POST EDITOR</p><h2 data-content-editor-heading>编辑帖子</h2><form data-content-editor-form><label><span>标题</span><input name="title" type="text" required></label><label><span>日期</span><input name="date" type="date" required></label><div class="rich-text-field"><span>正文</span><div class="text-format-editor"><div class="text-format-toolbar" data-format-toolbar><button type="button" data-format-action="bold" title="加粗（Ctrl+B）"><b>B</b></button><button type="button" data-format-action="underline" title="下划线（Ctrl+U）"><u>U</u></button><button type="button" data-format-action="link" title="添加超链接">↗</button><span class="format-toolbar-divider"></span><button type="button" class="format-highlight red" data-format-action="highlight" data-highlight-color="#ffddd8" title="红色高亮"></button><button type="button" class="format-highlight green" data-format-action="highlight" data-highlight-color="#d8f2e2" title="绿色高亮"></button><button type="button" class="format-highlight blue" data-format-action="highlight" data-highlight-color="#dce9ff" title="蓝色高亮"></button></div><div class="rich-text-input compact" data-format-input data-content-editor-body contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="选择文字后可使用加粗、下划线、链接和高亮"></div></div></div><section class="post-editor-images"><div><strong>已有图片</strong><p>可替换或删除单张图片。</p></div><div class="content-editor-image-grid" data-content-editor-images></div></section><label><span>添加图片</span><input name="newImages" type="file" accept="image/*" multiple></label><div class="publish-confirm-actions"><button class="danger-button" type="button" data-content-editor-delete>删除整条帖子</button><button class="primary-button" type="submit">保存修改</button></div></form></section>`;
      document.body.appendChild(modal);
    }
    const table = type === "moment" ? "moments" : "progress_logs";
    const folder = type === "moment" ? "moments" : "progress";
    const form = $("[data-content-editor-form]", modal);
    let publicField = $("[data-content-editor-public-field]", form);
    if (!publicField) {
      publicField = document.createElement("label");
      publicField.className = "content-public-field";
      publicField.dataset.contentEditorPublicField = "";
      publicField.innerHTML = '<input name="isPublic" type="checkbox"><span>公开给全站用户（未登录及活跃度不足的用户也可查看）</span>';
      form.querySelector('label:has(input[name="date"])')?.after(publicField);
    }
    publicField.hidden = type !== "moment";
    form.isPublic.checked = Boolean(item.isPublic);
    bindTextFormatToolbars(modal);
    let images = [...(item.images || [])];
    const replacements = new Map();
    const deleted = new Set();
    form.title.value = item.title || "";
    form.date.value = item.date || today();
    $("[data-content-editor-body]", form).innerHTML = formatRichText(item.text || "");
    $("[data-content-editor-heading]", modal).textContent = type === "moment" ? "编辑生活圈" : "编辑进步簿";

    const drawImages = () => {
      const grid = $("[data-content-editor-images]", modal);
      grid.innerHTML = images.map((url, index) => {
        if (deleted.has(index)) return "";
        const preview = replacements.get(index)?.preview || url;
        return `<figure><img src="${preview}" alt="帖子图片 ${index + 1}"><figcaption><label class="image-replace-label">替换<input type="file" accept="image/*" data-replace-content-image="${index}"></label><button class="danger-button" type="button" data-remove-editor-image="${index}">删除</button></figcaption></figure>`;
      }).join("") || '<p class="comment-empty">暂时没有图片。</p>';
      $all("[data-replace-content-image]", grid).forEach((input) => {
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => { replacements.set(Number(input.dataset.replaceContentImage), { file, preview: reader.result }); drawImages(); };
          reader.readAsDataURL(file);
        };
      });
      $all("[data-remove-editor-image]", grid).forEach((button) => {
        button.onclick = () => { deleted.add(Number(button.dataset.removeEditorImage)); drawImages(); };
      });
    };

    $all("[data-content-editor-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    $("[data-content-editor-delete]", modal).onclick = async () => {
      if (!await confirmPublish("确认删除整条帖子？", "标题、文字和图片都会删除，且无法恢复。", "确认删除")) return;
      try {
        await runWithLoading("正在删除帖子…", async () => {
          if (images.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(images);
          await window.XiaoLuoSupabase.deleteContent(table, item.id, state.userId);
        });
        const next = (type === "moment" ? data.moments : data.progress).filter((entry) => entry.id !== item.id);
        if (type === "moment") data.moments = next; else data.progress = next;
        modal.classList.remove("open");
        renderCurrentPage();
      } catch (error) { showCloudError(error); }
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      const newFiles = Array.from(form.newImages.files || []);
      const activeCount = images.filter((_, index) => !deleted.has(index)).length + newFiles.length;
      if (activeCount > 9) { alert("生活圈和进步簿每条最多保留 9 张图片。"); return; }
      try {
        await runWithLoading("正在保存修改…", async (cancelled) => {
          const nextImages = [];
          const oldImagesToDelete = [];
          for (let index = 0; index < images.length; index += 1) {
            const oldUrl = images[index];
            if (deleted.has(index)) { oldImagesToDelete.push(oldUrl); continue; }
            const replacement = replacements.get(index);
            if (replacement) {
              const uploaded = await uploadOptimizedImage(state.userId, folder, replacement.file);
              if (cancelled()) return;
              nextImages.push(uploaded);
              oldImagesToDelete.push(oldUrl);
            } else nextImages.push(oldUrl);
          }
          const additions = await uploadOptimizedImages(state.userId, folder, newFiles);
          if (cancelled()) return;
          nextImages.push(...additions);
          const updated = { title: form.title.value.trim(), body: sanitizeRichHtml($("[data-content-editor-body]", form).innerHTML).trim(), entry_date: form.date.value, image_urls: nextImages, ...(type === "moment" ? { is_public: Boolean(form.isPublic.checked) } : {}) };
          await window.XiaoLuoSupabase.updateContent(table, item.id, state.userId, updated);
          if (oldImagesToDelete.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(oldImagesToDelete);
          item.title = updated.title;
          item.text = updated.body;
          item.date = updated.entry_date;
          item.images = nextImages;
          if (type === "moment") item.isPublic = updated.is_public;
          if (type === "moment") data.moments = sortTimelineByDate(data.moments);
          else data.progress = sortTimelineByDate(data.progress);
        });
        modal.classList.remove("open");
        renderCurrentPage();
      } catch (error) { showCloudError(error); }
    };
    drawImages();
    modal.classList.add("open");
  }

  function initTimelinePostManagement() {
    if (document.body.dataset.timelineManagementBound) return;
    document.body.dataset.timelineManagementBound = "true";
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-manage-timeline-post]");
      if (trigger && state.isAdmin) {
        event.stopPropagation();
        const type = trigger.dataset.type;
        const list = type === "moment" ? data.moments : data.progress;
        openContentPostEditor(type, list.find((entry) => entry.id === trigger.dataset.id));
        return;
      }
      const publicToggle = event.target.closest("[data-toggle-moment-public]");
      if (publicToggle && state.isAdmin) {
        event.stopPropagation();
        const item = data.moments.find((entry) => entry.id === publicToggle.dataset.toggleMomentPublic);
        if (!item) return;
        const nextPublic = !item.isPublic;
        confirmPublish(nextPublic ? "公开这条生活圈？" : "取消全站公开？", nextPublic ? "未登录用户也可以查看这条完整生活圈内容。" : "未登录用户和活跃值不足的用户将只能看到锁定预览。", nextPublic ? "确认公开" : "确认取消").then(async (confirmed) => {
          if (!confirmed) return;
          try {
            await window.XiaoLuoSupabase.updateContent("moments", item.id, state.userId, { is_public: nextPublic });
            item.isPublic = nextPublic;
            renderLifeTimeline();
          } catch (error) { showCloudError(error); }
        });
        return;
      }
      const card = event.target.closest("[data-open-timeline-post]");
      if (!card || event.target.closest("button, a")) return;
      const type = card.dataset.type;
      const list = type === "moment" ? data.moments : data.progress;
      const item = list.find((entry) => entry.id === card.dataset.id);
      if (item?.isLocked) { requireActivityAccess(50, "小罗生活圈内容"); return; }
      openTimelineDetail(type, item);
    });
  }

  function openTimelineDetail(type, item) {
    if (!item) return;
    let modal = $("[data-timeline-detail-modal]");
    if (!modal) {
      modal = document.createElement("div"); modal.className = "modal timeline-detail-modal"; modal.dataset.timelineDetailModal = "";
      modal.innerHTML = `<div class="modal-backdrop" data-timeline-detail-close></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="内容详情"><button class="modal-close" type="button" data-timeline-detail-close>×</button><div class="detail-split-layout"><article class="timeline-detail-main"><p class="mini-title" data-timeline-detail-date></p><h2 data-timeline-detail-title></h2><div class="timeline-rich-text" data-timeline-detail-text></div><div class="timeline-detail-images" data-timeline-detail-images></div><div class="post-actions"><button type="button" data-timeline-like>点赞 0</button><span class="post-engagement" data-timeline-engagement>阅读 0 · 评论 0</span></div></article><aside class="timeline-comments"><h3>评论</h3><p data-timeline-comment-note>登录后可以评论。</p><form data-timeline-comment-form><textarea name="content" maxlength="1000" placeholder="写下你的评论"></textarea><button class="primary-button small" type="submit">发表评论</button></form><div class="comment-list" data-timeline-comment-list></div></aside></div></section>`;
      document.body.appendChild(modal);
    }
    modal.classList.remove("open");
    $("[data-timeline-detail-date]", modal).textContent = item.date;
    $("[data-timeline-detail-title]", modal).textContent = item.title;
    $("[data-timeline-detail-text]", modal).innerHTML = formatRichText(item.text).replace(/\n/g, "<br>");
    highlightCodeBlocks($("[data-timeline-detail-text]", modal));
    $("[data-timeline-detail-images]", modal).innerHTML = (item.images || []).map((url) => `<img src="${url}" alt="${escapeHtml(item.title)}">`).join("");
    $all("[data-timeline-detail-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    let replyTo = null;
    const drawComments = async () => {
      try {
        const comments = await window.XiaoLuoSupabase.getContentComments(type, item.id);
        const commentList = $("[data-timeline-comment-list]", modal);
        commentList.innerHTML = commentThreadHtml(comments, "data-delete-content-comment");
        bindReplyButtons(commentList, form, (id) => { replyTo = id; });
        if (state.isAdmin) {
          $all("[data-delete-content-comment]", modal).forEach((button) => {
            button.onclick = async () => {
              if (!await confirmPublish("确认删除这条评论？", "删除后无法恢复。", "确认删除")) return;
              try {
                await window.XiaoLuoSupabase.deleteContentComment(button.dataset.deleteContentComment);
                await drawComments();
                await drawEngagement();
              } catch (error) { showCloudError(error); }
            };
          });
        }
      } catch (error) { console.warn("Timeline comments load failed:", error.message); }
    };
    const drawEngagement = async () => {
      try {
        await window.XiaoLuoSupabase.recordContentView(type, item.id, state.userId);
        const engagement = await window.XiaoLuoSupabase.getContentEngagement(type, item.id, state.userId, window.XiaoLuoSupabase.getVisitorId());
        const button = $("[data-timeline-like]", modal);
        button.textContent = engagement.liked ? `已点赞 ${engagement.likes}` : `点赞 ${engagement.likes}`;
        button.classList.toggle("is-liked", engagement.liked);
        button.onclick = async () => { try { await window.XiaoLuoSupabase.toggleContentLike(type, item.id, state.userId, engagement.liked, window.XiaoLuoSupabase.getVisitorId()); await refreshAuthState(); drawEngagement(); } catch (error) { showCloudError(error); } };
        $("[data-timeline-engagement]", modal).textContent = `阅读 ${engagement.views} · 评论 ${engagement.comments}`;
      } catch (error) { console.warn("Timeline engagement load failed:", error.message); }
    };
    const form = $("[data-timeline-comment-form]", modal); form.reset();
    $("[data-timeline-comment-note]", modal).textContent = state.isLoggedIn ? "评论会保存到这条内容下方。" : "请先登录后发表评论。";
    form.onsubmit = async (event) => { event.preventDefault(); if (!requireActivityAccess(10, "评论功能")) return; const content = form.content.value.trim(); if (!content) return; try { await window.XiaoLuoSupabase.addContentComment(type, item.id, state.userId, content, replyTo); replyTo = null; form.reset(); form.content.placeholder = "写下你的评论"; await refreshAuthState(); await drawComments(); await drawEngagement(); } catch (error) { showCloudError(error); } };
    drawComments(); drawEngagement(); modal.classList.add("open");
  }

  function renderHome() {
    const latest = $("[data-latest-posts]");
    const featured = $("[data-featured-posts]");
    const chips = $("[data-category-chips]");
    if (latest) {
      const posts = data.posts.slice(0, 4);
      latest.innerHTML = posts.map(postCard).join("");
      loadPostCardEngagement(posts, latest);
    }
    if (featured) featured.innerHTML = "";
    if (chips) chips.innerHTML = "";
    $all("[data-site-announcement]").forEach((el) => { el.textContent = data.site.announcement || "暂无公告。"; });
    const photoCount = data.posts.filter((post) => post.coverUrl).length + data.moments.reduce((count, item) => count + (item.images?.length || 0), 0);
    $all("[data-profile-post-count]").forEach((el) => { el.textContent = data.posts.length; });
    $all("[data-profile-photo-count]").forEach((el) => { el.textContent = photoCount; });
    $all("[data-profile-whisper-count]").forEach((el) => { el.textContent = "0"; });
    if (window.XiaoLuoSupabase?.listWhispers) {
      window.XiaoLuoSupabase.listWhispers("", 1000).then((items) => {
        const count = items.filter((item) => !item.parent_id).length;
        $all("[data-profile-whisper-count]").forEach((el) => { el.textContent = count; });
      }).catch(() => {});
    }
    renderSiteStats();
    initGuestbook();
  }

  function activityAvatarHtml(item, className = "activity-rank-avatar") {
    const name = item.display_name || "普通用户";
    const avatar = item.avatar_url || "";
    return `<button class="${className}${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${escapeHtml(item.user_id)}" aria-label="查看${escapeHtml(name)}的资料"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</button>`;
  }

  async function renderActivityHeatmap() {
    const grid = $("[data-activity-heatmap]");
    if (!grid) return;
    const targetUserId = null;
    try {
      const rows = await window.XiaoLuoSupabase.getActivityHeatmap(targetUserId);
      const counts = new Map(rows.map((row) => [row.date, row.count]));
      const chinaParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
      const today = new Date(Number(chinaParts.year), Number(chinaParts.month) - 1, Number(chinaParts.day));
      const currentYear = today.getFullYear();
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 11, 31);
      const totalDays = Math.round((end - start) / 86400000) + 1;
      const range = $("[data-activity-heatmap-range]");
      const title = $("[data-activity-heatmap-title]");
      if (title) title.textContent = `全站 ${currentYear} 年活跃热力图`;
      if (range) range.textContent = `${currentYear}年01月 - 12月`;
      const mondayOffset = (start.getDay() + 6) % 7;
      const cells = Array.from({ length: mondayOffset }, () => '<i class="is-empty" aria-hidden="true"></i>');
      for (let index = 0; index < totalDays; index += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const isFuture = date > today;
        const count = isFuture ? 0 : (counts.get(key) || 0);
        const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : count < 11 ? 4 : 5;
        cells.push(`<i class="level-${level}${isFuture ? " is-future" : ""}" title="${key} · ${isFuture ? "未来日期" : `${count} 次活跃`}" aria-label="${key}，${isFuture ? "未来日期" : `${count}次活跃`}"></i>`);
      }
      grid.innerHTML = cells.join("");
      const months = $("[data-activity-heatmap-months]");
      if (months) months.innerHTML = Array.from({ length: 12 }, (_, month) => `<span>${month + 1}月</span>`).join("");
    } catch (error) {
      grid.innerHTML = '<p class="empty-state">热力图尚未初始化。</p>';
    }
  }

  function replaceWhisperSelection(textarea, prefix, suffix = "") {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const selected = textarea.value.slice(start, end) || "写点什么";
    textarea.value = `${textarea.value.slice(0, start)}${prefix}${selected}${suffix}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function renderWhisperContent(value) {
    return escapeHtml(value || "")
      .replace(/\[\[b\]\]([\s\S]*?)\[\[\/b\]\]/g, "<strong>$1</strong>")
      .replace(/\[\[c:(rose|amber|green|blue|purple)\]\]([\s\S]*?)\[\[\/c\]\]/g, '<span class="whisper-color-$1">$2</span>');
  }

  function openActivityRulesModal() {
    let modal = $("[data-activity-rules-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal activity-rules-modal";
      modal.dataset.activityRulesModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-activity-rules-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-activity-rules-close aria-label="关闭">×</button><p class="mini-title">SCORE RULES</p><h2>活跃度如何计算</h2><p>每次有效互动都会沉淀为活跃度，达到对应等级即可解锁权益。</p><div class="activity-rules-scroll">${ACTIVITY_RULES.map(([name, score, note]) => `<article><span>${escapeHtml(name)}</span><strong>${score}</strong><small>${escapeHtml(note)}</small></article>`).join("")}</div></section>`;
      document.body.appendChild(modal);
      $all("[data-activity-rules-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    }
    modal.classList.add("open");
  }

  async function renderFriendLinks() {
    const list = $("[data-activity-friend-list]");
    const form = $("[data-activity-friend-form]");
    const manageButton = $("[data-activity-friend-manage]");
    if (!list || !form) return;
    form.hidden = true;
    if (manageButton) {
      manageButton.hidden = !state.isAdmin;
      manageButton.onclick = () => {
        form.hidden = !form.hidden;
        manageButton.textContent = form.hidden ? "添加友链" : "收起添加区";
      };
    }
    const draw = async () => {
      try {
        const links = await window.XiaoLuoSupabase.listFriendLinks();
        list.innerHTML = links.map((link) => `<article><button type="button" data-open-friend-link="${escapeHtml(link.url)}"><span class="activity-friend-icon${link.icon_url ? " has-image" : ""}"${link.icon_url ? ` style="background-image:url('${escapeHtml(link.icon_url)}')"` : ""}>${link.icon_url ? "" : escapeHtml(link.name.slice(0, 1))}</span><span><strong>${escapeHtml(link.name)}</strong><small>${escapeHtml(link.description || "朋友的个人博客")}</small></span></button>${state.isAdmin ? `<button class="activity-friend-delete" type="button" data-delete-friend-link="${escapeHtml(link.id)}" aria-label="删除友链">×</button>` : ""}</article>`).join("") || '<p class="empty-state">暂无友链</p>';
        $all("[data-open-friend-link]", list).forEach((button) => { button.onclick = async () => { const approved = await confirmPublish("即将前往第三方网站", "该网址由第三方开发者维护，网站内的任何内容、服务与信息均与小罗的Life无关。", "继续前往"); if (approved) window.open(button.dataset.openFriendLink, "_blank", "noopener,noreferrer"); }; });
        $all("[data-delete-friend-link]", list).forEach((button) => { button.onclick = async () => { if (!await confirmPublish("删除这个友链？", "删除后不会影响对方网站。", "确认删除")) return; try { await window.XiaoLuoSupabase.deleteFriendLink(button.dataset.deleteFriendLink); await draw(); } catch (error) { showCloudError(error); } }; });
      } catch (error) { list.innerHTML = '<p class="empty-state">友链功能尚未初始化。</p>'; }
    };
    if (!form.dataset.bound) {
      form.dataset.bound = "true";
      form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); try { let iconUrl = String(data.get("iconUrl") || "").trim() || null; const iconFile = form.iconFile.files?.[0]; if (iconFile) iconUrl = await window.XiaoLuoSupabase.uploadFile(state.userId, "friend-links", iconFile); await window.XiaoLuoSupabase.addFriendLink({ name: String(data.get("name") || "").trim(), url: String(data.get("url") || "").trim(), icon_url: iconUrl, description: String(data.get("description") || "").trim() }); form.reset(); await draw(); } catch (error) { showCloudError(error); } };
    }
    await draw();
  }

  async function renderActivityLeaderboard() {
    const rankingList = $("[data-activity-ranking-list]");
    if (!rankingList) return;
    const levels = $("[data-activity-levels]");
    $("[data-activity-rules-open]").onclick = openActivityRulesModal;
    levels.innerHTML = ACTIVITY_LEVELS.map((level) => {
      const unlocked = state.isAdmin || state.activityScore >= level.score;
      return `<article class="${unlocked ? "is-unlocked" : ""}"><span>${level.score}</span><div><strong>${level.title}</strong><small>${level.right}</small></div><i aria-hidden="true">${unlocked ? "✓" : "○"}</i></article>`;
    }).join("");
    try {
      const items = await window.XiaoLuoSupabase.listActivityLeaderboard();
      $("[data-activity-user-count]").textContent = `${items.length} 位罗客`;
      const podiumItems = [
        { item: items[1], place: 2 },
        { item: items[0], place: 1 },
        { item: items[2], place: 3 }
      ].filter(({ item }) => Boolean(item));
      $("[data-activity-podium]").innerHTML = podiumItems.map(({ item, place }) => `<article class="activity-podium-place place-${place}"><span class="activity-crown" aria-hidden="true">${place === 1 ? "✦" : place}</span>${activityAvatarHtml(item, "activity-podium-avatar")}<strong>${escapeHtml(item.display_name)}</strong><small>${escapeHtml(item.title)}</small><b>${item.score}</b></article>`).join("");
      rankingList.innerHTML = items.slice(3, 10).map((item) => `<article class="activity-ranking-row${item.user_id === state.userId ? " is-me" : ""}"><span class="activity-rank-number">${item.rank}</span>${activityAvatarHtml(item)}<div><strong>${escapeHtml(item.display_name)}${item.is_admin ? '<em>作者</em>' : ""}</strong><small>${escapeHtml(item.title)}</small></div><b>${item.score}<small>活跃度</small></b></article>`).join("") || '<p class="empty-state">前三位罗客已经站上领奖台。</p>';
      const self = items.find((item) => item.user_id === state.userId);
      const selfSummary = $("[data-activity-self-summary]");
      if (self && state.isLoggedIn) {
        const next = ACTIVITY_LEVELS.find((level) => level.score > self.score);
        const max = next?.score || Math.max(self.score, 4000);
        const previous = [...ACTIVITY_LEVELS].reverse().find((level) => level.score <= self.score)?.score || 0;
        const progress = next ? Math.max(0, Math.min(100, ((self.score - previous) / Math.max(1, max - previous)) * 100)) : 100;
        selfSummary.hidden = false;
        selfSummary.innerHTML = `<span>我的排名 <strong>${self.rank}</strong></span><span>活跃度 <strong>${self.score}</strong></span><span>称号 <strong>${escapeHtml(self.title)}</strong></span><div><i style="width:${progress}%"></i></div><small>${next ? `距离「${next.title}」还差 ${next.score - self.score} 活跃度` : "你已抵达最高称号"}</small>`;
      }
    } catch (error) {
      rankingList.innerHTML = '<p class="empty-state">活跃榜尚未初始化，请管理员先执行 activity-system.sql。</p>';
      console.warn("Activity leaderboard load failed:", error.message);
    }
  }

  async function renderWhispers() {
    const feed = $("[data-whisper-feed]");
    const form = $("[data-whisper-form]");
    if (!feed || !form || !state.isLoggedIn) return;
    const filterUserId = params().get("user") || "";
    const profile = state.currentProfile || {};
    const ownName = profile.display_name || (state.isAdmin ? "小罗" : "普通用户");
    const ownAvatar = profile.avatar_url || (state.isAdmin ? "./assets/images/xiaoluo-blog-icon.jpg" : "");
    const ownAvatarNode = $("[data-whisper-own-avatar]");
    $("[data-whisper-own-name]").textContent = ownName;
    ownAvatarNode.textContent = ownAvatar ? "" : ownName.slice(0, 1);
    ownAvatarNode.classList.toggle("has-image", Boolean(ownAvatar));
    ownAvatarNode.style.backgroundImage = ownAvatar ? `url('${ownAvatar}')` : "";
    ownAvatarNode.dataset.profileUserId = state.userId;

    let replyTo = null;
    const emojiPicker = $("[data-whisper-emoji-picker]");
    const emojiPanel = $("[data-whisper-emoji-panel]");
    emojiPicker.innerHTML = WHISPER_EMOJIS.map((emoji) => `<button type="button" data-whisper-emoji="${emoji}" aria-label="插入表情 ${emoji}">${emoji}</button>`).join("");
    const textarea = form.content;
    $all("[data-whisper-emoji]", emojiPicker).forEach((button) => {
      button.onclick = () => {
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        textarea.value = `${textarea.value.slice(0, start)}${button.dataset.whisperEmoji}${textarea.value.slice(end)}`;
        textarea.focus();
        const cursor = start + button.dataset.whisperEmoji.length;
        textarea.setSelectionRange(cursor, cursor);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        emojiPanel.hidden = true;
      };
    });
    textarea.oninput = () => { $("[data-whisper-count]").textContent = textarea.value.length; };

    const replyBar = $("[data-whisper-replying]");
    const clearReply = () => { replyTo = null; replyBar.hidden = true; replyBar.querySelector("span").textContent = ""; };
    $("[data-cancel-whisper-reply]").onclick = clearReply;

    const templatePanel = $("[data-whisper-template-panel]");
    const templateList = $("[data-whisper-template-list]");
    const templateAdmin = $("[data-whisper-template-admin]");
    templateAdmin.hidden = !state.isAdmin;
    $("[data-whisper-template-toggle]").onclick = () => { templatePanel.hidden = !templatePanel.hidden; emojiPanel.hidden = true; };
    $("[data-whisper-emoji-toggle]").onclick = () => { emojiPanel.hidden = !emojiPanel.hidden; templatePanel.hidden = true; };
    $("[data-whisper-bold]").onclick = () => replaceWhisperSelection(textarea, "[[b]]", "[[/b]]");
    $all("[data-whisper-color]", form).forEach((button) => {
      button.onclick = () => replaceWhisperSelection(textarea, `[[c:${button.dataset.whisperColor}]]`, "[[/c]]");
    });
    const drawTemplates = async () => {
      try {
        const templates = await window.XiaoLuoSupabase.listWhisperTemplates();
        templateList.innerHTML = templates.map((item) => `<div><button type="button" data-use-whisper-template="${escapeHtml(item.id)}" data-template-content="${escapeHtml(item.content)}">${escapeHtml(item.content)}</button>${state.isAdmin ? `<button type="button" data-delete-whisper-template="${escapeHtml(item.id)}" aria-label="删除模板">×</button>` : ""}</div>`).join("") || '<p class="empty-state">暂时没有灵感模板。</p>';
        $all("[data-use-whisper-template]", templateList).forEach((button) => { button.onclick = () => { textarea.value = button.dataset.templateContent; textarea.focus(); textarea.dispatchEvent(new Event("input", { bubbles: true })); templatePanel.hidden = true; }; });
        $all("[data-delete-whisper-template]", templateList).forEach((button) => { button.onclick = async () => { if (!await confirmPublish("删除这条灵感模板？", "删除后不会影响已经发布的碎碎念。", "确认删除")) return; await window.XiaoLuoSupabase.deleteWhisperTemplate(button.dataset.deleteWhisperTemplate); await drawTemplates(); }; });
      } catch (error) { templateList.innerHTML = '<p class="empty-state">请先执行最新版 activity-system.sql。</p>'; }
    };
    $("[data-add-whisper-template]").onclick = async () => {
      const input = $("[data-whisper-template-input]");
      const content = input.value.trim();
      if (!content) return;
      try { await window.XiaoLuoSupabase.addWhisperTemplate(content); input.value = ""; await drawTemplates(); } catch (error) { showCloudError(error); }
    };
    await drawTemplates();

    const draw = async () => {
      feed.innerHTML = '<p class="empty-state">正在读取碎碎念…</p>';
      try {
        const items = await window.XiaoLuoSupabase.listWhispers(filterUserId);
        if (filterUserId) {
          let filteredName = items[0]?.profile?.display_name || "这位用户";
          if (!items.length) {
            try { filteredName = (await window.XiaoLuoSupabase.getPublicProfile(filterUserId))?.display_name || filteredName; } catch (_) {}
          }
          $("[data-whisper-feed-title]").textContent = `${filteredName}的碎碎念`;
          $("[data-whisper-show-all]").hidden = false;
        } else {
          $("[data-whisper-feed-title]").textContent = "大家的碎碎念";
          $("[data-whisper-show-all]").hidden = true;
        }
        const repliesByParent = new Map();
        // 构建id到item的映射，用于查找根碎碎念和被回复者
        const itemMap = new Map();
        items.forEach((item) => itemMap.set(item.id, item));

        // 找到每条回复的根碎碎念id（递归向上找）
        const findRootId = (id) => {
          const item = itemMap.get(id);
          if (!item || !item.parent_id) return id;
          return findRootId(item.parent_id);
        };

        // 按根碎碎念分组所有回复（包括回复的回复，全部平铺一层）
        const repliesByRoot = new Map();
        items.filter((item) => item.parent_id).forEach((item) => {
          const rootId = findRootId(item.id);
          if (!repliesByRoot.has(rootId)) repliesByRoot.set(rootId, []);
          repliesByRoot.get(rootId).push(item);
        });

        const renderReply = (item) => {
          const itemProfile = item.profile || {};
          const name = itemProfile.display_name || "普通用户";
          const avatar = itemProfile.avatar_url || "";
          const canDelete = state.isAdmin || item.user_id === state.userId;
          // 查找被回复者名字
          let replyToName = "";
          if (item.parent_id) {
            const parentItem = itemMap.get(item.parent_id);
            if (parentItem) {
              replyToName = parentItem.profile?.display_name || "普通用户";
            }
          }
          const replyPrefix = replyToName ? `<span class="whisper-reply-to">回复 @${escapeHtml(replyToName)}</span>` : "";
          return `<article class="whisper-reply"><button class="whisper-avatar comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${item.user_id}"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</button><div><header><button type="button" data-profile-user-id="${item.user_id}">${escapeHtml(name)}</button>${replyPrefix}<time>${formatPostDate(item.created_at)}</time></header><p class="whisper-rich-text">${renderWhisperContent(item.content)}</p><button class="comment-reply-button whisper-reply-btn" type="button" data-reply-whisper="${item.id}" data-reply-name="${escapeHtml(name)}">回复</button></div>${canDelete ? `<button class="whisper-delete" type="button" data-delete-whisper="${item.id}">删除</button>` : ""}</article>`;
        };
        const PREVIEW_COUNT = 0;
        feed.innerHTML = items.filter((item) => !item.parent_id).map((item) => {
          const itemProfile = item.profile || {};
          const name = itemProfile.display_name || "普通用户";
          const avatar = itemProfile.avatar_url || "";
          const canDelete = state.isAdmin || item.user_id === state.userId;
          const replies = (repliesByRoot.get(item.id) || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          const hasMore = replies.length > PREVIEW_COUNT;
          const visibleReplies = hasMore ? replies.slice(0, PREVIEW_COUNT) : replies;
          const repliesHtml = replies.length ? `
            <div class="whisper-replies" data-whisper-replies="${item.id}">
              ${visibleReplies.map(renderReply).join("")}
              ${hasMore ? `<button class="whisper-expand-replies" type="button" data-expand-replies="${item.id}" data-total="${replies.length}">展开 ${replies.length - PREVIEW_COUNT} 条回复</button>` : ""}
            </div>` : "";
          return `<article class="whisper-card glass-card${item.user_id === state.userId ? " is-own" : ""}"><button class="whisper-avatar comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${item.user_id}" aria-label="查看${escapeHtml(name)}的资料"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</button><div class="whisper-card-body"><header><button type="button" data-profile-user-id="${item.user_id}">${escapeHtml(name)}</button>${itemProfile.is_admin ? '<span class="whisper-author-badge">作者</span>' : ""}${item.user_id === state.userId ? '<span class="whisper-own-badge">我的碎碎念</span>' : ""}<time>${formatPostDate(item.created_at)}</time></header><p class="whisper-rich-text">${renderWhisperContent(item.content)}</p><button class="comment-reply-button" type="button" data-reply-whisper="${item.id}" data-reply-name="${escapeHtml(name)}">回复</button>${repliesHtml}</div>${canDelete ? `<button class="whisper-delete" type="button" data-delete-whisper="${item.id}" aria-label="删除这条碎碎念">删除</button>` : ""}</article>`;
        }).join("") || '<p class="empty-state">这里还没有碎碎念，来写下第一条吧。</p>';
        // 展开/收起回复
        const allRepliesMap = new Map();
        items.filter((item) => item.parent_id).forEach((item) => {
          const rootId = findRootId(item.id);
          if (!allRepliesMap.has(rootId)) allRepliesMap.set(rootId, []);
          allRepliesMap.get(rootId).push(item);
        });
        function bindReplyEvents(container) {
          $all("[data-reply-whisper]", container).forEach((button) => { button.onclick = () => { replyTo = button.dataset.replyWhisper; replyBar.hidden = false; replyBar.querySelector("span").textContent = `正在回复 ${button.dataset.replyName}`; textarea.focus(); textarea.scrollIntoView({ behavior: "smooth", block: "center" }); }; });
          $all("[data-delete-whisper]", container).forEach((button) => {
            button.onclick = async () => {
              if (!await confirmPublish("确认删除这条碎碎念？", "删除后无法恢复。", "确认删除")) return;
              try { await window.XiaoLuoSupabase.deleteWhisper(button.dataset.deleteWhisper); await draw(); } catch (error) { showCloudError(error); }
            };
          });
        }
        function bindExpandEvents(container) {
          $all("[data-expand-replies]", container).forEach((btn) => {
            btn.onclick = () => {
              const rootId = btn.dataset.expandReplies;
              const repliesContainer = btn.closest(".whisper-replies");
              const allReplies = (allRepliesMap.get(rootId) || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              if (btn.dataset.expanded === "true") {
                const visibleReplies = allReplies.slice(0, PREVIEW_COUNT);
                repliesContainer.innerHTML = visibleReplies.map(renderReply).join("") + `<button class="whisper-expand-replies" type="button" data-expand-replies="${rootId}" data-total="${allReplies.length}">展开 ${allReplies.length - PREVIEW_COUNT} 条回复</button>`;
              } else {
                repliesContainer.innerHTML = allReplies.map(renderReply).join("") + `<button class="whisper-expand-replies" type="button" data-expand-replies="${rootId}" data-total="${allReplies.length}" data-expanded="true">收起回复</button>`;
              }
              bindReplyEvents(repliesContainer);
              bindExpandEvents(repliesContainer);
            };
          });
        }
        bindReplyEvents(feed);
        bindExpandEvents(feed);
      } catch (error) {
        feed.innerHTML = `<p class="empty-state">${escapeHtml(error.message || "碎碎念暂时无法加载。")}</p>`;
      }
    };

    if (!form.dataset.bound) {
      form.dataset.bound = "true";
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (!requireActivityAccess(10, "碎碎念发布功能")) return;
        const content = textarea.value.trim();
        if (!content) return;
        const button = $("button[type='submit']", form);
        button.disabled = true;
        button.textContent = "发布中…";
        try {
          await window.XiaoLuoSupabase.addWhisper(state.userId, content, replyTo);
          await refreshAuthState();
          form.reset();
          clearReply();
          $("[data-whisper-count]").textContent = "0";
          await draw();
        } catch (error) { showCloudError(error); }
        finally { button.disabled = false; button.textContent = "发布碎碎念"; }
      };
    }
    await draw();
    updateWhisperUnreadBadge(true);
  }

  function guestbookAvatarHtml() {
    return '<span class="guestbook-avatar" aria-hidden="true"><i></i><b></b></span>';
  }

  function guestbookMessageHtml(message, index) {
    const positions = [[7, 12, -4], [49, 7, 3], [27, 29, -2], [68, 35, 5], [9, 55, 2], [45, 61, -5], [72, 74, 4], [31, 79, 1], [55, 48, -3], [76, 18, -5], [14, 37, 4], [57, 71, -1]];
    const [baseLeft, baseTop, rotate] = positions[index % positions.length];
    const round = Math.floor(index / positions.length);
    const left = Math.min(80, Math.max(3, baseLeft + ((round * 13) % 19) - 8));
    const top = Math.min(79, Math.max(6, baseTop + ((round * 17) % 23) - 10));
    const deleteButton = state.isAdmin ? `<button class="drift-letter-delete" type="button" data-delete-drift-message="${escapeHtml(message.id)}" aria-label="删除这封留言" title="删除留言">×</button>` : "";
    const expandButton = String(message.message || "").length > 38 ? '<button class="drift-letter-expand" type="button" data-toggle-drift-message aria-expanded="false">展开全文</button>' : "";
    return `<article class="drift-letter" style="--letter-left:${left}%;--letter-top:${top}%;--letter-rotate:${rotate}deg;--letter-delay:${(index % 6) * -.55}s"><div class="drift-letter-inner">${deleteButton}${guestbookAvatarHtml()}<div class="drift-letter-content"><div class="drift-letter-meta"><strong>${escapeHtml(message.nickname)}</strong><time>${formatPostDate(message.created_at)}</time></div><p>${escapeHtml(message.message)}</p>${expandButton}</div></div></article>`;
  }

  async function openGuestbook() {
    let modal = $("[data-guestbook-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal guestbook-modal";
      modal.dataset.guestbookModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-guestbook-close aria-label="关闭留言墙"></button><section class="guestbook-panel" role="dialog" aria-modal="true" aria-labelledby="guestbook-title"><button class="modal-close" type="button" data-guestbook-close aria-label="关闭">×</button><div class="guestbook-orbit orbit-one"></div><div class="guestbook-orbit orbit-two"></div><header class="guestbook-heading"><p class="mini-title">ANONYMOUS MESSAGE</p><h2 id="guestbook-title">匿名留言墙</h2><p>匿名留言，在这里你可以畅心所欲的抒发你的情感、生活、碎碎念等留言！快来留言啦~</p><button class="guestbook-manage-button" type="button" data-guestbook-manage hidden>管理留言</button></header><section class="guestbook-compose"><div class="envelope-mark" aria-hidden="true"><span></span></div><form data-guestbook-form><label><span>昵称（选填）</span><input name="nickname" type="text" maxlength="20" placeholder="不填写即为匿名用户"></label><label><span>想留下的话</span><textarea name="message" maxlength="180" required placeholder="随心写下想说的话…"></textarea></label><div class="guestbook-form-footer"><small><span data-guestbook-count>0</span> / 180</small><button class="guestbook-send-button" type="submit"><span>匿名投递</span><i aria-hidden="true"></i></button></div></form></section><section class="guestbook-stream-wrap"><div class="guestbook-stream" data-guestbook-stream><p class="guestbook-empty">漂流墙正在等第一封信。</p></div></section><section class="guestbook-manage-panel" data-guestbook-manage-panel hidden><div class="guestbook-manage-head"><h3>管理留言</h3><button type="button" data-guestbook-manage-close>返回漂流墙</button></div><div data-guestbook-manage-list></div><div class="guestbook-manage-pager"><button type="button" data-guestbook-page-prev>上一页</button><span data-guestbook-page-info></span><button type="button" data-guestbook-page-next>下一页</button></div></section></section>`;
      document.body.appendChild(modal);
      $all("[data-guestbook-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
      const form = $("[data-guestbook-form]", modal);
      const textarea = form.message;
      textarea.oninput = () => { $("[data-guestbook-count]", form).textContent = textarea.value.length; };
      form.onsubmit = async (event) => {
        event.preventDefault();
        const nickname = form.nickname.value.trim() || "匿名用户";
        const message = form.message.value.trim();
        if (!message) return;
        const button = $("button[type='submit']", form);
        try {
          button.disabled = true;
          modal.classList.add("is-sending");
          const row = await window.XiaoLuoSupabase.addGuestbookMessage(nickname, message);
          form.reset();
          $("[data-guestbook-count]", form).textContent = "0";
          const stream = $("[data-guestbook-stream]", modal);
          $(".guestbook-empty", stream)?.remove();
          stream.insertAdjacentHTML("beforeend", guestbookMessageHtml(row, stream.querySelectorAll(".drift-letter").length));
          bindGuestbookDeleteActions(modal);
          setTimeout(() => modal.classList.remove("is-sending"), 900);
        } catch (error) {
          modal.classList.remove("is-sending");
          if (String(error.message || "").includes("guestbook_messages")) {
            alert("留言墙还没有连接到数据库。请先在 Supabase 的 SQL Editor 执行项目中的 guestbook.sql 文件，执行一次即可。");
          } else {
            showCloudError(error);
          }
        } finally {
          button.disabled = false;
        }
      };
      const manageButton = $("[data-guestbook-manage]", modal);
      const managePanel = $("[data-guestbook-manage-panel]", modal);
      manageButton.onclick = async () => { managePanel.hidden = false; modal.dataset.guestbookPage = "0"; await renderGuestbookManager(modal); };
      $("[data-guestbook-manage-close]", modal).onclick = () => { managePanel.hidden = true; };
      bindGuestbookDrag($("[data-guestbook-stream]", modal));
    }
    modal.classList.add("open");
    await updateGuestbookAdminAccess(modal);
    await loadGuestbookMessages(modal);
    bindGuestbookDeleteActions(modal);
  }

  function bindGuestbookDeleteActions(modal) {
    $all("[data-toggle-drift-message]", modal).forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.onclick = (event) => {
        event.stopPropagation();
        const letter = button.closest(".drift-letter");
        const expanded = letter.classList.toggle("is-expanded");
        button.textContent = expanded ? "收起" : "展开全文";
        button.setAttribute("aria-expanded", String(expanded));
      };
    });
    if (!state.isAdmin) return;
    $all("[data-delete-drift-message]", modal).forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.onclick = async (event) => {
        event.stopPropagation();
        if (!await confirmPublish("删除这封留言？", "删除后无法恢复。", "确认删除")) return;
        try {
          await runWithLoading("正在删除留言…", () => window.XiaoLuoSupabase.deleteGuestbookMessage(button.dataset.deleteDriftMessage));
          button.closest(".drift-letter")?.remove();
        } catch (error) { showCloudError(error); }
      };
    });
  }

  async function updateGuestbookAdminAccess(modal) {
    const manageButton = $("[data-guestbook-manage]", modal);
    if (!manageButton) return;
    if (window.XiaoLuoSupabase?.isConfigured) {
      try { await refreshAuthState(); } catch (_) {}
    }
    let canManage = Boolean(state.isAdmin || state.currentProfile?.is_admin || (state.adminId && state.adminId === state.userId));
    if (!canManage && state.userId) {
      try {
        const admin = await window.XiaoLuoSupabase.getAdminProfile();
        canManage = admin?.id === state.userId;
      } catch (_) {}
    }
    manageButton.hidden = !canManage;
    manageButton.style.display = canManage ? "inline-flex" : "none";
  }

  function bindGuestbookDrag(stream) {
    if (!stream || stream.dataset.dragBound) return;
    stream.dataset.dragBound = "true";
    let startX = 0; let startY = 0; let targetX = 0; let targetY = 0; let offsetX = 0; let offsetY = 0; let dragging = false; let frame = 0;
    const glide = () => {
      offsetX += (targetX - offsetX) * .11;
      offsetY += (targetY - offsetY) * .11;
      stream.style.setProperty("--guestbook-drag-x", `${offsetX.toFixed(1)}px`);
      stream.style.setProperty("--guestbook-drag-y", `${offsetY.toFixed(1)}px`);
      if (Math.abs(targetX - offsetX) > .2 || Math.abs(targetY - offsetY) > .2) frame = requestAnimationFrame(glide);
      else frame = 0;
    };
    const scheduleGlide = () => { if (!frame) frame = requestAnimationFrame(glide); };
    stream.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX - targetX;
      startY = event.clientY - targetY;
      stream.setPointerCapture(event.pointerId);
      stream.classList.add("is-dragging");
    });
    stream.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      event.preventDefault();
      targetX = Math.max(-180, Math.min(180, event.clientX - startX));
      targetY = Math.max(-110, Math.min(110, event.clientY - startY));
      scheduleGlide();
    });
    const finish = (event) => { if (!dragging) return; dragging = false; stream.classList.remove("is-dragging"); stream.releasePointerCapture?.(event.pointerId); };
    stream.addEventListener("pointerup", finish);
    stream.addEventListener("pointercancel", finish);
  }

  async function renderGuestbookManager(modal) {
    const list = $("[data-guestbook-manage-list]", modal);
    list.innerHTML = '<p class="guestbook-empty">正在读取留言…</p>';
    try {
      const messages = await window.XiaoLuoSupabase.listGuestbookMessages(100);
      const pageSize = 4;
      const pages = Math.max(1, Math.ceil(messages.length / pageSize));
      const page = Math.min(Math.max(0, Number(modal.dataset.guestbookPage || 0)), pages - 1);
      modal.dataset.guestbookPage = String(page);
      const visible = messages.slice(page * pageSize, page * pageSize + pageSize);
      list.innerHTML = visible.map((message) => `<article class="guestbook-manager-row"><div>${guestbookAvatarHtml()}<div><strong>${escapeHtml(message.nickname)}</strong><time>${formatPostDate(message.created_at)}</time><p>${escapeHtml(message.message)}</p></div></div><button type="button" data-delete-guestbook-message="${message.id}">删除</button></article>`).join("") || '<p class="guestbook-empty">暂无留言。</p>';
      $("[data-guestbook-page-info]", modal).textContent = `${page + 1} / ${pages}`;
      const previous = $("[data-guestbook-page-prev]", modal);
      const next = $("[data-guestbook-page-next]", modal);
      previous.disabled = page === 0;
      next.disabled = page >= pages - 1;
      previous.onclick = () => { modal.dataset.guestbookPage = String(page - 1); renderGuestbookManager(modal); };
      next.onclick = () => { modal.dataset.guestbookPage = String(page + 1); renderGuestbookManager(modal); };
      $all("[data-delete-guestbook-message]", list).forEach((button) => {
        button.onclick = async () => {
          if (!await confirmPublish("删除这条留言？", "删除后无法恢复。", "确认删除")) return;
          try {
            await runWithLoading("正在删除留言…", () => window.XiaoLuoSupabase.deleteGuestbookMessage(button.dataset.deleteGuestbookMessage));
            const stream = $("[data-guestbook-stream]", modal);
            stream.dataset.loaded = "";
            await Promise.all([renderGuestbookManager(modal), loadGuestbookMessages(modal)]);
          } catch (error) { showCloudError(error); }
        };
      });
    } catch (error) {
      list.innerHTML = '<p class="guestbook-empty">暂时无法读取留言。</p>';
    }
  }

  async function loadGuestbookMessages(modal) {
    const stream = $("[data-guestbook-stream]", modal);
    if (!stream || stream.dataset.loaded === "true") return;
    stream.innerHTML = '<p class="guestbook-empty">正在寻找漂来的信…</p>';
    try {
      const messages = await window.XiaoLuoSupabase.listGuestbookMessages();
      stream.dataset.loaded = "true";
      stream.innerHTML = messages.map(guestbookMessageHtml).join("") || '<p class="guestbook-empty">漂流墙正在等第一封信。</p>';
      bindGuestbookDeleteActions(modal);
    } catch (error) {
      stream.innerHTML = '<p class="guestbook-empty">留言墙尚未初始化，请先执行 guestbook.sql。</p>';
      console.warn("Guestbook load failed:", error.message);
    }
  }

  function initGuestbook() {
    $all("[data-open-guestbook]").forEach((button) => { button.onclick = openGuestbook; });
  }

  function openMusicLibrary(manage = false) {
    let modal = $("[data-music-library-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal music-library-modal";
      modal.dataset.musicLibraryModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-music-library-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="音乐歌单"><button class="modal-close" type="button" data-music-library-close aria-label="关闭">×</button><p class="mini-title">MUSIC LIBRARY</p><h2>我的歌单</h2><div class="music-track-list" data-music-track-list></div><div class="music-local-sync" data-music-local-sync hidden><p>可将项目内置音乐追加到数据库，已有歌曲不会删除。</p><button type="button" data-sync-local-music>合并本地歌单</button></div><form class="music-upload-form" data-music-upload-form hidden><h3>添加音乐</h3><label><span>音乐文件</span><input name="file" type="file" accept="audio/*" required></label><label><span>歌名</span><input name="title" type="text" maxlength="80" required></label><label><span>歌手/说明</span><input name="artist" type="text" maxlength="80" placeholder="可不填"></label><label><span>分类</span><input name="category" type="text" maxlength="40" placeholder="可不填"></label><button class="primary-button small" type="submit">上传并添加</button></form></section>`;
      document.body.appendChild(modal);
    }
    const list = $("[data-music-track-list]", modal);
    const form = $("[data-music-upload-form]", modal);
    const canManageMusic = Boolean(manage && state.isAdmin);
    const localSync = $("[data-music-local-sync]", modal);
    form.hidden = !canManageMusic;
    form.style.display = canManageMusic ? "" : "none";
    $all("input, button", form).forEach((control) => { control.disabled = !canManageMusic; });
    localSync.hidden = !canManageMusic;
    localSync.style.display = canManageMusic ? "" : "none";
    $all("button", localSync).forEach((control) => { control.disabled = !canManageMusic; });
    list.innerHTML = data.music.map((track, index) => `<article class="music-track-row${index === state.musicIndex ? " is-current" : ""}"><button type="button" data-select-music-track="${index}"><span>${index + 1}</span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist || "小罗Blog")}</small></button>${canManageMusic && track.id ? `<div class="music-track-tools"><button type="button" data-move-music-track="${index}" data-direction="up" aria-label="上移">↑</button><button type="button" data-move-music-track="${index}" data-direction="down" aria-label="下移">↓</button><button type="button" data-delete-music-track="${index}" aria-label="删除">删除</button></div>` : ""}</article>`).join("") || '<p class="comment-empty">还没有音乐。</p>';
    $all("[data-music-library-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    $all("[data-select-music-track]", list).forEach((button) => { button.onclick = () => { document.dispatchEvent(new CustomEvent("xiaoluo-play-track", { detail: { index: Number(button.dataset.selectMusicTrack), play: true } })); openMusicLibrary(manage); }; });
    $all("[data-move-music-track]", list).forEach((button) => {
      button.onclick = async () => {
        const from = Number(button.dataset.moveMusicTrack); const to = from + (button.dataset.direction === "up" ? -1 : 1);
        if (to < 0 || to >= data.music.length) return;
        const next = [...data.music]; [next[from], next[to]] = [next[to], next[from]];
        try {
          await runWithLoading("正在调整歌单顺序…", async () => Promise.all(next.filter((track) => track.id).map((track, order) => window.XiaoLuoSupabase.updateMusicTrack(state.userId, track.id, { sort_order: order }))));
          data.music = next; state.musicIndex = to; document.dispatchEvent(new CustomEvent("xiaoluo-music-library-updated")); openMusicLibrary(true);
        } catch (error) { showCloudError(error); }
      };
    });
    $all("[data-delete-music-track]", list).forEach((button) => {
      button.onclick = async () => {
        const index = Number(button.dataset.deleteMusicTrack); const track = data.music[index];
        if (!track?.id || !await confirmPublish("确认删除这首音乐？", "音乐文件和歌单记录都会删除。", "确认删除")) return;
        try {
          await runWithLoading("正在删除音乐…", async () => { await window.XiaoLuoSupabase.deleteFilesByPublicUrls([track.src]); await window.XiaoLuoSupabase.deleteMusicTrack(state.userId, track.id); });
          data.music.splice(index, 1); state.musicIndex = 0; document.dispatchEvent(new CustomEvent("xiaoluo-play-track", { detail: { index: 0, play: false } })); openMusicLibrary(true);
        } catch (error) { showCloudError(error); }
      };
    });
    form.onsubmit = async (event) => {
      event.preventDefault(); const file = form.file.files?.[0]; if (!file) return;
      try {
        await runWithLoading("正在上传音乐并保存歌单…", async () => {
          const url = await window.XiaoLuoSupabase.uploadFile(state.userId, "music", file);
          const row = await window.XiaoLuoSupabase.addMusicTrack(state.userId, { title: form.title.value.trim(), artist: form.artist.value.trim(), category: form.category.value.trim(), file_url: url, sort_order: data.music.length });
          data.music.push({ id: row.id, title: row.title, artist: row.artist || "小罗Blog", category: row.category || "", src: row.file_url });
        });
        form.reset(); document.dispatchEvent(new CustomEvent("xiaoluo-music-library-updated")); openMusicLibrary(true);
      } catch (error) { showCloudError(error); }
    };
    $("[data-sync-local-music]", modal).onclick = async () => {
      if (!canManageMusic) return;
      if (!await confirmPublish("合并本地歌单？", "只追加数据库中没有的音乐，已有歌曲和上传文件都会保留。", "确认合并")) return;
      const localTracks = JSON.parse(JSON.stringify(defaultData.music));
      try {
        await runWithLoading("正在合并歌单…", async () => {
          const keyOf = (track) => `${String(track.title || "").trim().toLowerCase()}|${String(track.artist || "").trim().toLowerCase()}`;
          const existing = new Set(data.music.map(keyOf));
          const missing = localTracks.filter((track) => !existing.has(keyOf(track)));
          const rows = await Promise.all(missing.map((track, index) => window.XiaoLuoSupabase.addMusicTrack(state.userId, { title: track.title, artist: track.artist, category: track.category, file_url: track.src, sort_order: data.music.length + index })));
          data.music.push(...missing.map((track, index) => ({ ...track, id: rows[index].id })));
        });
        document.dispatchEvent(new CustomEvent("xiaoluo-music-library-updated"));
        openMusicLibrary(true);
      } catch (error) { showCloudError(error); }
    };
    modal.classList.add("open");
  }

  function renderArticles() {
    const list = $("[data-article-list]");
    const form = $("[data-article-filter]");
    const pagination = $("[data-pagination]");
    if (!list || !form) return;
    const pageSize = 6;
    let currentPage = 1;
    const requestedQuery = params().get("q") || "";
    const requestedCategory = params().get("category") || "";
    const requestedTag = params().get("tag") || "";
    const tagNames = [...new Set(data.posts.flatMap((post) => parseCommaTags(post.tags)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    form.q.value = requestedQuery;
    form.category.value = requestedCategory;
    form.tag.innerHTML = '<option value="">全部标签</option>' + tagNames.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join("");
    form.tag.value = requestedTag;
    const categoryNames = [...new Set([
      ...data.categories.map((category) => category.name),
      ...data.posts.map((post) => post.category)
    ].filter(Boolean))];
    const categoryOptions = $("[data-article-categories]", form);
    const tagOptions = $("[data-article-tags]", form);
    if (categoryOptions) {
      categoryOptions.innerHTML = `<button type="button" class="article-filter-chip${requestedCategory ? "" : " active"}" data-article-filter-category="">全部 <small>${data.posts.length}</small></button>` + categoryNames.map((category) => {
        const count = data.posts.filter((post) => post.category === category).length;
        return `<button type="button" class="article-filter-chip${requestedCategory === category ? " active" : ""}" data-article-filter-category="${escapeHtml(category)}">${escapeHtml(category)} <small>${count}</small></button>`;
      }).join("");
    }
    if (tagOptions) {
      tagOptions.innerHTML = `<button type="button" class="article-filter-chip${requestedTag ? "" : " active"}" data-article-filter-tag="">全部</button>` + tagNames.map((tag) => {
        const count = data.posts.filter((post) => parseCommaTags(post.tags).includes(tag)).length;
        return `<button type="button" class="article-filter-chip${requestedTag === tag ? " active" : ""}" data-article-filter-tag="${escapeHtml(tag)}">#${escapeHtml(tag)} <small>${count}</small></button>`;
      }).join("");
    }

    const draw = () => {
      const q = form.q.value.trim().toLowerCase();
      const category = form.category.value;
      const tag = form.tag.value;
      const filtered = data.posts.filter((post) => {
        const postTags = parseCommaTags(post.tags);
        const hitText = [post.title, post.excerpt, post.category, postTags.join(" ")].join(" ").toLowerCase().includes(q);
        return hitText && (!category || post.category === category) && (!tag || postTags.includes(tag));
      });
      const total = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(currentPage, total);
      list.innerHTML = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(postCard).join("") || '<p class="empty-state">暂时没有找到文章。</p>';
      loadPostCardEngagement(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), list);
      $all("[data-article-filter-category]", form).forEach((button) => button.classList.toggle("active", button.dataset.articleFilterCategory === category));
      $all("[data-article-filter-tag]", form).forEach((button) => button.classList.toggle("active", button.dataset.articleFilterTag === tag));
      if (pagination) pagination.innerHTML = Array.from({ length: total }, (_, index) => `<button class="${index + 1 === currentPage ? "active" : ""}" type="button" data-page-number="${index + 1}">${index + 1}</button>`).join("");
    };

    if (!form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        currentPage = 1;
        draw();
      });
      form.addEventListener("click", (event) => {
        const categoryButton = event.target.closest("[data-article-filter-category]");
        const tagButton = event.target.closest("[data-article-filter-tag]");
        if (!categoryButton && !tagButton) return;
        if (categoryButton) form.category.value = categoryButton.dataset.articleFilterCategory;
        if (tagButton) form.tag.value = tagButton.dataset.articleFilterTag;
        currentPage = 1;
        draw();
      });
    }
    if (pagination && !pagination.dataset.bound) {
      pagination.dataset.bound = "true";
      pagination.addEventListener("click", (event) => {
        const button = event.target.closest("[data-page-number]");
        if (!button) return;
        currentPage = Number(button.dataset.pageNumber);
        draw();
      });
    }
    draw();
  }

  function renderCategories() {
    const pageWrap = $("[data-category-page]");
    if (!pageWrap) return;
    pageWrap.innerHTML = data.categories.map((cat) => {
      const count = data.posts.filter((post) => post.category === cat.name).length;
      return `<a class="category-card glass-card" href="./articles.html?category=${encodeURIComponent(cat.name)}"><span>${count}</span><h3>${escapeHtml(cat.name)}</h3><p>${escapeHtml(cat.description)}</p></a>`;
    }).join("");
  }

  function renderDetail() {
    const wrap = $("[data-article-detail]");
    if (!wrap) return;
    // 文章管理控件按当前管理员身份判断，不依赖云端站长资料是否刚好已经同步完成。
    const canManagePosts = Boolean(state.isAdmin && state.userId);
    if (!data.posts.length) {
      wrap.innerHTML = '<section class="article-detail glass-card empty-state">正在加载文章…</section>';
      return;
    }
    const id = params().get("id") || data.posts[0]?.id;
    const post = data.posts.find((item) => item.id === id);
    if (!post) {
      wrap.innerHTML = '<section class="article-detail glass-card empty-state">没有找到这篇文章。</section>';
      return;
    }
    const postOwnerId = post.userId || state.cloudOwnerId || state.userId;
    const index = data.posts.findIndex((item) => item.id === post.id);
    const prev = data.posts[index - 1];
    const next = data.posts[index + 1];
    document.title = `${post.title} | ${data.site.name}`;
    const requiredScore = Number(post.minActivityScore) || 0;
    const canRead = !requiredScore || hasActivityAccess(requiredScore);
    const requiredLevel = activityLevelForScore(requiredScore);
    const articleContent = canRead ? articleContentWithOutline(post.content) : { html: "", outline: [] };
    const hasOutline = articleContent.outline.length > 0;
    const outlineHtml = hasOutline
      ? `<aside class="article-outline glass-card"><p class="mini-title">ON THIS PAGE</p><h2>文章目录</h2><nav>${articleContent.outline.map((item) => `<a class="level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>`).join("")}</nav></aside>`
      : "";
    wrap.innerHTML = `
      <section class="article-detail-layout${hasOutline ? "" : " no-outline"}">
      ${outlineHtml}
      <div class="article-reading-column">
      <article class="article-detail" data-post-id="${post.id}">
        <p class="eyebrow">${escapeHtml(post.category)}${post.status === "private" ? " · 私密" : ""}</p>
        <div class="article-title-row"><h1>${escapeHtml(post.title)}</h1>${canRead && post.musicAttachment?.url ? `<div class="article-music" data-article-music><p>搭配音乐会更沉浸式</p><div><button type="button" data-article-music-toggle aria-label="播放文章配乐">▶</button><strong title="${escapeHtml(post.musicAttachment.name || "文章配乐")}">${escapeHtml(post.musicAttachment.name || "文章配乐")}</strong></div><audio data-article-music-audio preload="metadata" src="${escapeHtml(post.musicAttachment.url)}"></audio></div>` : ""}</div>
        <div class="article-meta detail-meta"><span>${escapeHtml(post.author)}</span><span>${formatPostDate(post.publishedAt)}</span><span>${escapeHtml(post.category)}</span></div>
        <div class="tag-row">${requiredScore ? `<span class="activity-read-label">${escapeHtml(requiredLevel.title)}可读</span>` : ""}${post.tags.map((tag) => `<a href="./articles.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
        ${post.coverUrl ? `<div class="detail-cover"><img src="${post.coverUrl}" alt="${escapeHtml(post.title)} 封面"></div>` : ""}
        ${canRead ? `<div class="post-content">${articleContent.html}</div>${post.attachments?.length ? `<section class="post-attachments"><h2>附件下载</h2>${post.attachments.map((file) => `<a href="${file.url}" data-protected-download download="${escapeHtml(file.name)}" target="_blank" rel="noopener">下载：${escapeHtml(file.name)}</a>`).join("")}</section>` : ""}` : `<section class="article-access-lock"><p class="mini-title">ACTIVITY ACCESS</p><h2>${state.isLoggedIn ? "你的称号权限不足" : "登录后查看"}</h2><p>${state.isLoggedIn ? `这篇文章需要达到「${escapeHtml(requiredLevel.title)}」才能阅读全文。你的活跃度为 ${state.activityScore}，继续参与互动后再来看看吧。` : `这篇文章需要达到「${escapeHtml(requiredLevel.title)}」后才能阅读全文，请先登录参与互动。`}</p><button class="primary-button small" type="button" data-post-access-request>${state.isLoggedIn ? "查看活跃榜" : "登录后查看"}</button></section>`}
        ${canRead ? `<div class="post-actions">
          ${canManagePosts ? `<a class="ghost-button" href="./editor.html?id=${post.id}">编辑文章</a>` : ""}
          ${canManagePosts ? `<button class="danger-button" type="button" data-delete-post="${post.id}">删除文章</button>` : ""}
          <button type="button" data-post-like="${post.id}">点赞</button>
          <button type="button" data-placeholder-action="bookmark">收藏</button>
          <span class="post-engagement" data-post-engagement>阅读 0 · 点赞 0 · 评论 0</span>
        </div>` : ""}
        ${canManagePosts && post.status !== "private" ? `<section class="post-access-settings"><button class="ghost-button" type="button" data-post-access-toggle aria-expanded="false">阅读权限：${requiredScore ? `${escapeHtml(requiredLevel.title)}可读` : "全站公开"}</button><div data-post-access-panel hidden><div class="post-access-track"><span>全站公开</span><input type="range" min="0" max="${ACTIVITY_LEVELS.length}" step="1" value="${requiredScore ? Math.max(0, ACTIVITY_LEVELS.findIndex((level) => level.score === requiredLevel.score) + 1) : 0}" data-post-access-range><strong data-post-access-label>${requiredScore ? `${escapeHtml(requiredLevel.title)}（${requiredLevel.score} 活跃度）` : "全站公开"}</strong></div><div class="post-access-scale" aria-hidden="true"><span>公开</span><span>初入人</span><span>罗客神</span></div><small>拖动圆点设置阅读门槛，松开后立即保存。未达到要求的用户只能看到文章标题与封面。</small></div></section>` : ""}
      </article>
      ${canRead ? `<aside class="comments detail-comments-sidebar">
        <h2>评论</h2>
        <p data-comment-note>登录后可以发表评论。</p>
        <form data-post-comment-form data-post-id="${post.id}"><textarea name="content" placeholder="写下你的评论" maxlength="1000"></textarea><button class="primary-button small" type="submit">发表评论</button></form>
        <div class="comment-list" data-comment-list></div>
      </aside>` : ""}
      </div>
      </section>
      <nav class="post-neighbor">
        ${prev ? `<a href="./article-detail.html?id=${prev.id}">上一篇：${escapeHtml(prev.title)}</a>` : "<span>已经是最新文章</span>"}
        ${next ? `<a href="./article-detail.html?id=${next.id}">下一篇：${escapeHtml(next.title)}</a>` : "<span>已经是最后一篇</span>"}
      </nav>
    `;
    highlightCodeBlocks(wrap);
    if (canRead) {
      bindArticleMusic(wrap);
      loadPostEngagement(post.id);
    }
    $(`[data-post-access-request]`, wrap)?.addEventListener("click", () => {
      if (!state.isLoggedIn) requireActivityAccess(requiredScore, "这篇文章");
      else window.location.href = "./activity.html";
    });
    bindPostAccessSettings(wrap, post);
  }

  function bindPostAccessSettings(wrap, post) {
    const settings = $(".post-access-settings", wrap);
    if (!settings || settings.dataset.bound) return;
    const postOwnerId = post.userId || state.cloudOwnerId || state.userId;
    settings.dataset.bound = "true";
    settings.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-post-access-toggle]");
      if (!toggle) return;
      const panel = $("[data-post-access-panel]", settings);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      toggle.setAttribute("aria-expanded", String(!panel.hidden));
    });
    settings.addEventListener("input", (event) => {
      const range = event.target.closest("[data-post-access-range]");
      if (!range) return;
      const label = $("[data-post-access-label]", settings);
      const level = Number(range.value) ? ACTIVITY_LEVELS[Number(range.value) - 1] : null;
      if (label) label.textContent = level ? `${level.title}（${level.score} 活跃度）` : "全站公开";
    });
    settings.addEventListener("change", async (event) => {
      const range = event.target.closest("[data-post-access-range]");
      if (!range || range.dataset.saving === "true") return;
      const level = Number(range.value) ? ACTIVITY_LEVELS[Number(range.value) - 1] : null;
      const nextScore = level?.score || 0;
      range.dataset.saving = "true";
      range.disabled = true;
      try {
        await runWithLoading("正在保存文章阅读权限…", async () => window.XiaoLuoSupabase.updatePost(postOwnerId, post.id, { min_activity_score: nextScore }));
        post.minActivityScore = nextScore;
        renderDetail();
      } catch (error) {
        range.disabled = false;
        delete range.dataset.saving;
        showCloudError(error);
      }
    });
  }

  function bindArticleMusic(scope) {
    const player = $("[data-article-music]", scope);
    // 大多数文章没有配乐。此前仍对空节点继续查询子元素，会中断
    // 详情页后续的阅读、点赞、评论和权限控件初始化。
    if (!player || player.dataset.bound) return;
    const audio = $("[data-article-music-audio]", player);
    const toggle = $("[data-article-music-toggle]", player);
    if (!audio || !toggle) return;
    player.dataset.bound = "true";
    const sync = () => {
      const playing = !audio.paused;
      toggle.textContent = playing ? "❚❚" : "▶";
      toggle.setAttribute("aria-label", playing ? "暂停文章配乐" : "播放文章配乐");
      player.classList.toggle("is-playing", playing);
    };
    toggle.addEventListener("click", () => {
      if (audio.paused) audio.play().catch(() => {
        toggle.title = "音频地址无法播放，请检查文件或 URL 是否有效";
        toggle.textContent = "!";
      });
      else audio.pause();
    });
    audio.addEventListener("error", () => {
      player.classList.add("is-error");
      toggle.title = "音频加载失败，请在编辑文章中替换配乐";
      toggle.textContent = "!";
    });
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    sync();
  }

  async function loadPostEngagement(postId) {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    const isCurrentPost = () => $(".article-detail[data-post-id]")?.dataset.postId === String(postId);
    try {
      // 阅读写入失败不能阻断已经存在的点赞、评论和阅读统计读取。
      try { await api.recordPostView(postId, state.userId); }
      catch (viewError) { console.warn("Post view record failed:", viewError.message); }
      const engagement = await api.getPostEngagement(postId, state.userId, api.getVisitorId());
      if (!isCurrentPost()) return;
      const detailRoot = $(".article-detail[data-post-id]");
      const summary = $("[data-post-engagement]", detailRoot);
      if (summary) summary.textContent = `阅读 ${engagement.views} · 点赞 ${engagement.likes} · 评论 ${engagement.comments.length}`;
      const likeButton = $("[data-post-like]", detailRoot);
      if (likeButton) {
        likeButton.textContent = engagement.liked ? `已点赞 ${engagement.likes}` : `点赞 ${engagement.likes}`;
        likeButton.classList.toggle("is-liked", engagement.liked);
        likeButton.onclick = async () => {
          try { await api.togglePostLike(postId, state.userId, engagement.liked, api.getVisitorId()); await refreshAuthState(); await loadPostEngagement(postId); } catch (error) { showCloudError(error); }
        };
      }
      const note = $("[data-comment-note]", detailRoot?.parentElement || document);
      if (note) note.textContent = state.isLoggedIn ? "评论会保存到文章下方。" : "请先登录后发表评论。";
      const commentList = $("[data-comment-list]", detailRoot?.parentElement || document);
      if (commentList) commentList.innerHTML = commentThreadHtml(engagement.comments, "data-delete-post-comment");
      if (state.isAdmin && commentList) {
        $all("[data-delete-post-comment]", commentList).forEach((button) => {
          button.onclick = async () => {
            if (!await confirmPublish("确认删除这条评论？", "删除后无法恢复。", "确认删除")) return;
            try {
              await api.deletePostComment(button.dataset.deletePostComment);
              await loadPostEngagement(postId);
            } catch (error) { showCloudError(error); }
          };
        });
      }
      const form = $("[data-post-comment-form]", detailRoot?.parentElement || document);
      let replyTo = null;
      if (form) bindReplyButtons(commentList, form, (id) => { replyTo = id; });
      if (form) {
        form.onsubmit = async (event) => {
          event.preventDefault();
          if (!requireActivityAccess(10, "评论功能")) return;
          const content = form.content.value.trim();
          if (!content) return;
          try { await api.addPostComment(postId, state.userId, content, replyTo); replyTo = null; form.reset(); form.content.placeholder = "写下你的评论"; await refreshAuthState(); await loadPostEngagement(postId); } catch (error) { showCloudError(error); }
        };
      }
    } catch (error) {
      console.warn("Post engagement load failed:", error.message);
      // 即使评论详情读取失败，也尽量展示三项已有统计，避免界面长期停留在 0。
      try {
        const fallback = await api.getPostEngagementSummary(postId);
        if (!isCurrentPost()) return;
        const summary = $("[data-post-engagement]", $(".article-detail[data-post-id]"));
        if (summary) summary.textContent = `阅读 ${fallback.views} · 点赞 ${fallback.likes} · 评论 ${fallback.comments}`;
      } catch (summaryError) { console.warn("Post engagement summary fallback failed:", summaryError.message); }
    }
  }

  function loadPostCardEngagement(posts, scope) {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured || !posts?.length || !scope) return;
    posts.forEach(async (post) => {
      try {
        const engagement = await api.getPostEngagementSummary(post.id);
        const target = scope.querySelector(`[data-post-card-id="${post.id}"]`);
        if (!target) return;
        const views = $("[data-post-card-views]", target);
        const likes = $("[data-post-card-likes]", target);
        if (views) views.textContent = `阅读 ${engagement.views}`;
        if (likes) likes.textContent = `点赞 ${engagement.likes}`;
      } catch (error) { console.warn("Post card engagement load failed:", error.message); }
    });
  }

  function renderLifeTimeline() {
    const filter = $("[data-life-visibility-filter]");
    const publicOnly = $("[data-life-public-only]");
    const showAll = $("[data-life-show-all]");
    const restricted = !hasActivityAccess(50);
    if (filter) filter.hidden = !restricted;
    if (restricted && publicOnly && showAll) {
      if (!filter.dataset.bound) {
        publicOnly.checked = true;
        showAll.checked = false;
        const update = (source) => {
          if (source === publicOnly && publicOnly.checked) showAll.checked = false;
          if (source === showAll && showAll.checked) publicOnly.checked = false;
          if (!publicOnly.checked && !showAll.checked) publicOnly.checked = true;
          renderTimeline("[data-life-timeline]", publicOnly.checked ? data.moments.filter((item) => item.isPublic) : data.moments);
        };
        publicOnly.onchange = () => update(publicOnly);
        showAll.onchange = () => update(showAll);
        filter.dataset.bound = "true";
      }
      renderTimeline("[data-life-timeline]", publicOnly.checked ? data.moments.filter((item) => item.isPublic) : data.moments);
      return;
    }
    renderTimeline("[data-life-timeline]", data.moments);
  }

  function renderTimeline(selector, items) {
    const wrap = $(selector);
    if (!wrap) return;
    const type = selector.includes("progress") ? "progress" : "moment";
    wrap.innerHTML = items.map((item) => {
      const isLocked = type === "moment" && item.isLocked;
      const images = item.images || (item.imageClass ? [item.imageClass] : []);
      const imagePayload = escapeHtml(JSON.stringify(images));
      const grid = isLocked ? '<div class="moment-locked-preview" aria-hidden="true"><i></i><i></i><i></i></div>' : images.length ? `<div class="moment-gallery count-${Math.min(images.length, 9)}">${images.slice(0, 9).map((img, index) => /^https?:\/\//.test(img) ? `<button class="moment-thumb uploaded-image" type="button" data-timeline-images="${imagePayload}" data-timeline-index="${index}" style="background-image:url('${img}')" aria-label="查看第 ${index + 1} 张图片"></button>` : `<button class="moment-thumb ${img}" type="button" data-timeline-images="${imagePayload}" data-timeline-index="${index}" aria-label="查看第 ${index + 1} 张图片"></button>`).join("")}</div>` : "";
      const adminActions = state.isAdmin ? `<button class="timeline-manage-button" type="button" data-manage-timeline-post data-type="${type}" data-id="${escapeHtml(item.id)}" aria-label="管理这条帖子" title="管理帖子">⋯</button>` : "";
      const publicToggle = state.isAdmin && type === "moment" ? `<button class="timeline-public-toggle${item.isPublic ? " is-public" : ""}" type="button" data-toggle-moment-public="${escapeHtml(item.id)}">${item.isPublic ? "已公开给全站" : "公开给全站"}</button>` : "";
      const lockedNotice = isLocked ? '<span class="moment-locked-notice">登录后活跃值达到50可以解锁内容</span>' : "";
      return `<article class="timeline-item glass-card timeline-openable${isLocked ? " is-locked" : ""}" data-open-timeline-post data-type="${type}" data-id="${escapeHtml(item.id)}"><time>${escapeHtml(item.date)}</time><div class="timeline-content"><h3>${escapeHtml(item.title)}</h3><div class="timeline-rich-text">${formatRichText(item.text).replace(/\n/g, "<br>")}</div>${grid}${lockedNotice}<span class="timeline-engagement" data-timeline-card-engagement>${isLocked ? "内容已锁定" : "阅读 0 · 点赞 0 · 评论 0"}</span>${publicToggle}${adminActions}</div></article>`;
    }).join("") || '<article class="timeline-item glass-card empty-state">暂时还没有内容。</article>';
    highlightCodeBlocks(wrap);
    items.filter((item) => !item.isLocked).forEach((item) => loadTimelineCardEngagement(type, item.id, wrap));
  }

  function projectCoverHtml(project) {
    return project.coverUrl
      ? `<img src="${escapeHtml(project.coverUrl)}" alt="${escapeHtml(project.title)} 项目封面">`
      : '<span class="project-cover-placeholder" aria-hidden="true">✦</span>';
  }

  function renderProjects() {
    $all("[data-project-list]").forEach((wrap) => {
      wrap.innerHTML = data.projects.map((project) => `<button class="project-row glass-card" type="button" data-open-project="${escapeHtml(project.id)}"><span class="project-cover">${projectCoverHtml(project)}</span><span class="project-row-content"><span class="mini-title">PERSONAL PROJECT</span><strong>${escapeHtml(project.title)}</strong><span class="project-description">${escapeHtml(project.description || "暂时没有项目简介。")}</span><span class="project-row-meta">${project.projectUrl ? "含项目网址" : "项目详情"}${project.attachments?.length ? ` · ${project.attachments.length} 个附件` : ""}</span></span><span class="project-row-arrow" aria-hidden="true">›</span></button>`).join("") || '<article class="glass-card project-empty">个人项目正在整理中。</article>';
    });
    if (document.body.dataset.projectListBound) return;
    document.body.dataset.projectListBound = "true";
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-project]");
      if (!button) return;
      const project = data.projects.find((item) => item.id === button.dataset.openProject);
      if (project) openProjectDetail(project);
    });
  }

  const DEFAULT_MEDIA_TYPES = ["电影", "动漫", "游戏", "小说", "漫画", "书籍"];

  function mediaTypes() {
    const hiddenTypes = new Set(data.mediaTypes.filter((item) => item.isHidden).map((item) => item.name));
    const customTypes = data.mediaTypes.filter((item) => !item.isHidden && !DEFAULT_MEDIA_TYPES.includes(item.name)).map((item) => item.name);
    return [...new Set([...DEFAULT_MEDIA_TYPES.filter((name) => !hiddenTypes.has(name)), ...customTypes, ...data.mediaItems.map((item) => item.mediaType)].filter(Boolean))];
  }

  function mediaTypeClass(type) {
    const map = { 电影: "film", 电视剧: "series", 动漫: "anime", 游戏: "game", 小说: "novel", 漫画: "comic", 书籍: "book", 未分类: "other" };
    if (map[type]) return `media-type-${map[type]}`;
    const hueIndex = [...String(type || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
    return `media-type-custom-${hueIndex}`;
  }

  function mediaCoverHtml(item) {
    return item.coverUrl
      ? `<img src="${escapeHtml(item.coverUrl)}" alt="${escapeHtml(item.title)} 封面">`
      : '<span class="media-cover-placeholder" aria-hidden="true">◌</span>';
  }

  function mediaTagsHtml(item) {
    const tags = Array.isArray(item?.tags) ? item.tags.filter(Boolean).slice(0, 12) : [];
    return tags.length ? `<div class="media-card-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
  }

  function formatWatchedDate(item) {
    if (!item?.watchedYear) return "未记录日期";
    const month = item.watchedMonth ? `${item.watchedMonth}月` : "";
    const day = item.watchedDay ? `${item.watchedDay}日` : "";
    return `${item.watchedYear}年${month}${day}`;
  }

  function applyMediaCloudRows(mediaItems, mediaTypes, mediaReviews = []) {
    data.mediaReviews = mediaReviews.map((item) => ({ id: item.id, mediaItemId: item.media_item_id, title: item.review_title || "观后感", review: item.review || "", isPublic: item.is_public !== false }));
    const reviewsByItem = new Map(data.mediaReviews.map((item) => [item.mediaItemId, item]));
    data.mediaItems = mediaItems.map((item) => {
      const review = reviewsByItem.get(item.id);
      return {
        id: item.id,
        title: item.title,
        reviewTitle: review?.title || "观后感",
        review: review?.review || "",
        reviewPublic: item.review_is_public !== false,
        noteUrl: item.note_url || "",
        coverUrl: item.cover_url || "",
        rating: Number(item.rating) || 0,
        mediaType: item.media_type || "未分类",
        tags: Array.isArray(item.tags) ? item.tags : [],
        people: item.people || "",
        watchedYear: Number(item.watched_year) || 0,
        watchedMonth: Number(item.watched_month) || 0,
        watchedDay: Number(item.watched_day) || 0,
        createdAt: item.created_at || ""
      };
    });
    data.mediaTypes = mediaTypes.map((item) => ({ id: item.id, name: item.name, isHidden: Boolean(item.is_hidden) }));
    state.mediaDataLoaded = true;
    state.mediaLastRefreshedAt = Date.now();
  }

  async function refreshMediaListData(options = {}) {
    const api = window.XiaoLuoSupabase;
    const page = $("[data-media-page]");
    const showLoader = Boolean(options.showLoader);
    if (!api?.isConfigured) {
      state.mediaDataLoaded = true;
      if (page) renderMediaList();
      return;
    }
    if (state.mediaRefreshPromise && !options.force) return state.mediaRefreshPromise;
    const requestId = ++state.mediaRefreshNonce;
    if (showLoader && page) {
      state.mediaDataLoaded = false;
      renderMediaList();
    }
    const request = (async () => {
      let ownerId = state.cloudOwnerId || state.adminId;
      if (!ownerId) ownerId = (await api.getAdminProfile())?.id || null;
      if (!ownerId) throw new Error("暂时无法读取站长片单。");
      const [mediaItems, mediaTypes, mediaReviews] = await Promise.all([
        api.listContent("media_items", ownerId),
        api.listContent("media_types", ownerId),
        api.listContent("media_reviews", ownerId).catch(() => [])
      ]);
      if (requestId !== state.mediaRefreshNonce) return;
      state.adminId = ownerId;
      state.cloudOwnerId = ownerId;
      applyMediaCloudRows(mediaItems, mediaTypes, mediaReviews);
      if (pageName() === "media-list") renderMediaList();
    })();
    state.mediaRefreshPromise = request;
    try {
      await request;
    } finally {
      if (requestId === state.mediaRefreshNonce) state.mediaRefreshPromise = null;
    }
  }

  function ensureMediaListData() {
    if (pageName() !== "media-list") return;
    const needsInitialLoad = !state.mediaDataLoaded;
    const isStale = Date.now() - state.mediaLastRefreshedAt > 30000;
    if ((needsInitialLoad || isStale) && !state.mediaRefreshPromise) {
      refreshMediaListData({ showLoader: needsInitialLoad }).catch((error) => {
        state.mediaDataLoaded = true;
        if (pageName() === "media-list") renderMediaList();
        console.warn("Media list refresh failed:", error.message);
      });
    }
  }

  function renderMediaList() {
    const page = $("[data-media-page]");
    const list = $("[data-media-list]");
    if (!page || !list) return;
    let activeType = page.dataset.mediaType || "";
    let activeTag = page.dataset.mediaTag || "";
    const query = (page.dataset.mediaQuery || "").trim().toLowerCase();
    const sort = page.dataset.mediaSort || "watched-desc";
    const sortLabels = { "created-desc": "最近添加", "rating-desc": "评分最高", "watched-desc": "观看时间最新", "watched-asc": "观看时间最早" };
    $("[data-media-sort-label]", page).textContent = sortLabels[sort] || sortLabels["watched-desc"];
    const types = mediaTypes();
    if (activeType && !types.includes(activeType)) {
      activeType = "";
      page.dataset.mediaType = "";
    }
    const allTags = [...new Set(data.mediaItems.flatMap((item) => Array.isArray(item.tags) ? item.tags : []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    if (activeTag && !allTags.includes(activeTag)) { activeTag = ""; page.dataset.mediaTag = ""; }
    const visible = data.mediaItems.filter((item) => (!activeType || item.mediaType === activeType) && (!activeTag || (item.tags || []).includes(activeTag)) && (!query || `${item.title} ${item.people} ${item.mediaType} ${(item.tags || []).join(" ")}`.toLowerCase().includes(query)));
    const watchedKey = (item) => Number(`${item.watchedYear || 0}${String(item.watchedMonth || 0).padStart(2, "0")}${String(item.watchedDay || 0).padStart(2, "0")}`);
    visible.sort((a, b) => {
      if (sort === "rating-desc") return (Number(b.rating) || 0) - (Number(a.rating) || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      if (sort === "watched-desc") return watchedKey(b) - watchedKey(a) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      if (sort === "watched-asc") return watchedKey(a) - watchedKey(b) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    $("[data-media-count]", page).textContent = `${data.mediaItems.length} 条片单`;
    $("[data-media-types]", page).innerHTML = `<button class="media-filter${!activeType ? " active" : ""}" type="button" data-media-filter="">全部 <small>${data.mediaItems.length}</small></button>${types.map((type) => { const record = data.mediaTypes.find((item) => item.name === type); return `<button class="media-filter${activeType === type ? " active" : ""}" type="button" data-media-filter="${escapeHtml(type)}" data-media-type-name="${escapeHtml(type)}"${record ? ` data-media-type-id="${escapeHtml(record.id)}"` : ""}${state.isAdmin ? ' title="右键删除此类型"' : ""}>${escapeHtml(type)} <small>${data.mediaItems.filter((item) => item.mediaType === type).length}</small></button>`; }).join("")}`;
    const tagBar = $("[data-media-tags]", page);
    tagBar.hidden = !allTags.length;
    tagBar.innerHTML = allTags.map((tag) => `<button class="media-tag-filter${activeTag === tag ? " active" : ""}" type="button" data-media-tag-filter="${escapeHtml(tag)}">#${escapeHtml(tag)} <small>${data.mediaItems.filter((item) => (item.tags || []).includes(tag)).length}</small></button>`).join("");
    $all("[data-media-tag-filter]", tagBar).forEach((button) => {
      if (state.isAdmin) button.title = "右键删除此标签";
    });
    const waitingForCloud = Boolean(window.XiaoLuoSupabase?.isConfigured && !state.mediaDataLoaded);
    list.innerHTML = waitingForCloud ? '<div class="media-empty media-loading glass-card"><strong>正在加载片单…</strong><p>正在读取书籍、电影和观看记录。</p></div>' : visible.map((item) => `<article class="media-card" data-open-media-item="${escapeHtml(item.id)}"><button class="media-cover" type="button" aria-label="查看 ${escapeHtml(item.title)}">${mediaCoverHtml(item)}<span class="media-rating">★ ${item.rating ? item.rating.toFixed(1) : "未评分"}</span></button><div class="media-card-copy"><h2>${escapeHtml(item.title)}</h2><div class="media-card-meta"><p>${escapeHtml(item.mediaType)}</p>${item.people ? `<span>${escapeHtml(item.people)}</span>` : ""}<time>${escapeHtml(formatWatchedDate(item))}</time></div></div>${state.isAdmin ? `<button class="media-manage-button" type="button" data-edit-media-item="${escapeHtml(item.id)}" aria-label="编辑 ${escapeHtml(item.title)}">⋯</button>` : ""}</article>`).join("") || '<div class="media-empty glass-card"><strong>片单还在慢慢收藏</strong><p>管理员可以从右上角添加自己看过的电影、书籍、动漫或游戏。</p></div>';
    $all("[data-media-type-name]", page).forEach((button) => button.classList.add(mediaTypeClass(button.dataset.mediaTypeName)));
    $all(".media-card", list).forEach((card) => {
      const media = data.mediaItems.find((entry) => entry.id === card.dataset.openMediaItem);
      const badge = $(".media-card-meta p", card);
      if (media && badge) badge.classList.add(mediaTypeClass(media.mediaType));
      if (media) $(".media-card-copy", card)?.insertAdjacentHTML("beforeend", mediaTagsHtml(media));
    });
    $all("[data-open-media-item]", list).forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-edit-media-item]")) return;
        event.preventDefault();
        event.stopPropagation();
        const item = data.mediaItems.find((entry) => entry.id === card.dataset.openMediaItem);
        if (item) openMediaDetail(item);
      });
    });
    if (state.isAdmin && state.mediaDataLoaded && params().get("add") === "1" && !page.dataset.autoEditorOpened) {
      page.dataset.autoEditorOpened = "true";
      window.setTimeout(() => openMediaEditor(), 0);
    }
  }

  function initMediaList() {
    if (document.body.dataset.mediaListBound) return;
    document.body.dataset.mediaListBound = "true";
    document.addEventListener("input", (event) => {
      const input = event.target.closest("[data-media-search]");
      if (!input) return;
      const page = $("[data-media-page]");
      page.dataset.mediaQuery = input.value;
      renderMediaList();
    });
    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-media-type-form]");
      if (!form) return;
      event.preventDefault();
      if (!state.isAdmin) return showAdminOnlyNotice();
      const name = form.name.value.trim();
      if (!name || mediaTypes().includes(name)) return;
      try {
        const row = await window.XiaoLuoSupabase.addContent("media_types", { user_id: state.userId, name });
        data.mediaTypes.push({ id: row.id, name: row.name, isHidden: false });
        form.reset();
        renderMediaList();
      } catch (error) { showCloudError(error); }
    });
    document.addEventListener("click", async (event) => {
      const refresh = event.target.closest("[data-media-refresh]");
      if (refresh) {
        refresh.classList.add("is-loading");
        try {
          await refreshMediaListData({ showLoader: true, force: true });
        } catch (error) {
          showCloudError(error);
        } finally {
          refresh.classList.remove("is-loading");
        }
        return;
      }
      const sortToggle = event.target.closest("[data-media-sort-toggle]");
      if (sortToggle) {
        const menu = sortToggle.closest("[data-media-sort-menu]");
        const options = $("[data-media-sort-options]", menu);
        const opening = options.hidden;
        options.hidden = !opening;
        sortToggle.setAttribute("aria-expanded", String(opening));
        return;
      }
      const sortOption = event.target.closest("[data-media-sort-option]");
      if (sortOption) {
        const page = $("[data-media-page]");
        page.dataset.mediaSort = sortOption.dataset.mediaSortOption;
        renderMediaList();
        return;
      }
      if (!event.target.closest("[data-media-sort-menu]")) {
        $all("[data-media-sort-options]").forEach((options) => { options.hidden = true; });
        $all("[data-media-sort-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      }
      const filter = event.target.closest("[data-media-filter]");
      if (filter) {
        const page = $("[data-media-page]");
        page.dataset.mediaType = filter.dataset.mediaFilter || "";
        renderMediaList();
        return;
      }
      const tagFilter = event.target.closest("[data-media-tag-filter]");
      if (tagFilter) {
        const page = $("[data-media-page]");
        page.dataset.mediaTag = page.dataset.mediaTag === tagFilter.dataset.mediaTagFilter ? "" : tagFilter.dataset.mediaTagFilter;
        renderMediaList();
        return;
      }
      const add = event.target.closest("[data-add-media-item]");
      if (add) { if (state.isAdmin) openMediaEditor(); else showAdminOnlyNotice(); return; }
      const edit = event.target.closest("[data-edit-media-item]");
      if (edit) { event.stopPropagation(); openMediaEditor(data.mediaItems.find((item) => item.id === edit.dataset.editMediaItem)); return; }
      const card = event.target.closest("[data-open-media-item]");
      if (card && !event.target.closest("[data-edit-media-item]")) openMediaDetail(data.mediaItems.find((item) => item.id === card.dataset.openMediaItem));
    });
    document.addEventListener("contextmenu", async (event) => {
      const card = event.target.closest("[data-open-media-item]");
      const typeButton = event.target.closest("[data-media-type-name]");
      const tagButton = event.target.closest("[data-media-tag-filter]");
      if (!card && !typeButton && !tagButton) return;
      if (!state.isAdmin) return;
      event.preventDefault();
      try {
        if (card) await removeMediaItem(data.mediaItems.find((item) => item.id === card.dataset.openMediaItem));
        if (typeButton) await removeMediaType(typeButton.dataset.mediaTypeId, typeButton.dataset.mediaTypeName);
        if (tagButton) await removeMediaTag(tagButton.dataset.mediaTagFilter);
      } catch (error) { showCloudError(error); }
    });
  }

  async function removeMediaItem(item) {
    if (!item || !await confirmPublish("确认删除这条片单？", "封面图片也会一并删除，且无法恢复。", "确认删除")) return;
    await runWithLoading("正在删除片单…", async () => {
      if (item.coverUrl) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([item.coverUrl]);
      await window.XiaoLuoSupabase.deleteContent("media_items", item.id, state.userId);
      data.mediaItems = data.mediaItems.filter((entry) => entry.id !== item.id);
      renderMediaList();
    });
  }

  async function removeMediaType(typeId, typeName) {
    const type = data.mediaTypes.find((item) => item.id === typeId);
    const name = type?.name || typeName;
    if (!name || !await confirmPublish(`删除“${name}”类型？`, "该类型下的片单会转为未分类，删除后无法恢复。", "确认删除")) return;
    await runWithLoading("正在删除片单类型…", async () => {
      const affected = data.mediaItems.filter((item) => item.mediaType === name);
      if (DEFAULT_MEDIA_TYPES.includes(name)) {
        if (type) await window.XiaoLuoSupabase.updateContent("media_types", type.id, state.userId, { is_hidden: true });
        else {
          const row = await window.XiaoLuoSupabase.addContent("media_types", { user_id: state.userId, name, is_hidden: true });
          data.mediaTypes.push({ id: row.id, name: row.name, isHidden: true });
        }
        if (type) type.isHidden = true;
      }
      await Promise.all(affected.map((item) => window.XiaoLuoSupabase.updateContent("media_items", item.id, state.userId, { media_type: "未分类" })));
      if (!DEFAULT_MEDIA_TYPES.includes(name) && type) {
        await window.XiaoLuoSupabase.deleteContent("media_types", type.id, state.userId);
        data.mediaTypes = data.mediaTypes.filter((item) => item.id !== type.id);
      }
      affected.forEach((item) => { item.mediaType = "未分类"; });
      const page = $("[data-media-page]");
      if (page?.dataset.mediaType === name) page.dataset.mediaType = "";
      renderMediaList();
    });
  }

  async function removeMediaTag(tagName) {
    const name = String(tagName || "").trim();
    if (!name || !await confirmPublish(`删除“#${name}”标签？`, "该标签会从所有相关片单中移除，删除后无法恢复。", "确认删除")) return;
    await runWithLoading("正在删除片单标签…", async () => {
      const affected = data.mediaItems.filter((item) => Array.isArray(item.tags) && item.tags.includes(name));
      await Promise.all(affected.map((item) => window.XiaoLuoSupabase.updateContent("media_items", item.id, state.userId, {
        tags: item.tags.filter((tag) => tag !== name)
      })));
      affected.forEach((item) => { item.tags = item.tags.filter((tag) => tag !== name); });
      const page = $("[data-media-page]");
      if (page?.dataset.mediaTag === name) page.dataset.mediaTag = "";
      renderMediaList();
    });
  }

  function openMediaDetail(item) {
    if (!item) return;
    let modal = $("[data-media-detail-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal media-detail-modal";
      modal.dataset.mediaDetailModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-media-detail-close aria-label="关闭"></button><section class="modal-card glass-card media-detail-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-media-detail-close aria-label="关闭">×</button><div data-media-detail-content></div></section>';
      document.body.appendChild(modal);
    }
    const reviewText = item.review || "暂时还没有写观后感。";
    const visibilityLabel = item.reviewPublic ? "公开中" : "私密中";
    const reviewSection = state.isAdmin
      ? `<section class="media-review" tabindex="0"><p class="mini-title">REVIEW · ${visibilityLabel}</p><h3>${escapeHtml(item.reviewTitle || "观后感")}</h3><p class="media-review-summary">${escapeHtml(reviewText)}</p><div class="media-review-popover" role="tooltip"><strong>${escapeHtml(item.reviewTitle || "观后感")}</strong><p>${escapeHtml(reviewText)}</p></div></section>`
      : item.reviewPublic
        ? `<section class="media-review media-review-public"><p class="mini-title">REVIEW</p><h3>${escapeHtml(item.reviewTitle || "观后感")}</h3><p class="media-review-summary">${escapeHtml(reviewText)}</p></section>`
        : '<p class="media-private-note">观后感仅管理员可看</p>';
    $("[data-media-detail-content]", modal).innerHTML = `<aside class="media-detail-aside"><div class="media-detail-cover">${mediaCoverHtml(item)}</div>${item.noteUrl ? (state.isAdmin ? `<a class="media-note-link" href="${escapeHtml(item.noteUrl)}" target="_blank" rel="noopener noreferrer">打开相关笔记 ↗</a>` : '<button class="media-note-link media-note-locked" type="button" data-media-note-locked>相关笔记</button>') : ""}</aside><div class="media-detail-copy"><header class="media-detail-heading"><p class="mini-title">${escapeHtml(item.mediaType)}</p><h2>${escapeHtml(item.title)}</h2><div class="media-detail-meta"><strong>★ ${item.rating ? item.rating.toFixed(1) : "未评分"}</strong><time class="media-detail-date">${escapeHtml(formatWatchedDate(item))}</time>${item.people ? `<span>作者 / 演员：${escapeHtml(item.people)}</span>` : ""}</div></header>${reviewSection}${state.isAdmin ? `<button class="primary-button small media-detail-edit" type="button" data-edit-media-from-detail="${escapeHtml(item.id)}">编辑片单</button>` : ""}</div>`;
    $all("[data-media-detail-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    $("[data-media-note-locked]", modal)?.addEventListener("click", () => showActivityNotice("私人笔记", "私人笔记，暂时无法查看。"));
    $("[data-edit-media-from-detail]", modal)?.addEventListener("click", () => { modal.classList.remove("open"); openMediaEditor(item); });
    modal.classList.add("open");
  }

  function mediaDateOptions(start, end, label, selected = 0) {
    const values = [];
    for (let value = start; value <= end; value += 1) values.push(`<option value="${value}"${Number(selected) === value ? " selected" : ""}>${value}${label}</option>`);
    return `<option value="">${label === "年" ? "年份" : `不选${label}`}</option>${values.join("")}`;
  }

  function daysInMediaMonth(year, month) {
    return year && month ? new Date(year, month, 0).getDate() : 0;
  }

  async function persistMediaReview(mediaItemId, title, review, isPublic) {
    const existing = data.mediaReviews.find((item) => item.mediaItemId === mediaItemId);
    if (existing) {
      await window.XiaoLuoSupabase.updateContent("media_reviews", existing.id, state.userId, { review_title: title, review, is_public: isPublic });
      existing.title = title;
      existing.review = review;
      existing.isPublic = isPublic;
      return;
    }
    const row = await window.XiaoLuoSupabase.upsertMediaReview(state.userId, mediaItemId, title, review, isPublic);
    const cached = data.mediaReviews.find((item) => item.mediaItemId === mediaItemId);
    if (cached) {
      Object.assign(cached, { id: row.id, title: row.review_title || title, review: row.review || "", isPublic: row.is_public !== false });
    } else {
      data.mediaReviews.push({ id: row.id, mediaItemId: row.media_item_id, title: row.review_title || title, review: row.review || "", isPublic: row.is_public !== false });
    }
  }

  function openMediaEditor(item = null) {
    if (!state.isAdmin) return showAdminOnlyNotice();
    let modal = $("[data-media-editor-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal media-editor-modal";
      modal.dataset.mediaEditorModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-media-editor-close aria-label="关闭"></button><section class="modal-card glass-card media-editor-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-media-editor-close aria-label="关闭">×</button><p class="mini-title">MY MEDIA LIST</p><h2 data-media-editor-title>添加片单</h2><form data-media-editor-form><label>名称<input name="title" required placeholder="例如：一部电影或一本书"></label><div class="form-grid"><label>片单类型<select name="mediaType" data-media-editor-type></select></label><label>评分<input name="rating" type="number" min="0" max="10" step="0.1" placeholder="0.0 - 10.0"></label></div><label>作者 / 演员<input name="people" placeholder="例如：作者、导演或主要演员"></label><label>标签 <small>多个标签用逗号分隔</small><input name="tags" placeholder="例如：治愈、经典、科幻"></label><fieldset class="media-watch-field"><legend>观看时间</legend><div><select name="watchedYear" data-media-watch-year></select><select name="watchedMonth" data-media-watch-month></select><select name="watchedDay" data-media-watch-day></select></div></fieldset><label>笔记链接 <small>可填写本站或其他网站的相关笔记</small><input name="noteUrl" type="url" placeholder="https://example.com/my-note"></label><div class="form-grid"><label>观后感标题<input name="reviewTitle" maxlength="80" placeholder="例如：写给这部作品的一点感受"></label><label>观后感可见性<select name="reviewVisibility"><option value="public">公开</option><option value="private">私密</option></select><small>私密内容仅管理员可看</small></label></div><label>观后感内容<textarea name="review" rows="8" placeholder="记录自己的完整感受"></textarea></label><label class="upload-field"><span>上传封面图片</span><input name="cover" type="file" accept="image/*"></label><label>或使用封面 URL<input name="coverUrl" type="url" placeholder="https://example.com/cover.webp"></label><div class="media-editor-existing" data-media-editor-existing></div><div class="modal-form-actions"><button class="danger-button" type="button" data-delete-media-item hidden>删除</button><button class="primary-button" type="submit">保存片单</button></div></form></section>';
      document.body.appendChild(modal);
    }
    const form = $("[data-media-editor-form]", modal);
    $("[data-media-editor-title]", modal).textContent = item ? "编辑片单" : "添加片单";
    $("[data-media-editor-type]", form).innerHTML = mediaTypes().map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
    form.title.value = item?.title || "";
    form.mediaType.value = item?.mediaType || mediaTypes()[0];
    form.rating.value = item?.rating || "";
    form.people.value = item?.people || "";
    form.tags.value = (item?.tags || []).join(", ");
    form.noteUrl.value = item?.noteUrl || "";
    form.reviewTitle.value = item?.reviewTitle || "观后感";
    form.review.value = item?.review || "";
    form.reviewVisibility.value = item?.reviewPublic === false ? "private" : "public";
    const currentYear = new Date().getFullYear();
    form.watchedYear.innerHTML = mediaDateOptions(currentYear - 80, currentYear + 1, "年", item?.watchedYear);
    form.watchedMonth.innerHTML = mediaDateOptions(1, 12, "月", item?.watchedMonth);
    const refreshWatchDay = () => {
      const previous = Number(form.watchedDay.value) || item?.watchedDay || 0;
      const total = daysInMediaMonth(Number(form.watchedYear.value), Number(form.watchedMonth.value));
      form.watchedDay.innerHTML = mediaDateOptions(1, total, "日", previous);
      form.watchedDay.disabled = !total;
      form.watchedMonth.disabled = !form.watchedYear.value;
      if (!form.watchedYear.value) form.watchedMonth.value = "";
    };
    form.watchedYear.onchange = refreshWatchDay;
    form.watchedMonth.onchange = refreshWatchDay;
    refreshWatchDay();
    let removeCover = false;
    const existing = $("[data-media-editor-existing]", form);
    const drawCover = () => { existing.innerHTML = item?.coverUrl && !removeCover ? '<span>当前已有封面 <button type="button" data-remove-media-cover>删除封面</button></span>' : "<span>尚未设置封面</span>"; $("[data-remove-media-cover]", existing)?.addEventListener("click", () => { removeCover = true; drawCover(); }); };
    drawCover();
    const deleteButton = $("[data-delete-media-item]", form);
    deleteButton.hidden = !item;
    deleteButton.onclick = async () => {
      if (!item) return;
      try {
        await removeMediaItem(item);
        modal.classList.remove("open");
      } catch (error) { showCloudError(error); }
    };
    form.onsubmit = async (event) => {
      event.preventDefault();
      try {
        await runWithLoading("正在保存片单…", async () => {
          let coverUrl = removeCover ? "" : (item?.coverUrl || "");
          const manualCoverUrl = form.coverUrl.value.trim();
          if (manualCoverUrl && !/^https:\/\//i.test(manualCoverUrl)) throw new Error("封面 URL 必须以 https:// 开头。");
          if (manualCoverUrl) coverUrl = manualCoverUrl;
          else if (form.cover.files?.[0]) coverUrl = await uploadOptimizedImage(state.userId, "media-covers", form.cover.files[0]);
          const noteUrl = form.noteUrl.value.trim();
          if (noteUrl && !/^https:\/\//i.test(noteUrl)) throw new Error("笔记链接必须以 https:// 开头。");
          const reviewTitle = form.reviewTitle.value.trim() || "观后感";
          const tags = form.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
          const reviewPublic = form.reviewVisibility.value === "public";
          const payload = { title: form.title.value.trim(), media_type: form.mediaType.value, rating: Number(form.rating.value) || 0, tags, people: form.people.value.trim(), note_url: noteUrl || null, description: "", watched_year: Number(form.watchedYear.value) || null, watched_month: Number(form.watchedMonth.value) || null, watched_day: Number(form.watchedDay.value) || null, cover_url: coverUrl || null, review_is_public: reviewPublic };
          if (item) {
            state.cloudMutationVersion += 1;
            await window.XiaoLuoSupabase.updateContent("media_items", item.id, state.userId, payload);
            await persistMediaReview(item.id, reviewTitle, form.review.value.trim(), reviewPublic);
            if (item.coverUrl && item.coverUrl !== coverUrl) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([item.coverUrl]);
            Object.assign(item, { title: payload.title, mediaType: payload.media_type, rating: payload.rating, tags, people: payload.people, noteUrl: payload.note_url || "", reviewTitle, review: form.review.value.trim(), reviewPublic, watchedYear: payload.watched_year || 0, watchedMonth: payload.watched_month || 0, watchedDay: payload.watched_day || 0, coverUrl: payload.cover_url || "" });
          } else {
            state.cloudMutationVersion += 1;
            const row = await window.XiaoLuoSupabase.addContent("media_items", { user_id: state.userId, ...payload });
            await persistMediaReview(row.id, reviewTitle, form.review.value.trim(), reviewPublic);
            data.mediaItems.unshift({ id: row.id, title: row.title, mediaType: row.media_type, rating: Number(row.rating) || 0, tags: Array.isArray(row.tags) ? row.tags : tags, people: row.people || "", noteUrl: row.note_url || "", reviewTitle, review: form.review.value.trim(), reviewPublic, watchedYear: Number(row.watched_year) || 0, watchedMonth: Number(row.watched_month) || 0, watchedDay: Number(row.watched_day) || 0, coverUrl: row.cover_url || "", createdAt: row.created_at || "" });
          }
          modal.classList.remove("open"); renderMediaList();
        });
      } catch (error) { showCloudError(error); }
    };
    $all("[data-media-editor-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
  }

  function initQuickNotes() {
    if (document.body.dataset.quickNotesBound) return;
    document.body.dataset.quickNotesBound = "true";
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-open-notes]")) return;
      if (state.isAdmin) {
        state.notesReturnOpen = true;
        openNotesDesk();
      }
    });
  }

  function destroyNotesDesk() {
    const modal = $("[data-notes-desk-modal]");
    if (!modal) return;
    clearTimeout(Number(modal.dataset.notesAutosaveTimer || 0));
    if (modal.dataset.notesDirty === "true" && modal.dataset.notesSaving !== "true") {
      // Start the cloud write before detaching the old page. The guarded save
      // deliberately skips stale UI updates after navigation, not the write.
      void saveActiveNote(modal);
    }
    modal.remove();
  }

  async function openNotesDesk() {
    let modal = $("[data-notes-desk-modal]");
    if (modal && modal.dataset.notesOwnerId !== state.userId) {
      destroyNotesDesk();
      modal = null;
    }
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal notes-desk-modal";
      modal.dataset.notesDeskModal = "";
      modal.dataset.notesOwnerId = state.userId || "";
      modal.dataset.notesFolder = "all";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-notes-desk-close aria-label="关闭我的笔记"></button><section class="notes-desk glass-card" role="dialog" aria-modal="true" aria-label="我的笔记"><aside class="notes-sidebar"><div class="notes-sidebar-head"><strong>我的笔记</strong><button type="button" data-notes-new aria-label="新建笔记">+</button><button type="button" data-notes-desk-close aria-label="关闭笔记">×</button></div><label class="notes-search"><span>⌕</span><input type="search" data-notes-search placeholder="搜索笔记"></label><div class="notes-folders-head"><strong>文件夹</strong><button type="button" data-notes-new-folder aria-label="新建文件夹">+</button></div><div class="notes-folders" data-notes-folders></div><div class="notes-list" data-notes-desk-list></div></aside><section class="notes-editor" data-notes-editor></section></section>';
      document.body.appendChild(modal);
      bindNotesDesk(modal);
    }
    state.notesReturnOpen = true;
    modal.classList.add("open");
    const loadVersion = String(++state.notesLoadVersion);
    modal.dataset.notesLoadVersion = loadVersion;
    $("[data-notes-desk-list]", modal).innerHTML = '<p class="note-empty">正在同步笔记…</p>';
    try {
      const [rows, folderRows] = await Promise.all([
        window.XiaoLuoSupabase.listContent("notes", state.userId),
        window.XiaoLuoSupabase.listContent("note_folders", state.userId).catch(() => [])
      ]);
      if (!modal.isConnected || modal.dataset.notesLoadVersion !== loadVersion || modal.dataset.notesOwnerId !== state.userId) return;
      data.notes = rows.map((item) => ({ id: item.id, title: item.title, body: item.body || "", attachments: Array.isArray(item.attachments) ? item.attachments : [], isDone: Boolean(item.is_done), folder: item.folder || "", isPinned: Boolean(item.is_pinned), createdAt: item.created_at || "", updatedAt: item.updated_at || item.created_at || "" }));
      data.noteFolders = folderRows.map((item) => ({ id: item.id, name: item.name || "" })).filter((item) => item.name);
    } catch (error) {
      console.warn("Notes load failed:", error?.message || error);
      if (modal.isConnected && modal.dataset.notesLoadVersion === loadVersion) $("[data-notes-desk-list]", modal).innerHTML = '<p class="note-empty">笔记同步失败，请关闭后重试。</p>';
      return;
    }
    if (!modal.isConnected || modal.dataset.notesLoadVersion !== loadVersion) return;
    if (!data.notes.some((note) => String(note.id) === String(modal.dataset.activeNoteId))) modal.dataset.activeNoteId = String(data.notes[0]?.id || "");
    renderNotesDesk(modal);
  }

  function notePlainText(value) {
    const node = document.createElement("div");
    node.innerHTML = String(value || "");
    return (node.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function noteEditorHtml(value) {
    const source = String(value || "");
    if (/<\/?(?:a|b|strong|br|ol|ul|li|p|div)(?:\s|>)/i.test(source)) return sanitizeNoteHtml(source);
    return escapeHtml(source).replace(/\r?\n/g, "<br>");
  }

  function sanitizeNoteHtml(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value || "");
    holder.querySelectorAll(".note-box-block").forEach((box) => {
      box.replaceWith(document.createTextNode(box.textContent || ""));
    });
    holder.querySelectorAll("script,style,iframe,object,embed,svg,math").forEach((node) => node.remove());
    // Contenteditable creates DIV/P blocks for Enter. Keeping them preserves
    // the user's line breaks instead of merging the next line upward on save.
    const allowed = new Set(["A", "B", "STRONG", "BR", "OL", "UL", "LI", "P", "DIV"]);
    [...holder.querySelectorAll("*")].reverse().forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      if (node.tagName === "A") {
        const href = node.getAttribute("href") || "";
        if (!/^https?:\/\//i.test(href)) {
          node.replaceWith(document.createTextNode(node.textContent || ""));
          return;
        }
        node.replaceChildren(...node.childNodes);
        node.setAttribute("href", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
        node.setAttribute("contenteditable", "false");
      } else {
        [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
      }
    });
    return holder.innerHTML;
  }

  function noteCaretOffset(root) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !root.contains(selection.anchorNode)) return null;
    const range = selection.getRangeAt(0).cloneRange();
    const before = range.cloneRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString().length;
  }

  function restoreNoteCaret(root, offset) {
    if (offset === null || offset === undefined) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.textContent.length) {
        const range = document.createRange();
        range.setStart(node, Math.max(0, remaining));
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      remaining -= node.textContent.length;
      node = walker.nextNode();
    }
  }

  function linkifyNoteEditor(editor) {
    if (!editor) return false;
    const caret = noteCaretOffset(editor);
    const nodes = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest("a, textarea") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = walker.nextNode();
    while (node) { if (/https?:\/\/[^\s<]+/i.test(node.textContent || "")) nodes.push(node); node = walker.nextNode(); }
    if (!nodes.length) return false;
    nodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      const parts = (textNode.textContent || "").split(/(https?:\/\/[^\s<]+)/gi);
      parts.forEach((part) => {
        if (/^https?:\/\/[^\s<]+$/i.test(part)) {
          const link = document.createElement("a");
          link.href = part;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.contentEditable = "false";
          link.textContent = compactNoteLinkLabel(part);
          link.title = part;
          fragment.appendChild(link);
        } else fragment.appendChild(document.createTextNode(part));
      });
      textNode.replaceWith(fragment);
    });
    restoreNoteCaret(editor, caret);
    return true;
  }

  function compactNoteLinkLabel(value) {
    try {
      const url = new URL(value);
      const path = url.pathname.split("/").filter(Boolean)[0];
      return `${url.hostname.replace(/^www\./, "")}${path ? `/${path}/…` : ""}`;
    } catch (_) { return String(value).slice(0, 34); }
  }

  function setNotesSaveState(modal, value) {
    const target = $("[data-notes-save-state]", modal);
    if (!target) return;
    target.textContent = value;
    target.dataset.state = value === "已保存" ? "saved" : value === "未保存" ? "dirty" : "saving";
  }

  function renderNotesList(modal) {
    const search = $("[data-notes-search]", modal)?.value.trim().toLowerCase() || "";
    const folder = modal.dataset.notesFolder || "all";
    const notes = [...data.notes]
      .filter((note) => folder === "all" || (folder === "pinned" ? note.isPinned : (note.folder || "") === folder))
      .filter((note) => `${note.title} ${notePlainText(note.body)}`.toLowerCase().includes(search))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId)) || null;
    $("[data-notes-desk-list]", modal).innerHTML = notes.map((note) => `<button class="notes-list-item${String(note.id) === String(active?.id) ? " active" : ""}" type="button" data-notes-open="${escapeHtml(note.id)}"><strong>${note.isPinned ? '<i aria-label="置顶">⌃</i>' : ""}${escapeHtml(note.title || "未命名笔记")}</strong><span>${escapeHtml(notePlainText(note.body) || "空白笔记")}</span><time>${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</time></button>`).join("") || '<p class="note-empty">没有找到笔记。</p>';
    bindNotesListButtons(modal);
  }

  async function activateNote(modal, noteId) {
    if (!modal?.isConnected || !noteId) return;
    if (String(noteId) === String(modal.dataset.activeNoteId)) return;
    if (!data.notes.some((note) => String(note.id) === String(noteId))) return;
    // Flush the currently edited note first. saveActiveNote is guarded against
    // overlapping requests, so a slow network cannot redirect this click back
    // to the old note.
    await saveActiveNote(modal);
    if (!modal.isConnected || !data.notes.some((note) => String(note.id) === String(noteId))) return;
    modal.dataset.activeNoteId = String(noteId);
    renderNotesDesk(modal);
  }

  function bindNotesListButtons(modal) {
    const list = $("[data-notes-desk-list]", modal);
    if (!list || list.dataset.notesListBound === "true") return;
    list.dataset.notesListBound = "true";
    list.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-notes-open]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      await activateNote(modal, button.dataset.notesOpen);
    });
  }

  function renderNotesFolders(modal) {
    const activeFolder = modal.dataset.notesFolder || "all";
    const folders = [...new Set([...(data.noteFolders || []).map((item) => item.name), ...data.notes.map((note) => (note.folder || "").trim())].filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    $("[data-notes-folders]", modal).innerHTML = [`<button type="button" data-notes-folder="all" class="${activeFolder === "all" ? "active" : ""}">全部笔记 <span>${data.notes.length}</span></button>`, `<button type="button" data-notes-folder="pinned" class="${activeFolder === "pinned" ? "active" : ""}">置顶笔记 <span>${data.notes.filter((note) => note.isPinned).length}</span></button>`, ...folders.map((folder) => `<button type="button" data-notes-folder="${escapeHtml(folder)}" class="${activeFolder === folder ? "active" : ""}">⌁ ${escapeHtml(folder)} <span>${data.notes.filter((note) => note.folder === folder).length}</span></button>`)].join("");
  }

  function noteDownloadUrl(file) {
    try {
      const url = new URL(file.url, window.location.href);
      url.searchParams.set("download", file.name || "attachment");
      return url.toString();
    } catch (_) { return file.url; }
  }

  function syncNoteBoxValues(editor) {
    // Box blocks are independent contenteditable hosts; their current HTML is
    // already part of the editor DOM and is preserved by innerHTML.
  }

  function bindNotesBoxButton(modal) {
    const button = $("[data-notes-insert-box]", modal);
    if (!button || button.dataset.notesBoxBound === "true") return;
    button.dataset.notesBoxBound = "true";
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      insertNoteBoxBlock($("[data-notes-body]", modal));
      markNotesDirty(modal);
    });
  }

  function bindNotesBoxBlocks(modal) {
    // 浏览器原生 resize:both 会直接写 inline style，sanitizeNoteHtml 会保存。
    // 不再用 ResizeObserver 反复覆写，避免拖拽松手后被回弹。
    const editor = $("[data-notes-body]", modal);
    if (!editor) return;
    $all(".note-box-block", editor).forEach((box) => {
      if (box.dataset.noteBoxReady === "true") return;
      box.dataset.noteBoxReady = "true";
      // 拖拽结束后标记脏，触发自动保存
      box.addEventListener("mouseup", () => markNotesDirty(modal));
      box.addEventListener("touchend", () => markNotesDirty(modal));
    });
  }

  function renderNotesDesk(modal) {
    const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId)) || null;
    $("[data-notes-link-edit]", modal)?.remove();
    $("[data-notes-link-dialog]", modal)?.remove();
    renderNotesFolders(modal);
    renderNotesList(modal);
    const attachments = active?.attachments || [];
    const attachmentHtml = attachments.length ? `<div class="notes-attachments"><strong>附件</strong>${attachments.map((file, index) => `<span class="notes-attachment"><a href="${escapeHtml(noteDownloadUrl(file))}" download="${escapeHtml(file.name)}" target="_blank" rel="noopener">下载 ${escapeHtml(file.name)}</a><button type="button" data-notes-attachment-delete="${index}" aria-label="删除 ${escapeHtml(file.name)}">×</button></span>`).join("")}</div>` : "";
    $("[data-notes-editor]", modal).innerHTML = active ? `<div class="notes-editor-head"><input data-notes-title value="${escapeHtml(active.title)}" placeholder="笔记标题"><span class="notes-save-state" data-notes-save-state data-state="saved">已保存</span></div><div class="notes-editor-body" data-notes-body contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="写下一件临时要记住的事…">${noteEditorHtml(active.body)}</div>${attachmentHtml}<footer><div class="notes-editor-actions"><button class="notes-tool-button" type="button" data-notes-insert-box>盒子块</button><label class="notes-attach-button">添加附件<input type="file" multiple data-notes-files></label></div><button class="primary-button small" type="button" data-notes-save>立即保存</button></footer>` : '<div class="notes-empty-editor"><strong>选择一条笔记</strong><p>或点击左上角加号，新建一条备忘录。</p></div>';
    modal.dataset.notesDirty = "false";
    setNotesSaveState(modal, "已保存");
  }

  function markNotesDirty(modal) {
    modal.dataset.notesDirty = "true";
    modal.dataset.notesEditVersion = String(Number(modal.dataset.notesEditVersion || 0) + 1);
    setNotesSaveState(modal, "未保存");
    clearTimeout(Number(modal.dataset.notesAutosaveTimer || 0));
    modal.dataset.notesAutosaveTimer = String(window.setTimeout(() => saveActiveNote(modal), 700));
  }

  async function saveActiveNote(modal, files = []) {
    if (!modal?.isConnected || modal.dataset.notesOwnerId !== state.userId) return;
    const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId));
    if (!active) return;
    if (modal.dataset.notesSaving === "true") {
      modal.dataset.notesSaveQueued = "true";
      return;
    }
    const titleInput = $("[data-notes-title]", modal);
    const bodyEditor = $("[data-notes-body]", modal);
    const title = titleInput?.value.trim() || "未命名笔记";
    if (bodyEditor) {
      syncNoteBoxValues(bodyEditor);
      linkifyNoteEditor(bodyEditor);
    }
    const body = sanitizeNoteHtml(bodyEditor?.innerHTML || "");
    const changed = modal.dataset.notesDirty === "true" || files.length > 0;
    if (!changed) return;
    const saveVersion = Number(modal.dataset.notesEditVersion || 0);
    const activeId = active.id;
    const ownerId = state.userId;
    let saveFailed = false;
    modal.dataset.notesSaving = "true";
    setNotesSaveState(modal, files.length ? "正在上传附件…" : "保存中…");
    try {
      const uploaded = await Promise.all(files.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(ownerId, "note-attachments", file) })));
      const attachments = [...(active.attachments || []), ...uploaded];
      await window.XiaoLuoSupabase.updateContent("notes", active.id, ownerId, { title, body, attachments, folder: active.folder || "", is_pinned: Boolean(active.isPinned) });
      if (!modal.isConnected || modal.dataset.notesOwnerId !== ownerId || modal.dataset.activeNoteId !== activeId) return;
      active.title = title;
      active.body = body;
      active.attachments = attachments;
      active.updatedAt = new Date().toISOString();
      const changedWhileSaving = Number(modal.dataset.notesEditVersion || 0) !== saveVersion;
      modal.dataset.notesDirty = changedWhileSaving ? "true" : "false";
      setNotesSaveState(modal, changedWhileSaving ? "未保存" : "已保存");
      renderNotesList(modal);
      if (uploaded.length && !changedWhileSaving && String(active.id) === String(modal.dataset.activeNoteId)) renderNotesDesk(modal);
    } catch (error) {
      saveFailed = true;
      modal.dataset.notesDirty = "true";
      setNotesSaveState(modal, "未保存");
      showCloudError(error);
    } finally {
      modal.dataset.notesSaving = "false";
      if (!saveFailed && (modal.dataset.notesSaveQueued === "true" || modal.dataset.notesDirty === "true")) {
        modal.dataset.notesSaveQueued = "false";
        window.setTimeout(() => saveActiveNote(modal), 120);
      }
    }
  }

  async function deleteNoteAttachment(modal, index) {
    const active = data.notes.find((note) => note.id === modal.dataset.activeNoteId);
    const file = active?.attachments?.[index];
    if (!active || !file) return;
    if (!await confirmPublish("确认删除这个附件？", "删除后无法恢复。", "确认删除")) return;
    if (modal.dataset.notesSaving === "true") return;
    await saveActiveNote(modal);
    setNotesSaveState(modal, "正在删除附件…");
    const attachments = active.attachments.filter((_, itemIndex) => itemIndex !== index);
    try {
      await window.XiaoLuoSupabase.updateContent("notes", active.id, state.userId, { attachments });
      active.attachments = attachments;
      active.updatedAt = new Date().toISOString();
      await window.XiaoLuoSupabase.deleteFilesByPublicUrls?.([file.url]);
      renderNotesDesk(modal);
    } catch (error) {
      setNotesSaveState(modal, "未保存");
      showCloudError(error);
    }
  }

  async function deleteNoteFromDesk(modal, noteId) {
    const note = data.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;
    if (!await confirmPublish("确认删除这条笔记？", "删除后无法恢复。", "确认删除")) return;
    await window.XiaoLuoSupabase.deleteContent("notes", note.id, state.userId);
    data.notes = data.notes.filter((item) => String(item.id) !== String(note.id));
    modal.dataset.activeNoteId = String(data.notes[0]?.id || "");
    renderNotesDesk(modal);
  }

  async function updateNoteMetadata(modal, noteId, changes) {
    const note = data.notes.find((item) => String(item.id) === String(noteId));
    if (!note || !modal.isConnected) return;
    const nextFolder = changes.folder !== undefined ? String(changes.folder || "") : String(note.folder || "");
    const nextPinned = changes.is_pinned !== undefined ? Boolean(changes.is_pinned) : Boolean(note.isPinned);
    setNotesSaveState(modal, "保存中…");
    await window.XiaoLuoSupabase.updateContent("notes", note.id, state.userId, { folder: nextFolder, is_pinned: nextPinned });
    note.folder = nextFolder;
    note.isPinned = nextPinned;
    note.updatedAt = new Date().toISOString();
    renderNotesDesk(modal);
  }

  function showNotesContextMenu(modal, noteId, clientX, clientY) {
    $("[data-notes-context-menu]", modal)?.remove();
    const menu = document.createElement("div");
    menu.className = "notes-context-menu";
    menu.dataset.notesContextMenu = "";
    const note = data.notes.find((item) => String(item.id) === String(noteId));
    menu.style.left = `${Math.min(clientX, window.innerWidth - 205)}px`;
    menu.style.top = `${Math.min(clientY, window.innerHeight - 96)}px`;
    menu.innerHTML = `<button type="button" data-notes-context-pin="${escapeHtml(noteId)}">${note?.isPinned ? "取消置顶" : "置顶笔记"}</button><button type="button" data-notes-context-delete="${escapeHtml(noteId)}">删除笔记</button>`;
    modal.append(menu);
  }

  function openNotesFolderDialog(modal) {
    $("[data-notes-folder-dialog]", modal)?.remove();
    const dialog = document.createElement("form");
    dialog.className = "notes-folder-dialog";
    dialog.dataset.notesFolderDialog = "";
    dialog.innerHTML = '<strong>新建文件夹</strong><input name="folder" maxlength="30" placeholder="例如：学习计划" required autofocus><div><button type="button" data-notes-folder-cancel>取消</button><button class="primary-button small" type="submit">创建</button></div>';
    modal.append(dialog);
    $("input", dialog).focus();
    dialog.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = new FormData(dialog).get("folder")?.toString().trim();
      if (!name) return;
      if ((data.noteFolders || []).some((folder) => folder.name === name)) {
        modal.dataset.notesFolder = name;
        dialog.remove();
        renderNotesDesk(modal);
        return;
      }
      try {
        const row = await window.XiaoLuoSupabase.addContent("note_folders", { user_id: state.userId, name });
        data.noteFolders = [...(data.noteFolders || []), { id: row.id, name: row.name || name }];
        modal.dataset.notesFolder = name;
        dialog.remove();
        renderNotesDesk(modal);
      } catch (error) { showCloudError(error); }
    });
  }

  function insertNoteBoxBlock(editor) {
    if (!editor) return;
    const box = document.createElement("div");
    box.className = "note-box-block";
    box.setAttribute("contenteditable", "true");
    box.innerHTML = '<div class="note-box-content" contenteditable="true" aria-label="盒子块内容" spellcheck="true" data-placeholder="在这里输入内容…"></div>';
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const currentBox = anchorElement?.closest?.(".note-box-block");
    if (currentBox && editor.contains(currentBox)) currentBox.insertAdjacentElement("afterend", box);
    else editor.append(box);
    const range = document.createRange();
    const content = box.querySelector(".note-box-content");
    range.selectNodeContents(content || box);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    editor.focus();
    content?.focus();
  }

  function openNoteLinkEditor(modal, link) {
    if (!modal || !link || !modal.isConnected) return;
    $("[data-notes-link-dialog]", modal)?.remove();
    const dialog = document.createElement("form");
    dialog.className = "notes-link-dialog";
    dialog.dataset.notesLinkDialog = "";
    dialog.innerHTML = `<strong>编辑超链接</strong><label>显示名称<input name="label" value="${escapeHtml(link.textContent || "")}" required></label><label>链接地址<input name="url" type="url" value="${escapeHtml(link.href)}" required></label><div><button type="button" data-notes-link-cancel>取消</button><button class="primary-button small" type="submit">保存链接</button></div>`;
    modal.append(dialog);
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(dialog);
      const url = values.get("url")?.toString().trim() || "";
      if (!/^https?:\/\//i.test(url)) return;
      link.href = url;
      link.textContent = values.get("label")?.toString().trim() || compactNoteLinkLabel(url);
      link.title = url;
      dialog.remove();
      markNotesDirty(modal);
    });
    // Keep clicks and focus inside the floating editor; the notes desk has
    // delegated click handlers for links and note selection.
    dialog.addEventListener("pointerdown", (event) => event.stopPropagation());
    dialog.addEventListener("click", (event) => event.stopPropagation());
  }

  function bindNotesDesk(modal) {
    $all("[data-notes-desk-close]", modal).forEach((button) => {
      button.onclick = () => {
        state.notesReturnOpen = false;
        modal.classList.remove("open");
        $("[data-notes-context-menu]", modal)?.remove();
      };
    });
    $("[data-notes-search]", modal).addEventListener("input", () => renderNotesList(modal));
    modal.addEventListener("pointerdown", (event) => {
      const menu = $("[data-notes-context-menu]", modal);
      if (menu && !event.target.closest("[data-notes-context-menu]")) menu.remove();
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && $("[data-notes-context-menu]", modal)) {
        $("[data-notes-context-menu]", modal).remove();
        return;
      }
      if (!event.target.closest("[data-notes-editor]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveActiveNote(modal);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b" && event.target.closest("[data-notes-body]")) {
        event.preventDefault();
        document.execCommand("bold");
        markNotesDirty(modal);
      }
      if (event.key === "Enter" && event.target.matches("[data-notes-body]") && !event.target.closest("li")) {
        // Keep every normal line break as a BR. Native contenteditable starts
        // inserting DIV blocks after consecutive Enters, which creates uneven gaps.
        event.preventDefault();
        document.execCommand("insertLineBreak");
        markNotesDirty(modal);
      }
    });
    modal.addEventListener("input", (event) => {
      if (event.target.matches("[data-notes-title]") || event.target.closest?.("[data-notes-body]")) markNotesDirty(modal);
    });
    modal.addEventListener("blur", (event) => {
      if (!event.target.matches("[data-notes-body]")) return;
      if (linkifyNoteEditor(event.target)) markNotesDirty(modal);
    }, true);
    modal.addEventListener("change", (event) => {
      if (!event.target.matches("[data-notes-files]")) return;
      const files = [...event.target.files];
      if (files.length) {
        modal.dataset.notesEditVersion = String(Number(modal.dataset.notesEditVersion || 0) + 1);
        saveActiveNote(modal, files);
      }
      event.target.value = "";
    });
    modal.addEventListener("contextmenu", (event) => {
      const note = event.target.closest("[data-notes-open]");
      if (!note) return;
      event.preventDefault();
      showNotesContextMenu(modal, note.dataset.notesOpen, event.clientX, event.clientY);
    });
    let linkHideTimer = 0;
    const hideLinkEditorButton = () => {
      clearTimeout(linkHideTimer);
      linkHideTimer = window.setTimeout(() => $("[data-notes-link-edit]", modal)?.remove(), 180);
    };
    modal.addEventListener("pointerover", (event) => {
      const link = event.target.closest("[data-notes-body] a[href]");
      if (!link) return;
      clearTimeout(linkHideTimer);
      const old = $("[data-notes-link-edit]", modal);
      if (old?.dataset.notesLinkTarget === link.href && old._noteLink === link) return;
      old?.remove();
      const trigger = document.createElement("button");
      const rect = link.getBoundingClientRect();
      trigger.type = "button";
      trigger.className = "notes-link-edit-trigger";
      trigger.dataset.notesLinkEdit = "";
      trigger.dataset.notesLinkTarget = link.href;
      trigger.style.left = `${Math.min(rect.right + 7, window.innerWidth - 76)}px`;
      trigger.style.top = `${Math.max(rect.top - 2, 12)}px`;
      trigger.textContent = "编辑";
      trigger._noteLink = link;
      trigger.addEventListener("pointerenter", () => clearTimeout(linkHideTimer));
      trigger.addEventListener("pointerleave", hideLinkEditorButton);
      modal.append(trigger);
    });
    modal.addEventListener("pointerout", (event) => {
      if (event.target.closest("[data-notes-body] a[href]")) hideLinkEditorButton();
    });
    modal.addEventListener("click", async (event) => {
      const linkEdit = event.target.closest("[data-notes-link-edit]");
      if (linkEdit) { event.preventDefault(); event.stopPropagation(); openNoteLinkEditor(modal, linkEdit._noteLink); linkEdit.remove(); return; }
      if (event.target.closest("[data-notes-folder-cancel]")) { $("[data-notes-folder-dialog]", modal)?.remove(); return; }
      if (event.target.closest("[data-notes-link-cancel]")) { $("[data-notes-link-dialog]", modal)?.remove(); return; }
      if (event.target.closest("[data-notes-new-folder]")) { openNotesFolderDialog(modal); return; }
      const folderButton = event.target.closest("[data-notes-folder]");
      if (folderButton) { modal.dataset.notesFolder = folderButton.dataset.notesFolder; renderNotesDesk(modal); return; }
      const pin = event.target.closest("[data-notes-context-pin]");
      if (pin) {
        event.preventDefault();
        event.stopPropagation();
        try { const note = data.notes.find((item) => String(item.id) === String(pin.dataset.notesContextPin)); await updateNoteMetadata(modal, pin.dataset.notesContextPin, { is_pinned: !note?.isPinned }); } catch (error) { showCloudError(error); }
        $("[data-notes-context-menu]", modal)?.remove();
        return;
      }
      const contextDelete = event.target.closest("[data-notes-context-delete]");
      if (contextDelete) {
        event.preventDefault();
        event.stopPropagation();
        $("[data-notes-context-menu]", modal)?.remove();
        try { await deleteNoteFromDesk(modal, contextDelete.dataset.notesContextDelete); } catch (error) { showCloudError(error); }
        return;
      }
      if (!event.target.closest("[data-notes-context-menu]")) $("[data-notes-context-menu]", modal)?.remove();
      const noteLink = event.target.closest("[data-notes-body] a[href]");
      if (noteLink) {
        event.preventDefault();
        window.open(noteLink.href, "_blank", "noopener");
        return;
      }
      try {
        if (event.target.closest("[data-notes-insert-box]")) {
          event.preventDefault();
          event.stopPropagation();
          insertNoteBoxBlock($("[data-notes-body]", modal));
          markNotesDirty(modal);
          return;
        }
        const attachmentDelete = event.target.closest("[data-notes-attachment-delete]");
        if (attachmentDelete) {
          await deleteNoteAttachment(modal, Number(attachmentDelete.dataset.notesAttachmentDelete));
          return;
        }
        if (event.target.closest("[data-notes-new]")) {
          await saveActiveNote(modal);
          setNotesSaveState(modal, "正在新建…");
          const folder = ["all", "pinned"].includes(modal.dataset.notesFolder) ? "" : modal.dataset.notesFolder;
          const row = await window.XiaoLuoSupabase.addContent("notes", { user_id: state.userId, title: "未命名笔记", body: "", attachments: [], is_done: false, folder, is_pinned: false });
          const note = { id: row.id, title: row.title, body: row.body || "", attachments: Array.isArray(row.attachments) ? row.attachments : [], isDone: false, folder: row.folder || folder || "", isPinned: Boolean(row.is_pinned), createdAt: row.created_at || "", updatedAt: row.updated_at || row.created_at || "" };
          data.notes.unshift(note); modal.dataset.activeNoteId = String(note.id); renderNotesDesk(modal);
          return;
        }
        const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId));
        if (!active) return;
        if (event.target.closest("[data-notes-save]")) {
          await saveActiveNote(modal);
        }
      } catch (error) { showCloudError(error); }
    });
  }

  // Rebuilt notes desk: deliberately isolated from the retired rich-note
  // experiment above. The old editor mixed nested contenteditables, floating
  // controls and delegated pointer handlers, which could steal focus while
  // typing. This version owns one editable surface only.
  function notePlainText(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value || "");
    return (holder.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function sanitizeNoteHtml(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value || "");
    holder.querySelectorAll("script,style,iframe,object,embed,svg,math").forEach((node) => node.remove());
    const allowed = new Set(["A", "B", "STRONG", "U", "BR", "P", "DIV", "OL", "UL", "LI"]);
    [...holder.querySelectorAll("*")].reverse().forEach((node) => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      if (node.tagName === "A") {
        const href = node.getAttribute("href") || "";
        if (!/^https?:\/\//i.test(href)) {
          node.replaceWith(document.createTextNode(node.textContent || ""));
          return;
        }
        node.replaceChildren(...node.childNodes);
        node.setAttribute("href", href);
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      } else {
        [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
      }
    });
    return holder.innerHTML;
  }

  function noteEditorHtml(value) {
    const source = String(value || "");
    if (/<\/?(?:a|b|strong|u|br|p|div|ol|ul|li)(?:\s|>)/i.test(source)) return sanitizeNoteHtml(source);
    return escapeHtml(source).replace(/\r?\n/g, "<br>");
  }

  function setNotesSaveState(modal, value) {
    const target = $("[data-notes-save-state]", modal);
    if (!target) return;
    target.textContent = value;
    target.dataset.state = value === "已保存" ? "saved" : value === "未保存" ? "dirty" : "saving";
  }

  function renderNotesList(modal) {
    const list = $("[data-notes-desk-list]", modal);
    if (!list) return;
    const search = $("[data-notes-search]", modal)?.value.trim().toLowerCase() || "";
    const activeId = String(modal.dataset.activeNoteId || "");
    const notes = [...data.notes]
      .filter((note) => `${note.title} ${notePlainText(note.body)}`.toLowerCase().includes(search))
      .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    list.innerHTML = notes.map((note) => `<button class="notes-list-item${String(note.id) === activeId ? " active" : ""}" type="button" data-rebuilt-note-open="${escapeHtml(note.id)}"><strong>${note.isPinned ? '<i class="notes-pin-mark" title="已置顶" aria-label="已置顶">⌃</i>' : ""}${escapeHtml(note.title || "未命名笔记")}</strong><span>${escapeHtml(notePlainText(note.body) || "空白笔记")}</span><time>${new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</time></button>`).join("") || '<p class="note-empty">还没有笔记，点击加号新建一条。</p>';
  }

  function noteAttachmentHtml(note) {
    const attachments = Array.isArray(note?.attachments) ? note.attachments : [];
    if (!attachments.length) return "";
    return `<div class="notes-attachments"><strong>附件</strong>${attachments.map((file, index) => `<span class="notes-attachment"><a href="${escapeHtml(noteDownloadUrl(file))}" download="${escapeHtml(file.name || "attachment")}" target="_blank" rel="noopener">下载 ${escapeHtml(file.name || "附件")}</a><button type="button" data-rebuilt-note-file-delete="${index}" aria-label="删除附件">×</button></span>`).join("")}</div>`;
  }

  function renderNotesDesk(modal) {
    const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId)) || null;
    renderNotesList(modal);
    const editor = $("[data-notes-editor]", modal);
    if (!editor) return;
    if (!active) {
      editor.innerHTML = '<div class="notes-empty-editor"><strong>还没有选中笔记</strong><p>点击左上角加号，新建一条笔记。</p></div>';
      return;
    }
    editor.innerHTML = `<header class="notes-editor-head"><input data-notes-title value="${escapeHtml(active.title || "")}" placeholder="笔记标题"><span class="notes-save-state" data-notes-save-state data-state="saved">已保存</span></header><div class="notes-editor-tools" role="toolbar" aria-label="笔记编辑工具"><button class="notes-tool-button" type="button" data-rebuilt-note-bold title="加粗 Ctrl+B"><b>B</b></button><button class="notes-tool-button" type="button" data-rebuilt-note-underline title="下划线 Ctrl+U"><u>U</u></button><button class="notes-tool-button" type="button" data-rebuilt-note-link title="添加链接">链接</button></div><div class="notes-editor-body" data-notes-body contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" data-placeholder="粘贴网址会自动识别为可点击链接…">${noteEditorHtml(active.body)}</div>${noteAttachmentHtml(active)}<footer><label class="notes-attach-button">添加附件<input type="file" multiple data-rebuilt-note-files></label><button class="primary-button small" type="button" data-rebuilt-note-save>立即保存</button></footer>`;
    modal.dataset.notesDirty = "false";
    setNotesSaveState(modal, "已保存");
  }

  function markNotesDirty(modal) {
    if (!modal?.isConnected) return;
    modal.dataset.notesDirty = "true";
    modal.dataset.notesEditVersion = String(Number(modal.dataset.notesEditVersion || 0) + 1);
    setNotesSaveState(modal, "未保存");
    clearTimeout(Number(modal.dataset.notesAutosaveTimer || 0));
    modal.dataset.notesAutosaveTimer = String(window.setTimeout(() => void saveActiveNote(modal), 800));
  }

  function createEditableLink(editor, label, href, savedRange = null) {
    const selection = window.getSelection();
    const range = savedRange || (selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0) : null);
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    if (range) {
      range.deleteContents();
      range.insertNode(link);
      range.setStartAfter(link);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      editor.append(link);
    }
  }

  function linkifyNotes(editor) {
    if (!editor) return;
    const caret = noteCaretOffset(editor);
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.parentElement?.closest("a") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    const nodes = [];
    let node = walker.nextNode();
    while (node) { if (/https?:\/\/[^\s<]+/i.test(node.textContent || "")) nodes.push(node); node = walker.nextNode(); }
    nodes.forEach((textNode) => {
      const fragment = document.createDocumentFragment();
      (textNode.textContent || "").split(/(https?:\/\/[^\s<]+)/gi).forEach((part) => {
        if (/^https?:\/\/[^\s<]+$/i.test(part)) {
          const link = document.createElement("a");
          link.href = part; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = part;
          fragment.append(link);
        } else fragment.append(document.createTextNode(part));
      });
      textNode.replaceWith(fragment);
    });
    restoreNoteCaret(editor, caret);
  }

  function openBasicNoteLinkDialog(modal, existingLink = null) {
    const editor = $("[data-notes-body]", modal);
    if (!editor) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0).cloneRange() : null;
    const selectedText = existingLink?.textContent?.trim() || range?.toString().trim() || "";
    const dialog = document.createElement("form");
    dialog.className = "notes-link-dialog";
    dialog.dataset.rebuiltNotesLinkDialog = "";
    dialog._notesRange = range;
    dialog.innerHTML = `<strong>编辑超链接</strong><label>显示名称<input name="label" value="${escapeHtml(selectedText)}" placeholder="例如：我的网站" required></label><label>链接地址<input name="url" type="url" value="${escapeHtml(existingLink?.getAttribute("href") || "")}" placeholder="https://example.com" required></label><div><button type="button" data-rebuilt-note-link-cancel>取消</button><button class="primary-button small" type="submit">保存链接</button></div>`;
    // Keep the link form at document level. As a child of the notes modal it
    // can still sit inside the editor's stacking and delegated-event tree on
    // some browsers, which makes the fields look open but not focusable.
    document.body.append(dialog);
    // The editor uses delegated pointer handlers. Keep the small dialog out
    // of that event path so its native inputs retain focus on a normal click.
    ["pointerdown", "mousedown", "click"].forEach((eventName) => dialog.addEventListener(eventName, (event) => event.stopPropagation()));
    $("[data-rebuilt-note-link-cancel]", dialog)?.addEventListener("click", () => dialog.remove());
    window.requestAnimationFrame(() => $("input[name='label']", dialog)?.focus({ preventScroll: true }));
    dialog.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(dialog);
      const label = String(form.get("label") || "").trim();
      const url = String(form.get("url") || "").trim();
      if (!label || !/^https?:\/\//i.test(url)) return;
      if (existingLink?.isConnected) {
        existingLink.href = url;
        existingLink.textContent = label;
        existingLink.title = url;
      } else createEditableLink(editor, label, url, dialog._notesRange);
      dialog.remove();
      editor.focus();
      markNotesDirty(modal);
    });
  }

  async function saveActiveNote(modal, files = []) {
    if (!modal?.isConnected || modal.dataset.notesOwnerId !== state.userId) return;
    const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId));
    if (!active) return;
    if (modal.dataset.notesSaving === "true") { modal.dataset.notesSaveQueued = "true"; return; }
    const titleInput = $("[data-notes-title]", modal);
    const editor = $("[data-notes-body]", modal);
    const changed = modal.dataset.notesDirty === "true" || files.length > 0;
    if (!changed) return;
    // Do not rewrite the editable DOM while the user is still typing. Replacing
    // a URL text node during an autosave makes browsers recalculate the caret
    // and can jump it back to the previous line. Links are normalized on blur
    // instead, before the following save.
    if (document.activeElement !== editor) linkifyNotes(editor);
    const title = titleInput?.value.trim() || "未命名笔记";
    const body = sanitizeNoteHtml(editor?.innerHTML || "");
    const version = Number(modal.dataset.notesEditVersion || 0);
    const noteId = active.id;
    modal.dataset.notesSaving = "true";
    setNotesSaveState(modal, files.length ? "正在上传附件…" : "保存中…");
    try {
      const uploaded = await Promise.all(files.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "note-attachments", file) })));
      const attachments = [...(active.attachments || []), ...uploaded];
      await window.XiaoLuoSupabase.updateContent("notes", noteId, state.userId, { title, body, attachments, folder: "", is_pinned: Boolean(active.isPinned) });
      const current = data.notes.find((note) => String(note.id) === String(noteId));
      if (current) Object.assign(current, { title, body, attachments, updatedAt: new Date().toISOString() });
      const changedAgain = Number(modal.dataset.notesEditVersion || 0) !== version;
      modal.dataset.notesDirty = changedAgain ? "true" : "false";
      setNotesSaveState(modal, changedAgain ? "未保存" : "已保存");
      renderNotesList(modal);
      if (uploaded.length && String(modal.dataset.activeNoteId) === String(noteId) && !changedAgain) renderNotesDesk(modal);
    } catch (error) {
      modal.dataset.notesDirty = "true";
      setNotesSaveState(modal, "未保存");
      showCloudError(error);
    } finally {
      modal.dataset.notesSaving = "false";
      if (modal.dataset.notesSaveQueued === "true" || modal.dataset.notesDirty === "true") {
        modal.dataset.notesSaveQueued = "false";
        window.setTimeout(() => void saveActiveNote(modal), 160);
      }
    }
  }

  async function openNotesDesk() {
    let modal = $("[data-notes-desk-modal]");
    if (modal && modal.dataset.notesOwnerId !== state.userId) { modal.remove(); modal = null; }
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal notes-desk-modal";
      modal.dataset.notesDeskModal = "";
      modal.dataset.notesOwnerId = state.userId || "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-rebuilt-notes-close aria-label="关闭我的笔记"></button><section class="notes-desk glass-card" role="dialog" aria-modal="true" aria-label="我的笔记"><aside class="notes-sidebar"><div class="notes-sidebar-head"><strong>我的笔记</strong><button type="button" data-rebuilt-notes-new aria-label="新建笔记">+</button><button type="button" data-rebuilt-notes-close aria-label="关闭笔记">×</button></div><label class="notes-search"><span>⌕</span><input type="search" data-notes-search placeholder="搜索笔记"></label><div class="notes-list" data-notes-desk-list></div></aside><section class="notes-editor" data-notes-editor></section></section>';
      document.body.append(modal);
      bindNotesDesk(modal);
    }
    state.notesReturnOpen = true;
    modal.classList.add("open");
    const loadVersion = String(++state.notesLoadVersion);
    modal.dataset.notesLoadVersion = loadVersion;
    $("[data-notes-desk-list]", modal).innerHTML = '<p class="note-empty">正在加载笔记…</p>';
    try {
      const rows = await window.XiaoLuoSupabase.listContent("notes", state.userId);
      if (!modal.isConnected || modal.dataset.notesLoadVersion !== loadVersion) return;
      data.notes = rows.map((item) => ({ id: item.id, title: item.title || "", body: item.body || "", attachments: Array.isArray(item.attachments) ? item.attachments : [], isPinned: Boolean(item.is_pinned), createdAt: item.created_at || "", updatedAt: item.updated_at || item.created_at || "" }));
      if (!data.notes.some((note) => String(note.id) === String(modal.dataset.activeNoteId))) modal.dataset.activeNoteId = String(data.notes[0]?.id || "");
      renderNotesDesk(modal);
    } catch (error) {
      if (modal.isConnected && modal.dataset.notesLoadVersion === loadVersion) $("[data-notes-desk-list]", modal).innerHTML = '<p class="note-empty">笔记加载失败，请关闭后重试。</p>';
      console.warn("Notes load failed:", error);
    }
  }

  function showRebuiltNotesContextMenu(modal, noteId, clientX, clientY) {
    $("[data-rebuilt-notes-menu]", modal)?.remove();
    const note = data.notes.find((item) => String(item.id) === String(noteId));
    if (!note) return;
    const menu = document.createElement("div");
    menu.className = "notes-context-menu";
    menu.dataset.rebuiltNotesMenu = "";
    menu.dataset.noteId = String(note.id);
    menu.style.left = `${Math.min(clientX, window.innerWidth - 210)}px`;
    menu.style.top = `${Math.min(clientY, window.innerHeight - 110)}px`;
    menu.innerHTML = `<button type="button" data-rebuilt-note-pin>${note.isPinned ? "取消置顶笔记" : "置顶笔记"}</button><button type="button" data-rebuilt-note-delete>删除笔记</button>`;
    modal.append(menu);
  }

  function bindNotesDesk(modal) {
    $all("[data-rebuilt-notes-close]", modal).forEach((button) => {
      button.addEventListener("click", () => {
        state.notesReturnOpen = false;
        modal.classList.remove("open");
        $("[data-rebuilt-notes-link-dialog]")?.remove();
      });
    });
    $("[data-notes-search]", modal).addEventListener("input", () => renderNotesList(modal));
    modal.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-rebuilt-notes-menu]")) $("[data-rebuilt-notes-menu]", modal)?.remove();
      if (event.target.closest("[data-rebuilt-note-bold], [data-rebuilt-note-underline], [data-rebuilt-note-link]")) event.preventDefault();
    });
    modal.addEventListener("contextmenu", (event) => {
      const item = event.target.closest("[data-rebuilt-note-open]");
      if (!item) return;
      event.preventDefault();
      showRebuiltNotesContextMenu(modal, item.dataset.rebuiltNoteOpen, event.clientX, event.clientY);
    });
    modal.addEventListener("input", (event) => {
      if (event.target.matches("[data-notes-title]") || event.target.matches("[data-notes-body]")) markNotesDirty(modal);
    });
    modal.addEventListener("paste", (event) => {
      const editor = event.target.closest("[data-notes-body]");
      if (!editor) return;
      const pastedText = event.clipboardData?.getData("text/plain") || "";
      if (!/https?:\/\/[^\s]+/i.test(pastedText)) return;
      // Let the browser insert the text first, then turn pasted URLs into
      // links while keeping the caret at the same text offset.
      window.setTimeout(() => { if (editor.isConnected) { linkifyNotes(editor); markNotesDirty(modal); } }, 0);
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const menu = $("[data-rebuilt-notes-menu]", modal);
        if (menu) { menu.remove(); return; }
      }
      const editor = event.target.closest("[data-notes-body]");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveActiveNote(modal); return; }
      if (!editor) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") { event.preventDefault(); document.execCommand("bold"); markNotesDirty(modal); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u") { event.preventDefault(); document.execCommand("underline"); markNotesDirty(modal); }
    });
    modal.addEventListener("blur", (event) => {
      if (event.target.matches("[data-notes-body]")) { linkifyNotes(event.target); markNotesDirty(modal); }
    }, true);
    modal.addEventListener("click", async (event) => {
      // Links live inside a contenteditable surface. Browsers treat a normal
      // click there as caret placement instead of navigation, especially when
      // the link has custom display text. Handle every saved note link here so
      // both auto-detected URLs and custom-name links open consistently.
      const noteLink = event.target.closest("[data-notes-body] a[href]");
      if (noteLink) {
        event.preventDefault();
        event.stopPropagation();
        const href = noteLink.getAttribute("href") || noteLink.href;
        if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      const pinButton = event.target.closest("[data-rebuilt-note-pin]");
      if (pinButton) {
        const note = data.notes.find((item) => String(item.id) === String(pinButton.closest("[data-rebuilt-notes-menu]")?.dataset.noteId));
        if (!note) return;
        try {
          await window.XiaoLuoSupabase.updateContent("notes", note.id, state.userId, { is_pinned: !note.isPinned });
          note.isPinned = !note.isPinned;
          $("[data-rebuilt-notes-menu]", modal)?.remove();
          renderNotesList(modal);
        } catch (error) { showCloudError(error); }
        return;
      }
      const deleteNoteButton = event.target.closest("[data-rebuilt-note-delete]");
      if (deleteNoteButton) {
        const note = data.notes.find((item) => String(item.id) === String(deleteNoteButton.closest("[data-rebuilt-notes-menu]")?.dataset.noteId));
        $("[data-rebuilt-notes-menu]", modal)?.remove();
        if (!note || !await confirmPublish("确认删除这条笔记？", "删除后无法恢复。", "确认删除")) return;
        try {
          await window.XiaoLuoSupabase.deleteContent("notes", note.id, state.userId);
          await window.XiaoLuoSupabase.deleteFilesByPublicUrls?.((note.attachments || []).map((file) => file.url).filter(Boolean));
          data.notes = data.notes.filter((item) => String(item.id) !== String(note.id));
          modal.dataset.activeNoteId = String(data.notes[0]?.id || "");
          renderNotesDesk(modal);
        } catch (error) { showCloudError(error); }
        return;
      }
      if (event.target.closest("[data-rebuilt-note-link-cancel]")) { $("[data-rebuilt-notes-link-dialog]")?.remove(); return; }
      if (event.target.closest("[data-rebuilt-note-bold]")) { document.execCommand("bold"); $("[data-notes-body]", modal)?.focus(); markNotesDirty(modal); return; }
      if (event.target.closest("[data-rebuilt-note-underline]")) { document.execCommand("underline"); $("[data-notes-body]", modal)?.focus(); markNotesDirty(modal); return; }
      if (event.target.closest("[data-rebuilt-note-link]")) { openBasicNoteLinkDialog(modal); return; }
      const open = event.target.closest("[data-rebuilt-note-open]");
      if (open) {
        const nextId = String(open.dataset.rebuiltNoteOpen);
        if (nextId !== String(modal.dataset.activeNoteId)) {
          await saveActiveNote(modal);
          modal.dataset.activeNoteId = nextId;
          renderNotesDesk(modal);
        }
        return;
      }
      if (event.target.closest("[data-rebuilt-notes-new]")) {
        await saveActiveNote(modal);
        const row = await window.XiaoLuoSupabase.addContent("notes", { user_id: state.userId, title: "未命名笔记", body: "", attachments: [], is_done: false, folder: "", is_pinned: false });
        data.notes.unshift({ id: row.id, title: row.title || "未命名笔记", body: row.body || "", attachments: Array.isArray(row.attachments) ? row.attachments : [], isPinned: Boolean(row.is_pinned), createdAt: row.created_at || "", updatedAt: row.updated_at || row.created_at || "" });
        modal.dataset.activeNoteId = String(row.id);
        renderNotesDesk(modal);
        $("[data-notes-title]", modal)?.focus();
        return;
      }
      if (event.target.closest("[data-rebuilt-note-save]")) { await saveActiveNote(modal); return; }
      const remove = event.target.closest("[data-rebuilt-note-file-delete]");
      if (remove) {
        const active = data.notes.find((note) => String(note.id) === String(modal.dataset.activeNoteId));
        const index = Number(remove.dataset.rebuiltNoteFileDelete);
        const file = active?.attachments?.[index];
        if (!active || !file || !await confirmPublish("确认删除这个附件？", "删除后无法恢复。", "确认删除")) return;
        const attachments = active.attachments.filter((_, itemIndex) => itemIndex !== index);
        await window.XiaoLuoSupabase.updateContent("notes", active.id, state.userId, { attachments });
        active.attachments = attachments;
        await window.XiaoLuoSupabase.deleteFilesByPublicUrls?.([file.url]);
        renderNotesDesk(modal);
      }
    });
    modal.addEventListener("change", (event) => {
      if (!event.target.matches("[data-rebuilt-note-files]")) return;
      const files = [...event.target.files];
      if (files.length) { modal.dataset.notesDirty = "true"; void saveActiveNote(modal, files); }
      event.target.value = "";
    });
  }

  function initQuickSites() {
    if (document.body.dataset.quickSitesBound) return;
    document.body.dataset.quickSitesBound = "true";
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-open-common-sites]")) return;
      if (!state.isLoggedIn) { requireLogin("请先登录后再查看常用网站。"); return; }
      openCommonSitesDesk();
    });
  }

  async function openCommonSitesDesk() {
    let modal = $("[data-common-sites-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal common-sites-modal";
      modal.dataset.commonSitesModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-common-sites-close aria-label="关闭常用网站"></button><section class="common-sites-desk glass-card" role="dialog" aria-modal="true" aria-label="常用网站"><header><div><p class="mini-title">COMMON SITES</p><h2>常用网站</h2></div><button type="button" data-common-sites-close aria-label="关闭常用网站">×</button></header><div class="common-sites-layout"><form class="common-site-form" data-common-site-form><input name="title" placeholder="网站名称" required><label class="common-site-url-input"><span aria-hidden="true">↗</span><input name="url" type="url" placeholder="网址，例如 https://example.com" required></label><textarea name="description" rows="4" placeholder="一句简介（可选）"></textarea><input name="iconUrl" type="url" placeholder="图标图片 URL（可选）"><label class="upload-field"><span>或上传网站图标（可选，上传后优先使用）</span><input name="icon" type="file" accept="image/*"></label><div><button class="ghost-button" type="button" data-common-site-reset>新建</button><button class="primary-button small" type="submit">保存网站</button></div></form><div class="common-sites-list" data-common-sites-list></div></div></section>';
      document.body.appendChild(modal);
      bindCommonSitesDesk(modal);
    }
    if (!data.commonSites.length) {
      try {
        const rows = await window.XiaoLuoSupabase.listContent("common_sites", state.cloudOwnerId || state.adminId);
        data.commonSites = rows.map((item) => ({ id: item.id, title: item.title, url: item.url, description: item.description || "", iconUrl: item.icon_url || "", createdAt: item.created_at || "" }));
      } catch (_) { /* SQL 尚未执行时显示空状态。 */ }
    }
    modal.resetCommonSiteForm?.();
    $("[data-common-site-form]", modal).hidden = !state.isAdmin;
    $(".common-sites-layout", modal).classList.toggle("viewer-mode", !state.isAdmin);
    renderCommonSitesDesk(modal);
    modal.classList.add("open");
  }

  function renderCommonSitesDesk(modal) {
    const list = $("[data-common-sites-list]", modal);
    list.innerHTML = data.commonSites.map((site) => `<article class="common-site-row"><button class="common-site-open" type="button" data-common-site-open="${escapeHtml(site.id)}">${site.iconUrl ? `<img src="${escapeHtml(site.iconUrl)}" alt="">` : '<span>⌘</span>'}<div><strong>${escapeHtml(site.title)}</strong><p>${escapeHtml(site.description || site.url)}</p></div></button><div><button class="common-site-link-button" type="button" data-common-site-open="${escapeHtml(site.id)}" title="打开网址" aria-label="打开 ${escapeHtml(site.title)}">↗</button>${state.isAdmin ? `<button type="button" data-common-site-edit="${escapeHtml(site.id)}">编辑</button><button type="button" data-common-site-delete="${escapeHtml(site.id)}">×</button>` : ""}</div></article>`).join("") || '<p class="note-empty">还没有添加常用网站。</p>';
  }

  function bindCommonSitesDesk(modal) {
    const form = $("[data-common-site-form]", modal);
    const submitButton = $("button[type='submit']", form);
    const reset = () => {
      form.reset();
      form.removeAttribute("data-site-id");
      delete form.dataset.siteId;
      if (submitButton) submitButton.textContent = "添加网站";
    };
    modal.resetCommonSiteForm = reset;
    $all("[data-common-sites-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    $("[data-common-site-reset]", modal).onclick = reset;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const title = form.title.value.trim();
      const url = form.url.value.trim();
      if (!title || !url) return;
      const siteId = form.getAttribute("data-site-id") || null;
      const old = data.commonSites.find((site) => site.id === siteId);
      try {
        await runWithLoading("正在保存常用网站…", async () => {
          let iconUrl = form.iconUrl.value.trim() || old?.iconUrl || "";
          if (form.icon.files?.[0]) iconUrl = await uploadOptimizedImage(state.userId, "common-site-icons", form.icon.files[0], { maxDimension: 512, quality: .8 });
          const payload = { title, url, description: form.description.value.trim(), icon_url: iconUrl || null };
          if (old) {
            state.cloudMutationVersion += 1;
            await window.XiaoLuoSupabase.updateContent("common_sites", old.id, state.userId, payload);
            if (old.iconUrl && old.iconUrl !== iconUrl) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([old.iconUrl]);
            Object.assign(old, { title, url, description: payload.description, iconUrl });
          } else {
            state.cloudMutationVersion += 1;
            const row = await window.XiaoLuoSupabase.addContent("common_sites", { user_id: state.userId, ...payload });
            data.commonSites.unshift({ id: row.id, title: row.title, url: row.url, description: row.description || "", iconUrl: row.icon_url || "", createdAt: row.created_at || "" });
          }
          reset(); renderCommonSitesDesk(modal);
        });
      } catch (error) { showCloudError(error); }
    });
    modal.addEventListener("click", async (event) => {
      const open = event.target.closest("[data-common-site-open]");
      const edit = event.target.closest("[data-common-site-edit]");
      const remove = event.target.closest("[data-common-site-delete]");
      const id = open?.dataset.commonSiteOpen || edit?.dataset.commonSiteEdit || remove?.dataset.commonSiteDelete;
      const site = data.commonSites.find((item) => item.id === id);
      if (!site) return;
      if (open) { window.open(site.url, "_blank", "noopener"); return; }
      if (edit) {
        form.dataset.siteId = site.id;
        form.title.value = site.title;
        form.url.value = site.url;
        form.description.value = site.description || "";
        form.iconUrl.value = site.iconUrl || "";
        if (submitButton) submitButton.textContent = "保存修改";
        return;
      }
      if (remove) {
        if (!await confirmPublish("确认删除这个常用网站？", "删除后无法恢复。", "确认删除")) return;
        try {
          await window.XiaoLuoSupabase.deleteContent("common_sites", site.id, state.userId);
          if (site.iconUrl) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([site.iconUrl]);
          data.commonSites = data.commonSites.filter((item) => item.id !== site.id);
          if (form.dataset.siteId === site.id) reset();
          renderCommonSitesDesk(modal);
        } catch (error) { showCloudError(error); }
      }
    });
  }

  function openProjectDetail(project) {
    let modal = $("[data-project-detail-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal project-detail-modal";
      modal.dataset.projectDetailModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-project-detail-close aria-label="关闭"></button><section class="modal-card glass-card project-detail-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-project-detail-close aria-label="关闭">×</button><div data-project-detail-content></div></section>';
      document.body.appendChild(modal);
    }
    const attachments = (project.attachments || []).map((file) => `<a href="${escapeHtml(file.url)}" data-protected-download download="${escapeHtml(file.name || "项目附件")}" class="project-attachment">下载：${escapeHtml(file.name || "项目附件")}</a>`).join("") || '<p class="comment-empty">这个项目暂时没有附件。</p>';
    const url = /^https?:\/\//i.test(project.projectUrl || "") ? `<a class="primary-button small" href="${escapeHtml(project.projectUrl)}" target="_blank" rel="noopener">访问项目网址</a>` : "";
    $("[data-project-detail-content]", modal).innerHTML = `<div class="project-detail-cover">${projectCoverHtml(project)}</div><p class="mini-title">PERSONAL PROJECT</p><h2>${escapeHtml(project.title)}</h2><p class="project-detail-description">${escapeHtml(project.description || "暂时没有项目简介。")}</p><div class="project-detail-actions">${url}</div><section class="project-attachments"><h3>项目附件</h3>${attachments}</section>`;
    $all("[data-project-detail-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
  }

  function initProjectManagement() {
    const form = $("[data-project-form]");
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.isAdmin) return showAdminOnlyNotice();
        const title = form.title.value.trim();
        if (!title) return;
        if (!await confirmPublish("确认发布个人项目？", "项目详情、封面和附件会立即保存并对访客可见。")) return;
        try {
          await runWithLoading("正在上传项目资料，请稍候…", async (cancelled) => {
            const coverFile = form.cover?.files?.[0];
            const coverUrl = coverFile ? await uploadOptimizedImage(state.userId, "project-covers", coverFile) : "";
            if (cancelled()) return;
            const files = Array.from(form.attachments?.files || []);
            const attachments = await Promise.all(files.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "project-attachments", file) })));
            if (cancelled()) return;
            const row = await window.XiaoLuoSupabase.addContent("projects", { user_id: state.userId, title, description: form.description.value.trim(), cover_url: coverUrl || null, project_url: form.projectUrl.value.trim() || null, attachments });
            data.projects.unshift({ id: row.id, title: row.title, description: row.description || "", coverUrl: row.cover_url || "", projectUrl: row.project_url || "", attachments: row.attachments || [], createdAt: row.created_at || "" });
            form.reset();
            renderProjects();
            renderContentManagers();
            alert("已保存。");
          });
        } catch (error) { showCloudError(error); }
      });
    }
    if (document.body.dataset.projectManagementBound) return;
    document.body.dataset.projectManagementBound = "true";
    document.addEventListener("click", async (event) => {
      const remove = event.target.closest("[data-remove-project]");
      const edit = event.target.closest("[data-edit-project]");
      if (!remove && !edit) return;
      const id = (remove || edit).dataset.removeProject || (remove || edit).dataset.editProject;
      const project = data.projects.find((item) => item.id === id);
      if (!project || !state.isAdmin) return;
      try {
        if (remove) {
          if (!await confirmPublish("确认删除个人项目？", "封面和附件也会一并删除，且无法恢复。", "确认删除")) return;
          const urls = [project.coverUrl, ...(project.attachments || []).map((item) => item.url)].filter(Boolean);
          if (urls.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(urls);
          await window.XiaoLuoSupabase.deleteContent("projects", id, state.userId);
          data.projects = data.projects.filter((item) => item.id !== id);
          renderProjects();
          renderContentManagers();
          return;
        }
        openProjectEditor(project);
      } catch (error) { showCloudError(error); }
    });
  }

  function openProjectEditor(project) {
    let modal = $("[data-project-editor-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal project-editor-modal";
      modal.dataset.projectEditorModal = "";
      modal.innerHTML = '<button class="modal-backdrop" type="button" data-project-editor-close aria-label="关闭"></button><section class="modal-card glass-card project-editor-card" role="dialog" aria-modal="true"><button class="modal-close" type="button" data-project-editor-close aria-label="关闭">×</button><p class="mini-title">EDIT PROJECT</p><h2>编辑个人项目</h2><form data-project-editor-form><input name="title" required><input name="projectUrl" type="url" placeholder="项目网址"><textarea name="description" rows="5" placeholder="项目简介"></textarea><label class="upload-field"><span>替换项目封面（可选）</span><input name="cover" type="file" accept="image/*"></label><label class="upload-field"><span>追加附件（可多选）</span><input name="attachments" type="file" multiple></label><div class="project-editor-existing" data-project-editor-existing></div><button class="primary-button" type="submit">保存修改</button></form></section>';
      document.body.appendChild(modal);
    }
    const form = $("[data-project-editor-form]", modal);
    form.title.value = project.title || "";
    form.projectUrl.value = project.projectUrl || "";
    form.description.value = project.description || "";
    let editableAttachments = [...(project.attachments || [])];
    let removeCover = false;
    const drawExisting = () => {
      const attachmentRows = editableAttachments.map((file, index) => `<span>${escapeHtml(file.name || "项目附件")}<button type="button" data-remove-project-attachment="${index}">删除</button></span>`).join("");
      const coverRow = project.coverUrl && !removeCover ? '<p>当前已有封面 <button type="button" data-remove-project-cover>删除封面</button></p>' : "<p>暂未设置封面</p>";
      $("[data-project-editor-existing]", form).innerHTML = `${coverRow}${attachmentRows || "<p>暂时没有附件。</p>"}`;
      $("[data-remove-project-cover]", form)?.addEventListener("click", () => { removeCover = true; drawExisting(); });
      $all("[data-remove-project-attachment]", form).forEach((button) => { button.onclick = () => { editableAttachments.splice(Number(button.dataset.removeProjectAttachment), 1); drawExisting(); }; });
    };
    drawExisting();
    form.onsubmit = async (event) => {
      event.preventDefault();
      try {
        await runWithLoading("正在保存项目修改…", async () => {
          const oldCoverUrl = project.coverUrl || "";
          let coverUrl = removeCover ? "" : oldCoverUrl;
          if (form.cover.files?.[0]) {
            coverUrl = await uploadOptimizedImage(state.userId, "project-covers", form.cover.files[0]);
          }
          const added = await Promise.all(Array.from(form.attachments.files || []).map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "project-attachments", file) })));
          const removedAttachments = (project.attachments || []).filter((file) => !editableAttachments.some((item) => item.url === file.url));
          const payload = { title: form.title.value.trim(), description: form.description.value.trim(), project_url: form.projectUrl.value.trim() || null, cover_url: coverUrl || null, attachments: [...editableAttachments, ...added] };
          await window.XiaoLuoSupabase.updateContent("projects", project.id, state.userId, payload);
          const staleUrls = [...removedAttachments.map((file) => file.url), ...(oldCoverUrl && oldCoverUrl !== coverUrl ? [oldCoverUrl] : [])];
          if (staleUrls.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(staleUrls);
          Object.assign(project, { title: payload.title, description: payload.description, projectUrl: payload.project_url || "", coverUrl: payload.cover_url || "", attachments: payload.attachments });
          renderProjects();
          renderContentManagers();
          modal.classList.remove("open");
          alert("已保存。");
        });
      } catch (error) { showCloudError(error); }
    };
    $all("[data-project-editor-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
  }

  async function loadTimelineCardEngagement(type, id, wrap) {
    try {
      const engagement = await window.XiaoLuoSupabase.getContentEngagement(type, id, state.userId, window.XiaoLuoSupabase.getVisitorId());
      const card = wrap.querySelector(`[data-open-timeline-post][data-id="${id}"]`);
      const target = card?.querySelector("[data-timeline-card-engagement]");
      if (target) target.textContent = `阅读 ${engagement.views} · 点赞 ${engagement.likes} · 评论 ${engagement.comments}`;
    } catch (error) { console.warn("Timeline card engagement load failed:", error.message); }
  }

  function initTimelineImageViewer() {
    if (document.body.dataset.timelineViewerBound) return;
    document.body.dataset.timelineViewerBound = "true";
    document.addEventListener("click", (event) => {
      const thumb = event.target.closest("[data-timeline-images]");
      if (!thumb) return;
      let images = [];
      try { images = JSON.parse(thumb.dataset.timelineImages || "[]"); } catch (_) { return; }
      if (!images.length) return;
      const card = thumb.closest("[data-open-timeline-post]");
      if (card?.dataset.type && card?.dataset.id) {
        window.XiaoLuoSupabase?.recordContentView(card.dataset.type, card.dataset.id, state.userId).catch(() => {});
      }
      openTimelineImageViewer(images, Number(thumb.dataset.timelineIndex) || 0);
    });
  }

  function openTimelineImageViewer(images, startIndex) {
    let modal = $("[data-timeline-image-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal timeline-image-modal";
      modal.dataset.timelineImageModal = "";
      modal.innerHTML = `<div class="modal-backdrop" data-timeline-image-close></div><section class="timeline-viewer-panel" role="dialog" aria-modal="true" aria-label="图片查看器"><button class="modal-close" type="button" data-timeline-image-close aria-label="关闭">x</button><button class="timeline-viewer-arrow previous" type="button" data-timeline-image-previous aria-label="上一张">&#8249;</button><div class="timeline-viewer-photo" data-timeline-viewer-photo></div><button class="timeline-viewer-arrow next" type="button" data-timeline-image-next aria-label="下一张">&#8250;</button><p data-timeline-image-count></p></section>`;
      document.body.appendChild(modal);
    }
    let index = Math.min(Math.max(startIndex, 0), images.length - 1);
    const draw = () => {
      const image = images[index];
      const photo = $("[data-timeline-viewer-photo]", modal);
      photo.className = `timeline-viewer-photo${/^https?:\/\//.test(image) ? " uploaded-image" : ` ${image}`}`;
      photo.style.backgroundImage = /^https?:\/\//.test(image) ? `url('${image}')` : "";
      $("[data-timeline-image-count]", modal).textContent = `${index + 1} / ${images.length}`;
    };
    $("[data-timeline-image-previous]", modal).onclick = () => { index = (index - 1 + images.length) % images.length; draw(); };
    $("[data-timeline-image-next]", modal).onclick = () => { index = (index + 1) % images.length; draw(); };
    $all("[data-timeline-image-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    draw();
    modal.classList.add("open");
  }

  function renderAbout() {
    const stats = {
      "[data-about-post-count]": data.posts.length,
      "[data-about-whisper-count]": 0,
      "[data-about-progress-count]": data.progress.length
    };
    Object.entries(stats).forEach(([selector, count]) => {
      const target = $(selector);
      if (target) target.textContent = count;
    });
    if (window.XiaoLuoSupabase?.listWhispers) {
      window.XiaoLuoSupabase.listWhispers("", 1000).then((items) => {
        const target = $("[data-about-whisper-count]");
        if (target) target.textContent = items.filter((item) => !item.parent_id).length;
      }).catch(() => {});
    }
    const links = $("[data-about-contact-links]");
    if (links) {
      const contacts = data.site.contacts || {};
      const entries = [
        ["GitHub", contacts.github, "github"],
        ["邮箱", contacts.email, "email"],
        ["抖音", contacts.douyin, "douyin"],
        ["Instagram", contacts.instagram, "instagram"]
      ].filter(([, value]) => value);
      links.innerHTML = entries.map(([label, value, type]) => {
        const href = type === "email" ? `mailto:${value}` : (/^https?:\/\//i.test(value) ? value : "#");
        const icon = type === "github" || type === "instagram" || type === "douyin" ? contactIconMarkup(type) : '<i class="about-platform-icon email" aria-hidden="true">@</i>';
        return `<a class="about-contact-link ${type}" href="${escapeHtml(href)}"${href === "#" ? ` data-contact-copy="${escapeHtml(value)}"` : ' target="_blank" rel="noopener"'}>${icon}<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></a>`;
      }).join("") || '<p class="about-contact-empty">联系方式正在整理中。</p>';
      $all("[data-contact-copy]", links).forEach((link) => { link.onclick = async (event) => { event.preventDefault(); try { await navigator.clipboard.writeText(link.dataset.contactCopy); link.classList.add("copied"); setTimeout(() => link.classList.remove("copied"), 1200); } catch (_) {} }; });
    }
  }

  function renderGallery() {
    const wrap = $("[data-photo-gallery]");
    const modal = $("[data-photo-modal]");
    if (!wrap || !modal) return;

    const draw = (albums) => {
      wrap.innerHTML = albums.map((album) => `
        <button class="album-card" type="button" data-album-id="${album.id}">
          <div class="photo-stack"><span></span><span></span><span class="photo ${album.photoClass}" ${album.images?.[0] ? `style="background-image:url('${album.images[0]}')"` : ""}></span></div>
          <h3>${escapeHtml(album.title)}</h3><p>${escapeHtml(album.meta)}</p>
        </button>
      `).join("");
    };

    draw(data.albums);
    const search = $("[data-gallery-search]");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "true";
      search.addEventListener("input", (event) => {
        const q = event.target.value.toLowerCase();
        draw(data.albums.filter((album) => [album.title, album.meta, album.description].join(" ").toLowerCase().includes(q)));
      });
    }

    if (!wrap.dataset.bound) {
      wrap.dataset.bound = "true";
      wrap.addEventListener("click", (event) => {
        const card = event.target.closest("[data-album-id]");
        if (!card) return;
        const album = data.albums.find((item) => item.id === card.dataset.albumId);
        let imageIndex = 0;
        const photo = $("[data-modal-photo]");
        const renderImage = () => {
          photo.className = `modal-photo ${album.photoClass}`;
          photo.style.backgroundImage = album.images?.[imageIndex] ? `url('${album.images[imageIndex]}')` : "";
          const count = $("[data-modal-image-count]");
          if (count) count.textContent = album.images?.length ? `${imageIndex + 1} / ${album.images.length}` : "";
        };
        renderImage();
        $all("[data-gallery-prev], [data-gallery-next]", modal).forEach((button) => {
          button.onclick = () => {
            if (!album.images?.length) return;
            imageIndex = button.hasAttribute("data-gallery-prev") ? (imageIndex - 1 + album.images.length) % album.images.length : (imageIndex + 1) % album.images.length;
            renderImage();
          };
        });
        $("[data-modal-meta]").textContent = album.meta;
        $("[data-modal-title]").textContent = album.title;
        $("[data-modal-description]").textContent = album.description;
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
      });
    }
    $all("[data-modal-close]").forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = "true";
      el.addEventListener("click", () => {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
      });
    });
  }

  function ensurePersistentPlayer() {
    let audio = document.body.querySelector(":scope > [data-music-player]");
    if (!audio) {
      audio = document.createElement("audio");
      audio.dataset.musicPlayer = "";
      audio.preload = "metadata";
      document.body.appendChild(audio);
    }
    if (!$("[data-floating-player]")) {
      document.body.insertAdjacentHTML("beforeend", `
        <aside class="floating-player" data-floating-player hidden>
          <button type="button" class="floating-collapse" data-floating-collapse aria-label="收起音乐播放器" title="收起播放器"><span aria-hidden="true">&#8249;</span></button>
          <button type="button" data-music-prev aria-label="上一首"><span class="player-icon player-icon-previous" aria-hidden="true"></span></button>
          <div class="floating-record" data-floating-record>♪</div>
          <div class="floating-info">
            <strong data-floating-title></strong>
            <span data-floating-artist></span>
            <input data-floating-seek type="range" min="0" max="100" value="0" aria-label="音乐进度" />
            <small><span data-floating-current>00:00</span> / <span data-floating-duration>00:00</span></small>
          </div>
          <button type="button" data-floating-toggle aria-label="播放或暂停">▶</button>
          <button type="button" data-music-next aria-label="下一首"><span class="player-icon player-icon-next" aria-hidden="true"></span></button>
        </aside>
      `);
    }
  }

  function initMusic() {
    ensurePersistentPlayer();
    if (state.musicReady) return;
    state.musicReady = true;
    const audio = document.body.querySelector(":scope > [data-music-player]");
    const floating = $("[data-floating-player]");
    const savedPlayback = JSON.parse(sessionStorage.getItem("xiaoluo-music-state") || "null");

    const setPlayerCollapsed = (collapsed) => {
      if (!floating) return;
      floating.classList.toggle("is-collapsed", collapsed);
      const control = $("[data-floating-collapse]", floating);
      if (control) {
        control.setAttribute("aria-label", collapsed ? "展开音乐播放器" : "收起音乐播放器");
        control.setAttribute("title", collapsed ? "展开播放器" : "收起播放器");
        control.innerHTML = `<span aria-hidden="true">${collapsed ? "&#8250;" : "&#8249;"}</span>`;
      }
      localStorage.setItem("xiaoluo-player-collapsed", collapsed ? "true" : "false");
    };

    setPlayerCollapsed(localStorage.getItem("xiaoluo-player-collapsed") === "true");

    const ui = () => ({
      playButtons: $all("[data-music-toggle], [data-floating-toggle]"),
      prevButtons: $all("[data-music-prev]"),
      nextButtons: $all("[data-music-next]"),
      seeks: $all("[data-music-seek], [data-floating-seek]"),
      records: $all("[data-record], [data-floating-record]")
    });

    const loadTrack = (index, shouldPlay = false) => {
      if (!data.music.length) return;
      state.musicIndex = (index + data.music.length) % data.music.length;
      const track = data.music[state.musicIndex];
      const artistText = track.category ? `${track.artist} · ${track.category}` : track.artist;
      const nextSrc = new URL(track.src, location.href).href;
      const sameTrack = audio.currentSrc === nextSrc || audio.src === nextSrc;
      if (!sameTrack) {
        audio.src = track.src;
        audio.dataset.trackSrc = nextSrc;
      }
      $all("[data-track-title], [data-floating-title]").forEach((el) => { el.textContent = track.title; });
      $all("[data-track-artist], [data-floating-artist]").forEach((el) => { el.textContent = artistText; });
      if (shouldPlay) playAudio();
      else { updateButtons(); updateProgress(); }
    };

    document.addEventListener("xiaoluo-play-track", (event) => loadTrack(event.detail?.index || 0, Boolean(event.detail?.play)));
    document.addEventListener("xiaoluo-music-library-updated", () => {
      // 导航期间不响应歌单更新，避免切歌
      if (state.navigating) return;
      const current = data.music[state.musicIndex] || data.music[0];
      if (!current) { audio.pause(); audio.removeAttribute("src"); updateButtons(); return; }
      loadTrack(Math.min(state.musicIndex, data.music.length - 1), false);
    });

    const rememberPlayback = () => {
      sessionStorage.setItem("xiaoluo-music-state", JSON.stringify({
        index: state.musicIndex,
        time: audio.currentTime || 0,
        playing: !audio.paused
      }));
    };

    const updateButtons = () => {
      const currentUi = ui();
      currentUi.playButtons.forEach((button) => {
        button.innerHTML = audio.paused
          ? '<span class="player-icon player-icon-play" aria-hidden="true"></span>'
          : '<span class="player-icon player-icon-pause" aria-hidden="true"></span>';
      });
      currentUi.records.forEach((record) => record.classList.toggle("playing", !audio.paused));
      if (!audio.paused && floating) floating.hidden = false;
    };

    const updateProgress = () => {
      const percent = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      const currentUi = ui();
      if (!state.seeking) currentUi.seeks.forEach((seek) => { seek.value = percent; });
      $all("[data-current-time], [data-floating-current]").forEach((el) => { el.textContent = formatTime(audio.currentTime); });
      $all("[data-duration], [data-floating-duration]").forEach((el) => { el.textContent = formatTime(audio.duration); });
    };

    async function playAudio() {
      if (floating) floating.hidden = false;
      try {
        await audio.play();
      } catch {
        ui().playButtons.forEach((button) => { button.textContent = "!"; });
      }
      updateButtons();
    }

    document.addEventListener("click", (event) => {
      if (event.target.closest("[data-floating-collapse]")) {
        setPlayerCollapsed(!floating.classList.contains("is-collapsed"));
        return;
      }
      if (floating.classList.contains("is-collapsed") && event.target.closest("[data-floating-record]")) {
        setPlayerCollapsed(false);
        return;
      }
      if (event.target.closest("[data-music-toggle], [data-floating-toggle]")) {
        if (audio.paused) playAudio();
        else {
          audio.pause();
          updateButtons();
        }
      }
      if (event.target.closest("[data-music-prev]")) loadTrack(state.musicIndex - 1, true);
      if (event.target.closest("[data-music-next]")) loadTrack(state.musicIndex + 1, true);
      if (event.target.closest("[data-music-library]")) openMusicLibrary(state.isAdmin);
      if (event.target.closest("[data-music-manage]")) openMusicLibrary(true);
    });

    document.addEventListener("input", (event) => {
      if (!event.target.matches("[data-music-seek], [data-floating-seek]")) return;
      state.seeking = true;
      ui().seeks.forEach((seek) => { seek.value = event.target.value; });
    });

    document.addEventListener("change", (event) => {
      if (!event.target.matches("[data-music-seek], [data-floating-seek]")) return;
      if (audio.duration) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
      state.seeking = false;
      updateProgress();
    });

    audio.addEventListener("play", () => { updateButtons(); rememberPlayback(); });
    audio.addEventListener("pause", () => { updateButtons(); rememberPlayback(); });
    audio.addEventListener("loadedmetadata", updateProgress);
    audio.addEventListener("timeupdate", () => { updateProgress(); rememberPlayback(); });
    audio.addEventListener("ended", () => loadTrack(state.musicIndex + 1, true));
    loadTrack(savedPlayback?.index ?? 0, false);
    if (savedPlayback?.time) {
      audio.addEventListener("loadedmetadata", () => {
        audio.currentTime = Math.min(savedPlayback.time, audio.duration || savedPlayback.time);
        if (savedPlayback.playing) playAudio();
      }, { once: true });
    }
    window.XiaoLuoMusicSyncUI = () => { updateButtons(); updateProgress(); };
    window.addEventListener("beforeunload", rememberPlayback);
  }

  function saveSiteSettings() {
    const form = $("[data-site-settings-form]");
    if (!form) return;
    const profile = {
      home_title: form.heroTitle?.value.trim() || data.site.heroTitle,
      home_bio: form.profileBio?.value.trim() || data.site.profileBio,
      about_title: data.site.aboutTitle,
      about_bio: data.site.aboutBio,
      about_side_bio: data.site.aboutSideBio,
      announcement: form.announcement?.value.trim() || "",
      display_name: form.profileName?.value.trim() || data.site.profileName,
      avatar_url: data.site.avatarDataUrl || "",
      home_background_url: data.site.homeBackground.imageUrl || "",
      contacts: {
      ...data.site.contacts,
      email: form.contactEmail?.value.trim() || "",
      github: form.contactGithub?.value.trim() || "https://github.com/LuoLuowo",
      douyin: form.contactDouyin?.value.trim() || "",
      instagram: form.contactInstagram?.value.trim() || "xiaoluo672",
      entry_loader_enabled: form.entryLoaderEnabled?.checked !== false
      }
    };

    const avatarFile = form.avatar?.files?.[0];
    const homeCoverFile = form.homeCover?.files?.[0];
    const oldHomeCoverUrl = data.site.homeBackground.imageUrl || "";
    const finish = async () => {
      try {
        requireCloudSession();
        await window.XiaoLuoSupabase.saveProfile(state.userId, profile);
        data.site.heroTitle = profile.home_title;
        data.site.profileBio = profile.home_bio;
        data.site.announcement = profile.announcement;
        data.site.profileName = profile.display_name;
        data.site.avatarText = profile.display_name.slice(0, 1);
        data.site.avatarDataUrl = profile.avatar_url;
        data.site.homeBackground.imageUrl = profile.home_background_url || "";
        data.site.contacts = profile.contacts;
        localStorage.setItem("xiaoluo-entry-loader-enabled", String(profile.contacts.entry_loader_enabled !== false));
        // Let a changed setting take effect on the very next homepage visit,
        // instead of being held back by this tab's previous entry marker.
        sessionStorage.removeItem("xiaoluo-home-entry-seen");
        initBrand();
        alert("已保存，首页现在已经生效。");
      } catch (error) { showCloudError(error); }
    };

    const upload = avatarFile
      ? uploadOptimizedImage(state.userId, "avatars", avatarFile, { maxSide: 720, targetBytes: 220 * 1024 }).then((url) => { profile.avatar_url = url; })
      : Promise.resolve();
    runWithLoading("正在保存首页设置…", async () => {
      await upload;
      if (homeCoverFile) {
        profile.home_background_url = await uploadOptimizedImage(state.userId, "home-covers", homeCoverFile, { maxSide: 2400, targetBytes: 900 * 1024 });
      }
      await finish();
      if (homeCoverFile && oldHomeCoverUrl && oldHomeCoverUrl !== profile.home_background_url) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([oldHomeCoverUrl]);
    }).catch(showCloudError);
  }

  async function saveAboutSettings() {
    const form = $("[data-about-settings-form]");
    if (!form) return;
    const profile = {
      home_title: data.site.heroTitle,
      home_bio: data.site.profileBio,
      about_title: form.aboutTitle.value.trim() || "关于小罗",
      about_bio: form.aboutBio.value.trim(),
      about_side_bio: form.aboutSideBio.value.trim(),
      announcement: data.site.announcement || "",
      display_name: data.site.profileName,
      avatar_url: data.site.avatarDataUrl || "",
      contacts: data.site.contacts || {}
    };
    try {
      requireCloudSession();
      await runWithLoading("正在保存关于我…", async () => {
        await window.XiaoLuoSupabase.saveProfile(state.userId, profile);
      });
      data.site.aboutTitle = profile.about_title;
      data.site.aboutBio = profile.about_bio;
      data.site.aboutSideBio = profile.about_side_bio;
      data.site.contacts = profile.contacts;
      initBrand();
      alert("关于我内容已保存到 Supabase。");
    } catch (error) { showCloudError(error); }
  }

  function initForms() {
    $all("[data-auth-form]").forEach((form) => {
      if (form.dataset.bound) return;
      form.dataset.bound = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const msg = $("[data-form-message]");
        const api = window.XiaoLuoSupabase;
        try {
          if (!api?.isConfigured) {
            msg.textContent = "Supabase 还没有配置。";
            return;
          }
          if (form.dataset.authForm === "register" && form.password.value !== form.confirmPassword.value) {
            msg.textContent = "两次输入的密码不一致。";
            return;
          }
          if (form.dataset.authForm === "register" && !form.displayName.value.trim()) {
            msg.textContent = "请输入昵称。";
            return;
          }
          msg.textContent = "正在处理...";
          const requestedNext = new URLSearchParams(location.search).get("next");
          const nextPage = requestedNext && requestedNext.startsWith("/") ? `.${requestedNext}` : "";
          if (form.dataset.authForm === "register") {
            const result = await api.signUpWithEmail(form.email.value, form.password.value, form.displayName.value);
            if (result.session) {
              await api.signOut();
              msg.textContent = "注册成功，请先去邮箱确认后再登录。";
              return;
            }
            msg.textContent = "注册成功，请先去邮箱点击确认链接，然后再回来登录。";
          } else {
            await api.signInWithEmail(form.email.value, form.password.value);
            await refreshAuthState();
            msg.textContent = state.isAdmin ? "登录成功，正在进入后台..." : "登录成功，正在进入博客...";
            window.location.href = nextPage || (state.isAdmin ? "./dashboard.html" : "./index.html");
          }
        } catch (error) {
          msg.textContent = error.message || "操作失败，请稍后重试。";
        }
      });
    });

    const settings = $("[data-save-site-settings]");
    if (settings && !settings.dataset.bound) {
      settings.dataset.bound = "true";
      settings.addEventListener("click", saveSiteSettings);
    }
    const aboutSettings = $("[data-save-about-settings]");
    if (aboutSettings && !aboutSettings.dataset.bound) {
      aboutSettings.dataset.bound = "true";
      aboutSettings.addEventListener("click", saveAboutSettings);
    }
  }

  function initPlaceholders() {
    if (document.body.dataset.placeholderBound) return;
    document.body.dataset.placeholderBound = "true";
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-placeholder-action]");
      if (!button) return;
      if (button.tagName === "A" && button.getAttribute("href") !== "#") return;
      event.preventDefault();

      if (button.dataset.placeholderAction === "logout") {
        await window.XiaoLuoSupabase?.signOut?.();
        state.isLoggedIn = false;
        state.userId = null;
        state.cloudOwnerId = null;
        window.location.href = "./login.html";
        return;
      }

      if (!state.sessionLoaded) await refreshAuthState();
      if (!state.isLoggedIn) {
        alert("请先登录。");
        return;
      }

      const actionText = {
        comment: "评论已提交。下一步会写入 Supabase 评论表。",
        like: "已点赞。下一步会写入 Supabase 点赞表。",
        bookmark: "已收藏。下一步会写入 Supabase 收藏表。",
        "delete-post": "删除文章功能已准备好，下一步会接入 Supabase。",
        "save-taxonomy": "分类和标签已准备保存，下一步会写入 Supabase。",
        "save-content-settings": "照片墙、生活圈和进步簿会在点击各自的添加按钮时直接保存到 Supabase。",
        "add-album": "新增照片墙功能已准备好。",
        "add-moment": "新增生活圈功能已准备好。",
        "add-progress": "新增进步簿功能已准备好。"
      };
      alert(actionText[button.dataset.placeholderAction] || "功能已准备好，下一步会接入 Supabase。");
    });
  }

  function initProtectedDownloads() {
    if (document.body.dataset.protectedDownloadsBound) return;
    document.body.dataset.protectedDownloadsBound = "true";
    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-protected-download]");
      if (!link || requireLogin("请先登录后再下载附件。")) return;
      event.preventDefault();
    });
  }

  function initEditor() {
    const form = $("[data-editor-form]");
    if (!form || form.dataset.bound) return;
    if (!state.isAdmin) return;
    form.dataset.bound = "true";
    bindTextFormatToolbars(form);
    const panel = $("[data-preview-panel]");
    const title = $("[data-preview-title]");
    const content = $("[data-preview-content]");
    prepareEditorForEdit();
    $("[data-editor-preview]")?.addEventListener("click", () => {
      panel.hidden = false;
      title.textContent = form.title.value || "未命名文章";
      content.innerHTML = renderPostContent([editorContentValue(form)]);
      highlightCodeBlocks(content);
    });
    $("[data-save-draft]")?.addEventListener("click", () => alert(state.isLoggedIn ? "草稿已准备保存，下一步会写入 Supabase。" : "请先登录。"));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.isAdmin) { alert("只有管理员可以发布文章。"); return; }
      confirmPublish("确认发布文章？", "发布后文章将对前台访客可见。").then(async (confirmed) => {
        if (!confirmed) return;
        try {
          await runWithLoading("正在发布文章，请稍候…", async (cancelled) => {
            const editingId = form.dataset.editPostId || "";
            const existing = data.posts.find((post) => post.id === editingId);
            const oldCover = existing?.coverUrl || null;
            const oldMusic = existing?.musicAttachment || null;
            const cover = form.cover?.files?.[0] ? await uploadOptimizedImage(state.userId, "post-covers", form.cover.files[0]) : oldCover;
            if (cancelled()) return;
            const attachmentFiles = Array.from(form.attachments?.files || []);
            const attachments = [...(existing?.attachments || []), ...await Promise.all(attachmentFiles.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "post-attachments", file) })))];
            let musicAttachment = existing?.musicAttachment || null;
            const musicUrl = form.musicUrl?.value.trim() || "";
            const musicTitle = form.musicTitle?.value.trim() || "";
            if (musicUrl && !/^https?:\/\//i.test(musicUrl)) throw new Error("音乐 URL 必须以 http:// 或 https:// 开头。");
            if (musicUrl) musicAttachment = { name: musicTitle || musicUrl.split("/").pop()?.split("?")[0] || "文章配乐", url: musicUrl };
            else if (form.music?.files?.[0]) musicAttachment = { name: musicTitle || form.music.files[0].name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "post-music", form.music.files[0]) };
            else if (musicAttachment?.url && musicTitle) musicAttachment = { ...musicAttachment, name: musicTitle };
            if (cancelled()) return;
            const postData = { title: form.title.value.trim(), content: editorContentValue(form).trim(), cover_url: cover, category: form.category.value || "未分类", tags: parseCommaTags(form.tags.value), attachments, music_attachment: musicAttachment, status: form.visibility?.value === "private" ? "private" : "published" };
            if (editingId) await window.XiaoLuoSupabase.updatePost(state.userId, editingId, postData);
            else await window.XiaoLuoSupabase.savePost(state.userId, postData);
            if (editingId && form.cover?.files?.[0] && oldCover && oldCover !== cover) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([oldCover]);
            if (editingId && oldMusic?.url && oldMusic.url !== musicAttachment?.url && oldMusic.url.includes("/storage/v1/object/")) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([oldMusic.url]);
            if (existing) existing.musicAttachment = musicAttachment;
            form.reset();
            setEditorContent(form, "");
            alert(editingId ? "文章已更新到 Supabase。" : "文章已发布到 Supabase。");
            navigate("./articles.html");
          });
        } catch (error) { showCloudError(error); }
      });
    });
  }

  function prepareEditorForEdit() {
    const form = $("[data-editor-form]");
    const postId = params().get("id");
    if (!form || !postId || form.dataset.editHydrated === postId) return;
    const post = data.posts.find((item) => item.id === postId);
    if (!post) return;
    form.dataset.editPostId = postId;
    form.dataset.editHydrated = postId;
    form.title.value = post.title || "";
    setEditorContent(form, (post.content || []).join("\n"));
    form.tags.value = (post.tags || []).join(", ");
    if (form.musicUrl) form.musicUrl.value = post.musicAttachment?.url && !post.musicAttachment.url.includes("/storage/v1/object/") ? post.musicAttachment.url : "";
    if (form.musicTitle) form.musicTitle.value = post.musicAttachment?.name || "";
    if (form.visibility) form.visibility.value = post.status === "private" ? "private" : "published";
    if (![...form.category.options].some((option) => option.value === post.category)) {
      form.category.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(post.category)}">${escapeHtml(post.category)}</option>`);
    }
    form.category.value = post.category || "";
    const heading = $("[data-editor-heading]");
    if (heading) heading.textContent = "编辑文章";
    const submit = $("[data-publish-post]");
    if (submit) submit.textContent = "保存修改";
    renderEditorExistingMedia(post);
  }

  function renderEditorExistingMedia(post) {
    const coverSection = $("[data-editor-existing-cover]");
    const coverPreview = $("[data-editor-cover-preview]");
    const coverInputLabel = $("[data-editor-cover-input-label]");
    const attachmentSection = $("[data-editor-existing-attachments]");
    const attachmentList = $("[data-editor-attachment-list]");
    const musicSection = $("[data-editor-existing-music]");
    const musicList = $("[data-editor-music-list]");
    if (coverSection && coverPreview) {
      coverSection.hidden = !post.coverUrl;
      coverPreview.src = post.coverUrl || "";
      if (coverInputLabel) coverInputLabel.textContent = post.coverUrl ? "替换封面" : "文章封面";
    }
    if (attachmentSection && attachmentList) {
      attachmentSection.hidden = !(post.attachments?.length);
      attachmentList.innerHTML = (post.attachments || []).map((file, index) => `<div><a href="${file.url}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a><button class="danger-button" type="button" data-delete-post-attachment="${index}">删除</button></div>`).join("");
    }
    if (musicSection && musicList) {
      musicSection.hidden = !post.musicAttachment?.url;
      musicList.innerHTML = post.musicAttachment?.url ? `<div><a href="${escapeHtml(post.musicAttachment.url)}" target="_blank" rel="noopener">${escapeHtml(post.musicAttachment.name || "文章配乐")}</a><button class="danger-button" type="button" data-delete-post-music>删除</button></div>` : "";
      $("[data-delete-post-music]", musicList)?.addEventListener("click", async () => {
        if (!await confirmPublish("确认删除文章配乐？", "删除后无法恢复。", "确认删除")) return;
        try {
          await runWithLoading("正在删除文章配乐…", async () => {
            await window.XiaoLuoSupabase.updatePost(state.userId, post.id, { music_attachment: null });
            if (post.musicAttachment.url.includes("/storage/v1/object/")) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([post.musicAttachment.url]);
          });
          post.musicAttachment = null;
          renderEditorExistingMedia(post);
        } catch (error) { showCloudError(error); }
      });
    }
    const deleteCover = $("[data-delete-post-cover]");
    if (deleteCover) deleteCover.onclick = async () => {
      if (!post.coverUrl || !await confirmPublish("确认删除文章封面？", "删除后无法恢复。", "确认删除")) return;
      try {
        await runWithLoading("正在删除封面…", async () => {
          await window.XiaoLuoSupabase.updatePost(state.userId, post.id, { cover_url: null });
          await window.XiaoLuoSupabase.deleteFilesByPublicUrls([post.coverUrl]);
        });
        post.coverUrl = "";
        renderEditorExistingMedia(post);
      } catch (error) { showCloudError(error); }
    };
    $all("[data-delete-post-attachment]", attachmentList).forEach((button) => {
      button.onclick = async () => {
        const index = Number(button.dataset.deletePostAttachment);
        const file = post.attachments[index];
        if (!file || !await confirmPublish("确认删除这个附件？", "删除后无法恢复。", "确认删除")) return;
        const nextAttachments = post.attachments.filter((_, itemIndex) => itemIndex !== index);
        try {
          await runWithLoading("正在删除附件…", async () => {
            await window.XiaoLuoSupabase.updatePost(state.userId, post.id, { attachments: nextAttachments });
            await window.XiaoLuoSupabase.deleteFilesByPublicUrls([file.url]);
          });
          post.attachments = nextAttachments;
          renderEditorExistingMedia(post);
        } catch (error) { showCloudError(error); }
      };
    });
  }

  function renderAdminPosts() {
    const wrap = $("[data-admin-posts]");
    if (!wrap) return;
    wrap.innerHTML = data.posts.map((post) => `
      <div class="table-row"><strong>${escapeHtml(post.title)}</strong><span>${escapeHtml(post.category)}</span><span>${formatPostDate(post.publishedAt)}</span><div><a href="./editor.html?id=${post.id}">编辑</a><button type="button" data-delete-post="${post.id}">删除</button></div></div>
    `).join("");
    if (wrap.dataset.bound) return;
    wrap.dataset.bound = "true";
    wrap.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-post]");
      if (!button) return;
      confirmPublish("确认删除这篇文章？", "删除后无法恢复。", "确认删除").then(async (confirmed) => {
        if (!confirmed) return;
        try {
          await window.XiaoLuoSupabase.deleteContent("posts", button.dataset.deletePost, state.userId);
          data.posts = data.posts.filter((post) => post.id !== button.dataset.deletePost);
          renderAdminPosts();
        } catch (error) { showCloudError(error); }
      });
    });
  }

  function renderDashboardStats() {
    const totalWords = [
      ...data.posts.map((post) => `${post.title || ""}${(post.content || []).join("")}`),
      ...data.moments.map((item) => `${item.title || ""}${item.text || ""}`),
      ...data.progress.map((item) => `${item.title || ""}${item.text || ""}`),
      ...data.projects.map((item) => `${item.title || ""}${item.description || ""}`)
    ].reduce((count, value) => count + value.replace(/\s/g, "").length, 0);
    const totalAttachments = data.posts.reduce((count, post) => count + (post.attachments?.length || 0), 0) + data.projects.reduce((count, project) => count + (project.attachments?.length || 0), 0);
    const totalImages = [...data.moments, ...data.progress].reduce((count, item) => count + (item.images?.length || 0), 0) + data.projects.filter((project) => project.coverUrl).length;
    const stats = {
      "[data-stat-total-words]": totalWords,
      "[data-stat-total-attachments]": totalAttachments,
      "[data-stat-total-images]": totalImages
    };
    Object.entries(stats).forEach(([selector, value]) => {
      const target = $(selector);
      if (target) target.textContent = value.toLocaleString("zh-CN");
    });
    window.XiaoLuoSupabase?.getTotalLikes?.().then((totalLikes) => {
      const target = $("[data-stat-total-likes]");
      if (target) target.textContent = totalLikes.toLocaleString("zh-CN");
    }).catch((error) => console.warn("Like total load failed:", error.message));
    window.XiaoLuoSupabase?.getStorageUsage?.().then((bytes) => {
      const target = $("[data-stat-storage-used]");
      if (target) target.textContent = `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }).catch((error) => console.warn("Storage usage load failed:", error.message));
    window.XiaoLuoSupabase?.getSiteMetrics?.().then((metrics) => {
      const unique = $("[data-stat-unique-visitors]");
      const online = $("[data-stat-online-visitors]");
      const today = $("[data-stat-today-visitors]");
      if (unique) unique.textContent = metrics.uniqueVisitors.toLocaleString("zh-CN");
      if (online) online.textContent = metrics.onlineVisitors.toLocaleString("zh-CN");
      if (today) today.textContent = metrics.todayVisitors.toLocaleString("zh-CN");
    }).catch((error) => console.warn("Site metrics load failed; run supabase/site-visitor-stats.sql:", error.message));
  }

  function initPresenceHeartbeat() {
    const api = window.XiaoLuoSupabase;
    if (!api?.heartbeatPresence || window.__xiaoluoPresenceTimer) return;
    window.__xiaoluoPresenceTimer = window.setInterval(() => {
      api.heartbeatPresence(location.pathname + location.search).catch(() => {});
      if (pageName() === "dashboard" && state.isAdmin) renderDashboardStats();
    }, 30000);
  }

  function renderRegisteredUsers() {
    const wrap = $("[data-registered-users]");
    if (!wrap || !state.isAdmin) return;
    wrap.innerHTML = '<p class="empty-state">正在加载注册用户…</p>';
    window.XiaoLuoSupabase?.listRegisteredUsers?.().then((users) => {
      const count = $("[data-registered-user-count]");
      if (count) count.textContent = `${users.length} 位用户`;
      wrap.innerHTML = users.map((user) => {
        const name = user.display_name || "普通用户";
        const avatar = user.avatar_url || "";
        const initial = escapeHtml(name.slice(0, 1) || "普");
        return `<article class="registered-user-row"><button class="comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${escapeHtml(user.id)}" aria-label="查看${escapeHtml(name)}的资料"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${initial}</button><div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(user.email || "未提供邮箱")}</p></div><time>${formatPostDate(user.created_at)}</time></article>`;
      }).join("") || '<p class="empty-state">暂时还没有普通用户注册。</p>';
    }).catch((error) => {
      wrap.innerHTML = '<p class="empty-state">无法读取注册用户，请确认已执行用户列表权限脚本。</p>';
      console.warn("Registered users load failed:", error.message);
    });
  }

  function formatVisitorTime(iso) {
    if (!iso) return "--";
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (_) {
      return String(iso);
    }
  }

  let visitorMonitorState = { tab: "online", loading: false, allRows: [], displayCount: 20, searchQuery: "", searchResults: [], searching: false };

  async function renderVisitorDetail() {
    const listEl = $("[data-visitor-list]");
    const noteEl = $("[data-visitor-note]");
    if (!listEl) return;
    const api = window.XiaoLuoSupabase;
    if (!api) { listEl.innerHTML = '<p class="empty-state">Supabase 未配置。</p>'; return; }
    visitorMonitorState.loading = true;
    listEl.innerHTML = '<p class="empty-state">正在加载…</p>';
    try {
      const tab = visitorMonitorState.tab;
      let rows = [];
      if (tab === "online") rows = await api.getOnlineVisitorsDetail?.() || [];
      else rows = await api.getVisitorVisitLogs?.(tab) || [];

      // 按日期从最新往下排
      rows.sort((a, b) => new Date(b.visited_at || b.last_seen || 0) - new Date(a.visited_at || a.last_seen || 0));

      visitorMonitorState.allRows = rows;
      visitorMonitorState.displayCount = 20;

      if (!rows.length) {
        listEl.innerHTML = `<p class="empty-state">${tab === "online" ? "当前没有在线用户。" : tab === "today" ? "今天还没有带 IP 记录的访客。" : tab === "repeat" ? "暂无访问 2 次及以上的重复访客。" : "暂无带 IP 记录的访客数据。"}</p>`;
        if (noteEl) noteEl.textContent = tab === "all" ? "提示：此功能上线前的旧访客没有 IP 记录，已自动过滤。" : "";
        return;
      }

      renderVisitorRows();
    } catch (error) {
      listEl.innerHTML = `<p class="empty-state">加载失败：${escapeHtml(error.message || "未知错误")}</p>`;
      console.warn("Visitor detail load failed:", error);
    } finally {
      visitorMonitorState.loading = false;
    }
  }

  function renderVisitorRows() {
    const listEl = $("[data-visitor-list]");
    const noteEl = $("[data-visitor-note]");
    if (!listEl) return;
    const tab = visitorMonitorState.tab;
    const query = (visitorMonitorState.searchQuery || "").trim();

    // 搜索模式：逐条显示该IP的每次访问记录
    if (query) {
      if (visitorMonitorState.searching) {
        listEl.innerHTML = '<p class="empty-state">正在搜索…</p>';
        return;
      }
      const logs = visitorMonitorState.searchResults || [];
      if (!logs.length) {
        listEl.innerHTML = `<p class="empty-state">没有找到匹配 "${escapeHtml(query)}" 的访问记录。</p>`;
        if (noteEl) noteEl.textContent = "提示：需先在 Supabase 运行 visitor-logs-by-visit.sql 才会记录每次访问。";
        return;
      }
      const html = logs.map((log) => {
        const isLoggedIn = Boolean(log.user_name);
        const nameBadge = isLoggedIn
          ? `<span class="visitor-badge logged-in">${escapeHtml(log.user_name)}</span>`
          : `<span class="visitor-badge guest">未登录</span>`;
        const fullIp = log.ip_address || "";
        let ipText = fullIp ? escapeHtml(fullIp) : "未知 IP";
        if (fullIp && fullIp.includes(":") && fullIp.length > 20) {
          const segs = fullIp.split(":");
          ipText = escapeHtml(segs.slice(0, 3).join(":") + "…" + segs.slice(-1)[0]);
        }
        const ipEl = fullIp
          ? `<button type="button" class="visitor-ip" data-copy-ip="${escapeHtml(fullIp)}" title="点击复制完整 IP 地址">${ipText}</button>`
          : `<span class="visitor-ip">未知 IP</span>`;
        const pageEl = log.page_path ? `<span class="visitor-page">${escapeHtml(log.page_path)}</span>` : "";
        const visitNo = Number(log.visit_number || log.visit_count) || 1;
        const countBadge = `<span class="visitor-count" title="该访客的本次访问序号">第${visitNo}次</span>`;
        const locEl = (log.ip_location && log.ip_location !== "未知地址")
          ? `<span class="visitor-loc">${escapeHtml(log.ip_location)}</span>`
          : `<span class="visitor-loc unknown">未知位置</span>`;
        const timeText = formatVisitorTime(log.visited_at);
        return `<article class="visitor-row">
          <div class="visitor-row-main">
            ${nameBadge}
            ${ipEl}
            ${countBadge}
            ${pageEl}
            ${locEl}
          </div>
          <time class="visitor-time">${timeText}</time>
        </article>`;
      }).join("");
      listEl.innerHTML = html;
      if (noteEl) noteEl.textContent = `匹配到 ${logs.length} 条访问记录，已按每位访客从首次访问开始编号。`;
      return;
    }

    // 普通模式：访客列表
    let rows = visitorMonitorState.allRows || [];
    const count = visitorMonitorState.displayCount || 20;
    const visible = rows.slice(0, count);
    if (!visible.length) {
      listEl.innerHTML = `<p class="empty-state">${query ? "没有找到匹配该 IP 的记录。" : "暂无数据。"}</p>`;
      if (noteEl) noteEl.textContent = query ? `搜索关键词：${escapeHtml(visitorMonitorState.searchQuery)}，共 ${rows.length} 条结果` : "";
      return;
    }
    const html = visible.map((row) => {
      const isLoggedIn = Boolean(row.user_name);
      const nameBadge = isLoggedIn
        ? `<span class="visitor-badge logged-in">${escapeHtml(row.user_name)}</span>`
        : `<span class="visitor-badge guest">未登录</span>`;
      // IPv6截断显示，IPv4正常显示；点击可复制完整地址
      const fullIp = row.ip_address || "";
      let ipText = fullIp ? escapeHtml(fullIp) : "未知 IP";
      if (fullIp && fullIp.includes(":") && fullIp.length > 20) {
        const segs = fullIp.split(":");
        ipText = escapeHtml(segs.slice(0, 3).join(":") + "…" + segs.slice(-1)[0]);
      }
      const ipEl = fullIp
        ? `<button type="button" class="visitor-ip" data-copy-ip="${escapeHtml(fullIp)}" title="点击复制完整 IP 地址">${ipText}</button>`
        : `<span class="visitor-ip">未知 IP</span>`;
      // 每一条日志都有独立的访问顺序，不显示汇总次数。
      const visitNo = Number(row.visit_number || row.visit_count) || 1;
      const countBadge = `<span class="visitor-count" title="该访客的本次访问序号">第${visitNo}次</span>`;
      // 位置显示，未知位置提供 hiofd 手动查询链接
      let locEl;
      if (row.ip_location && row.ip_location !== "未知地址") {
        locEl = `<span class="visitor-loc">${escapeHtml(row.ip_location)}</span>`;
      } else {
        const queryUrl = `https://tool.hiofd.com/ip/?ip=${encodeURIComponent(fullIp)}`;
        locEl = `<span class="visitor-loc unknown">未知位置 <a href="${queryUrl}" target="_blank" rel="noopener" class="visitor-loc-lookup" title="使用 hiofd 查询此 IP 归属地">查位置</a></span>`;
      }
      const timeText = formatVisitorTime(row.visited_at || row.last_seen);
      return `<article class="visitor-row">
        <div class="visitor-row-main">
          ${nameBadge}
          ${ipEl}
          ${countBadge}
          ${locEl}
        </div>
        <time class="visitor-time">${timeText}</time>
      </article>`;
    }).join("");
    const hasMore = rows.length > count;
    listEl.innerHTML = html + (hasMore ? `<button class="visitor-load-more" type="button" data-visitor-load-more>加载更多（还有 ${rows.length - count} 条）</button>` : "");
    if (noteEl) {
      if (query) {
        noteEl.textContent = `搜索 "${visitorMonitorState.searchQuery}"，共找到 ${rows.length} 条记录。点击 IP 地址可复制完整地址。`;
      } else {
        noteEl.textContent = `共 ${rows.length} 条记录${tab === "all" ? "（仅显示有 IP 记录的访客，旧数据已过滤）" : ""}。点击 IP 地址可复制完整地址。`;
      }
    }
  }

  // ===== IP 查询网站自定义管理 =====
  const IP_TOOLS_KEY = "xiaoluo-ip-query-tools";
  const DEFAULT_IP_TOOLS = [
    { name: "hiofd", url: "https://tool.hiofd.com/ip/" }
  ];

  function loadIpTools() {
    try {
      const raw = localStorage.getItem(IP_TOOLS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (_) {}
    return [...DEFAULT_IP_TOOLS];
  }

  function saveIpTools(tools) {
    try { localStorage.setItem(IP_TOOLS_KEY, JSON.stringify(tools)); } catch (_) {}
  }

  function renderIpTools() {
    const listEl = $("[data-ip-tools-list]");
    if (!listEl) return;
    const tools = loadIpTools();
    listEl.innerHTML = tools.map((tool, i) => `
      <a class="ip-tool-link" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener" title="${escapeHtml(tool.url)}">${escapeHtml(tool.name)}</a>
      <button type="button" class="ip-tool-remove" data-ip-tool-remove="${i}" title="删除">×</button>
    `).join("");
  }

  function addIpTool() {
    const name = prompt("请输入网站名称（如：ip138）");
    if (!name || !name.trim()) return;
    let url = prompt("请输入网站网址（如：https://www.ip138.com/）");
    if (!url) return;
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const tools = loadIpTools();
    tools.push({ name: name.trim(), url });
    saveIpTools(tools);
    renderIpTools();
  }

  function initVisitorMonitor() {
    const toggleBtn = $("[data-visitor-toggle]");
    const body = $("[data-visitor-body]");
    if (!toggleBtn || !body) return;
    toggleBtn.addEventListener("click", () => {
      const isHidden = body.hasAttribute("hidden");
      if (isHidden) {
        body.removeAttribute("hidden");
        toggleBtn.textContent = "收起";
        renderVisitorDetail();
      } else {
        body.setAttribute("hidden", "");
        toggleBtn.textContent = "查看日志";
      }
    });
    $all("[data-visitor-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        $all("[data-visitor-tab]").forEach((b) => b.classList.remove("active"));
        tabBtn.classList.add("active");
        visitorMonitorState.tab = tabBtn.dataset.visitorTab;
        renderVisitorDetail();
      });
    });
    const refreshBtn = $("[data-visitor-refresh]");
    if (refreshBtn) refreshBtn.addEventListener("click", () => { if (!visitorMonitorState.loading) renderVisitorDetail(); });
    // IP 搜索框
    const searchInput = $("[data-visitor-search]");
    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim();
        visitorMonitorState.searchQuery = q;
        visitorMonitorState.displayCount = 20;
        if (!q) {
          visitorMonitorState.searchResults = [];
          visitorMonitorState.searching = false;
          renderVisitorRows();
          return;
        }
        // 防抖搜索
        visitorMonitorState.searching = true;
        renderVisitorRows();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
          try {
            const logs = await window.XiaoLuoSupabase?.searchVisitorLogs?.(q) || [];
            visitorMonitorState.searchResults = logs;
          } catch (error) {
            console.warn("Visitor log search failed:", error.message);
            visitorMonitorState.searchResults = [];
          } finally {
            visitorMonitorState.searching = false;
            renderVisitorRows();
          }
        }, 400);
      });
    }
    // 加载更多按钮（事件委托，因为按钮是动态生成的）
    document.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-visitor-load-more]");
      if (!btn) return;
      visitorMonitorState.displayCount = (visitorMonitorState.displayCount || 20) + 20;
      renderVisitorRows();
    });
    // IP 地址点击复制（事件委托）
    document.addEventListener("click", async (event) => {
      const ipBtn = event.target.closest("[data-copy-ip]");
      if (!ipBtn) return;
      const ip = ipBtn.dataset.copyIp;
      if (!ip) return;
      try {
        await navigator.clipboard.writeText(ip);
        const original = ipBtn.textContent;
        ipBtn.textContent = "已复制";
        ipBtn.classList.add("copied");
        setTimeout(() => { ipBtn.textContent = original; ipBtn.classList.remove("copied"); }, 1200);
      } catch (_) {
        // 降级方案：创建临时 textarea
        const ta = document.createElement("textarea");
        ta.value = ip;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        document.body.removeChild(ta);
        const original = ipBtn.textContent;
        ipBtn.textContent = "已复制";
        ipBtn.classList.add("copied");
        setTimeout(() => { ipBtn.textContent = original; ipBtn.classList.remove("copied"); }, 1200);
      }
    });
    // IP 查询网站：渲染 + 添加 + 删除
    renderIpTools();
    const addBtn = $("[data-ip-tools-add]");
    if (addBtn) addBtn.addEventListener("click", addIpTool);
    document.addEventListener("click", (event) => {
      const removeBtn = event.target.closest("[data-ip-tool-remove]");
      if (!removeBtn) return;
      event.preventDefault();
      const idx = Number(removeBtn.dataset.ipToolRemove);
      const tools = loadIpTools();
      if (idx >= 0 && idx < tools.length) {
        tools.splice(idx, 1);
        saveIpTools(tools);
        renderIpTools();
      }
    });
  }

  function renderContentManagers() {
    const albumWrap = $("[data-album-manager]");
    const momentWrap = $("[data-moment-manager]");
    const progressWrap = $("[data-progress-manager]");
    const projectWrap = $("[data-project-manager]");
    if (albumWrap) albumWrap.innerHTML = data.albums.map((album) => `<div class="manager-row"><strong>${escapeHtml(album.title)}</strong><span>${escapeHtml(album.meta)}</span><div><button type="button" data-edit-content data-type="album" data-id="${escapeHtml(album.id)}">编辑</button><button type="button" data-remove-content data-type="album" data-id="${escapeHtml(album.id)}">删除</button></div></div>`).join("");
    if (momentWrap) momentWrap.innerHTML = "";
    if (progressWrap) progressWrap.innerHTML = "";
    if (projectWrap) projectWrap.innerHTML = data.projects.map((project) => `<div class="manager-row project-manager-row"><strong>${escapeHtml(project.title)}</strong><span>${escapeHtml(project.description || "暂无简介")}</span><div><button type="button" data-edit-project="${escapeHtml(project.id)}">编辑</button><button type="button" data-remove-project="${escapeHtml(project.id)}">删除</button></div></div>`).join("") || '<p class="comment-empty">还没有个人项目。</p>';
  }

  async function protectDashboard() {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    // 导航时不重新请求 session，使用已有的认证状态
    if (!state.sessionLoaded) {
      await refreshAuthState();
    }
    if (!state.isLoggedIn) window.location.href = "./login.html";
    else if (!state.isAdmin) window.location.href = "./index.html";
  }

  function initAdminEntryGuard() {
    if (document.body.dataset.adminEntryGuardBound) return;
    document.body.dataset.adminEntryGuardBound = "true";
    document.addEventListener("click", (event) => {
      const entry = event.target.closest("[data-admin-entry], a[href='./dashboard.html'], a[href='./editor.html']");
      if (!entry || state.isAdmin) return;
      event.preventDefault();
      event.stopPropagation();
      showAdminOnlyNotice();
    }, true);
  }

  function showAdminOnlyNotice() {
    let modal = $("[data-admin-only-modal]");
    if (!modal) {
      modal = document.createElement("div");
      modal.className = "modal admin-only-modal";
      modal.dataset.adminOnlyModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-admin-only-close aria-label="关闭提示"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="admin-only-title"><button class="modal-close" type="button" data-admin-only-close aria-label="关闭">×</button><p class="mini-title">XIAOLUO BLOG</p><h2 id="admin-only-title">管理员专属入口</h2><p>本入口仅供管理员小罗操作。</p><div class="publish-confirm-actions"><button class="primary-button" type="button" data-admin-only-close>我知道了</button></div></section>`;
      document.body.appendChild(modal);
    }
    $all("[data-admin-only-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    modal.classList.add("open");
  }

  function ensureWhisperUnreadBadges() {
    $all(".top-nav a[href='./whispers.html']").forEach((link) => {
      if ($( "[data-whisper-unread-badge]", link)) return;
      const badge = document.createElement("span");
      badge.className = "whisper-unread-badge";
      badge.dataset.whisperUnreadBadge = "";
      badge.hidden = true;
      badge.setAttribute("aria-label", "");
      link.appendChild(badge);
    });
  }

  async function updateWhisperUnreadBadge(markSeen = false) {
    ensureWhisperUnreadBadges();
    const badges = $all("[data-whisper-unread-badge]");
    const hide = () => badges.forEach((badge) => { badge.hidden = true; badge.textContent = ""; });
    if (pageName() === "whispers") {
      if (state.isLoggedIn && state.userId) localStorage.setItem(`xiaoluo-whispers-seen-${state.userId}`, new Date().toISOString());
      hide();
      return;
    }
    if (!state.isLoggedIn || !state.userId || !window.XiaoLuoSupabase?.getWhisperUnreadCount) { hide(); return; }
    const storageKey = `xiaoluo-whispers-seen-${state.userId}`;
    const lastSeen = localStorage.getItem(storageKey);
    if (markSeen || !lastSeen) {
      localStorage.setItem(storageKey, new Date().toISOString());
      hide();
      return;
    }
    try {
      const count = await window.XiaoLuoSupabase.getWhisperUnreadCount(lastSeen, state.userId);
      // A newer visit may have marked the feed as read while this request was in flight.
      if (localStorage.getItem(storageKey) !== lastSeen) return;
      badges.forEach((badge) => {
        badge.hidden = count < 1;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.setAttribute("aria-label", `有 ${count} 条未读碎碎念`);
        badge.title = `有 ${count} 条未读碎碎念`;
      });
    } catch (_) { hide(); }
  }

  function startWhisperUnreadPolling() {
    if (window.__xiaoluoWhisperUnreadTimer) return;
    window.__xiaoluoWhisperUnreadTimer = window.setInterval(() => updateWhisperUnreadBadge(), 45000);
  }

  function renderCurrentPage() {
    applySavedContent();
    initBrand();
    ensureActivityNavLink();
    ensureFunctionNav();
    bindThemeButtons();
    bindTextFormatToolbars();
    bindNavToggle();
    bindFunctionMenus();
    setActiveNav();
    populateFilters();
    initForms();
    initContactCopy();
    initProfileDetails();
    initUserProfileSettings();
    initTimelinePostManagement();
    initAdminEntryGuard();
    initLiveClock();
    initPresenceHeartbeat();
    initTimelineImageViewer();
    initGameDrawer();
    window.XiaoLuoMusicSyncUI?.();
    const page = pageName();
    // Some mobile browsers report a desktop-sized layout viewport while the
    // page is zoomed. Mark touch readers explicitly so the fixed desktop TOC
    // can never capture the page's vertical swipe.
    const isTouchReader = page === "article-detail" && (window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 720);
    document.body.classList.toggle("article-touch-reading", isTouchReader);
    startWhisperUnreadPolling();
    updateWhisperUnreadBadge(page === "whispers");
    if (page === "home") renderHome();
    if (page === "articles") renderArticles();
    if (page === "categories") renderCategories();
    if (page === "article-detail") renderDetail();
    if (page === "life") renderLifeTimeline();
    if (page === "progress") renderTimeline("[data-progress-timeline]", data.progress);
    if (page === "projects") renderProjects();
    if (page === "media-list") {
      renderMediaList();
      ensureMediaListData();
    }
    initQuickNotes();
    initQuickSites();
    initMediaList();
    if (page === "about") renderAbout();
    if (page === "activity") { renderActivityLeaderboard(); renderActivityHeatmap(); renderFriendLinks(); }
    if (page === "photos") renderGallery();
    if (page === "whispers") {
      if (!state.isLoggedIn) showWhisperLoginModal();
      else renderWhispers();
    }
    if (page === "game") {
      ensureJumpGame();
    }
    if (page === "snake") {
      ensureSnakeGame();
    }
    if (page === "wordfall") {
      ensureWordfallGame();
    }
    if (page === "dashboard") {
      protectDashboard().then(() => {
        if (!state.isAdmin) return;
        initDashboardSectionSpy();
        initContentManagement();
        initProjectManagement();
        initVisitorMonitor();
        renderAdminPosts();
        renderContentManagers();
        renderDashboardStats();
        renderRegisteredUsers();
        renderDashboardStats();
      }).catch(() => {});
    }
    if (page === "editor") {
      protectDashboard().then(() => { if (state.isAdmin) initEditor(); }).catch(() => {});
    }
    window.XiaoLuoSupabase?.trackVisit?.(location.pathname + location.search);
  }

  function showEntryLoader() {
    let loader = $("[data-entry-loader]");
    if (!loader) {
      loader = document.createElement("div");
      loader.className = "entry-loader";
      loader.dataset.entryLoader = "";
      loader.innerHTML = '<div class="entry-loader-mark"><img src="./assets/images/xiaoluo-blog-icon.jpg" alt="小罗Blog"></div><strong>正在进入小罗Blog</strong><span>正在整理这一页的故事…</span><i></i>';
      document.body.appendChild(loader);
    }
    loader.classList.add("is-visible");
  }

  async function hideEntryLoaderAfterAssets() {
    const images = $all("main img").filter((image) => !image.complete);
    await Promise.race([
      Promise.all(images.map((image) => new Promise((resolve) => { image.addEventListener("load", resolve, { once: true }); image.addEventListener("error", resolve, { once: true }); }))),
      new Promise((resolve) => setTimeout(resolve, 3200))
    ]);
    const loader = $("[data-entry-loader]");
    if (loader) {
      loader.classList.remove("is-visible");
      setTimeout(() => loader.remove(), 420);
    }
  }

  function initGameDrawer() {
    if (!document.querySelector(".site-header")) return;
    let drawer = document.querySelector(".blog-game-drawer");
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.className = "blog-game-drawer";
      drawer.innerHTML = `<button class="blog-game-tab" type="button" data-game-drawer-toggle aria-expanded="false" aria-label="打开小罗自制小游戏"><img src="./assets/images/xiaoluo-jump-game-icon.jpg" alt=""></button><button class="blog-game-dismiss" type="button" data-game-drawer-dismiss aria-label="关闭右侧小游戏入口">×</button><div class="blog-game-drawer-panel"><img src="./assets/images/xiaoluo-jump-game-icon.jpg" alt="小罗小游戏图标"><p class="mini-title">XIAOLUO MINI GAME</p><h2>小罗游戏空间</h2><p>打开游戏列表，选择想玩的小游戏。</p><a class="primary-button small" href="./game.html" data-game-entry>进入游戏</a></div>`;
      document.body.appendChild(drawer);
      const toggle = $("[data-game-drawer-toggle]", drawer);
      const close = () => { drawer.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };
      const dismiss = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        close();
        drawer.hidden = true;
        drawer.style.display = "none";
      };
      toggle.onclick = () => { const open = drawer.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); };
      $("[data-game-drawer-dismiss]", drawer).onclick = dismiss;
    }
    // 游戏页面隐藏右侧抽屉
    const shouldHide = pageName() === "game" || pageName() === "snake" || pageName() === "wordfall";
    drawer.hidden = shouldHide;
    drawer.style.display = shouldHide ? "none" : "";
  }

  function ensureJumpGame() {
    const boot = () => {
      if (window.initXiaoLuoJumpGame) { window.initXiaoLuoJumpGame(); return; }
      let script = document.querySelector("script[data-jump-game-script]");
      if (!script) {
        script = document.createElement("script");
        script.src = "./js/game.js";
        script.dataset.jumpGameScript = "true";
        script.onload = () => window.initXiaoLuoJumpGame?.();
        document.body.appendChild(script);
      }
    };
    // 双 rAF 确保 PJAX 替换的 DOM 完全就绪后再初始化游戏
    requestAnimationFrame(() => requestAnimationFrame(boot));
  }

  function ensureSnakeGame() {
    const boot = () => {
      if (window.initXiaoLuoSnakeGame) { window.initXiaoLuoSnakeGame(); return; }
      let script = document.querySelector("script[data-snake-game-script]");
      if (!script) {
        script = document.createElement("script");
        script.src = "./js/snake.js";
        script.dataset.snakeGameScript = "true";
        script.onload = () => window.initXiaoLuoSnakeGame?.();
        document.body.appendChild(script);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(boot));
  }

  function ensureWordfallGame() {
    const boot = () => {
      if (window.initXiaoLuoWordfall) { window.initXiaoLuoWordfall(); return; }
      let script = document.querySelector("script[data-wordfall-game-script]");
      if (!script) {
        script = document.createElement("script");
        script.src = "./js/wordfall.js";
        script.dataset.wordfallGameScript = "true";
        script.onload = () => window.initXiaoLuoWordfall?.();
        document.body.appendChild(script);
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(boot));
  }

  async function navigate(url, push = true) {
    const navigationVersion = ++state.navigationVersion;
    state.navigationController?.abort();
    const navigationController = new AbortController();
    state.navigationController = navigationController;
    const notesModal = $("[data-notes-desk-modal]");
    const notesWasOpen = Boolean(notesModal?.classList.contains("open"));
    if (notesWasOpen) state.notesReturnOpen = true;
    $("[data-notes-context-menu]", notesModal || document)?.remove();
    notesModal?.classList.remove("open");
    $all(".modal.open").forEach((modal) => {
      if (!modal.matches("[data-notes-desk-modal]")) modal.classList.remove("open");
    });
    const savingOverlay = $("[data-saving-overlay]");
    if (savingOverlay) savingOverlay.hidden = true;
    // 保存音乐状态，导航后强制恢复
    const audio = document.body.querySelector(":scope > [data-music-player]");
    const savedMusic = audio ? {
      src: audio.currentSrc || audio.src,
      currentTime: audio.currentTime,
      paused: audio.paused,
      volume: audio.volume,
      muted: audio.muted,
      musicIndex: state.musicIndex
    } : null;
    state.navigating = true;

    let response;
    try {
      response = await fetch(url, { cache: "no-store", signal: navigationController.signal });
    } catch (error) {
      if (error?.name === "AbortError") return;
      state.navigating = false;
      throw error;
    }
    if (navigationVersion !== state.navigationVersion) return;
    if (!response.ok) {
      state.navigating = false;
      window.location.href = url;
      return;
    }
    const html = await response.text();
    if (navigationVersion !== state.navigationVersion) return;
    const nextDoc = new DOMParser().parseFromString(html, "text/html");
    const nextMain = nextDoc.querySelector("main");
    const currentMain = document.querySelector("main");
    const currentHasHeader = Boolean(document.querySelector(".site-header"));
    const nextHasHeader = Boolean(nextDoc.querySelector(".site-header"));
    if (!nextMain || !currentMain || currentHasHeader !== nextHasHeader) {
      state.navigating = false;
      window.location.href = url;
      return;
    }
    if (pageName() === "game") window.destroyXiaoLuoJumpGame?.();
    if (pageName() === "snake") window.destroyXiaoLuoSnakeGame?.();
    if (pageName() === "wordfall") window.destroyXiaoLuoWordfall?.();
    document.title = nextDoc.title;
    document.body.dataset.page = nextDoc.body.dataset.page || "home";
    document.body.classList.toggle("game-page", nextDoc.body.classList.contains("game-page"));
    document.body.classList.toggle("snake-page", nextDoc.body.classList.contains("snake-page"));
    document.body.classList.toggle("wordfall-page", nextDoc.body.classList.contains("wordfall-page"));
    currentMain.replaceWith(nextMain);
    if (push) history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
    applyAuthUI();

    // 恢复音乐状态的函数
    const restoreMusic = () => {
      if (!audio || !savedMusic) return;
      const curSrc = audio.currentSrc || audio.src;
      if (curSrc !== savedMusic.src) {
        audio.src = savedMusic.src;
      }
      if (savedMusic.currentTime > 0 && Math.abs(audio.currentTime - savedMusic.currentTime) > 1) {
        try { audio.currentTime = savedMusic.currentTime; } catch (_) {}
      }
      audio.volume = savedMusic.volume;
      audio.muted = savedMusic.muted;
      state.musicIndex = savedMusic.musicIndex;
      if (!savedMusic.paused && audio.paused) {
        audio.play().catch(() => {});
      }
    };

    // 渲染页面
    requestAnimationFrame(() => {
      if (navigationVersion !== state.navigationVersion) return;
      renderCurrentPage();
      // The home cards are data-driven. After a PJAX main replacement, give
      // the new home container one extra frame to settle before hydrating it.
      if (pageName() === "home") {
        requestAnimationFrame(renderHome);
        window.setTimeout(() => { if (pageName() === "home") renderHome(); }, 120);
      }
      restoreMusic();
      // 多次延迟恢复，防止异步操作导致切歌
      setTimeout(restoreMusic, 0);
      setTimeout(restoreMusic, 100);
      setTimeout(restoreMusic, 300);
      setTimeout(() => {
        if (navigationVersion !== state.navigationVersion) return;
        restoreMusic();
        state.navigating = false;
        state.navigationController = null;
      }, 600);
      // A notes modal can only be created through the admin-only entry. Its
      // existing owner marker is sufficient here and also makes restoration
      // independent of a slow auth refresh after returning home.
      if (pageName() === "home" && state.notesReturnOpen && notesModal?.isConnected) {
        notesModal.classList.add("open");
      }
    });
  }

  function initPjax() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (link.target || link.hasAttribute("download") || (url.hash && url.pathname === location.pathname)) return;
      if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return;
      // Lock restricted articles before navigation. This keeps the full article
      // content out of the detail view until the reader has earned the level.
      if (link.classList.contains("article-card-hit") && url.pathname.endsWith("article-detail.html")) {
        const postId = url.searchParams.get("id");
        const post = data.posts.find((item) => item.id === postId);
        const requiredScore = Number(post?.minActivityScore) || 0;
        if (requiredScore && !hasActivityAccess(requiredScore)) {
          event.preventDefault();
          const level = activityLevelForScore(requiredScore);
          if (!state.isLoggedIn) {
            showActivityNotice("登录后查看", `这篇文章需要达到「${level.title}」才能阅读，请先登录后再参与互动。`, { login: true });
          } else {
            showActivityNotice("称号权限不足", `这篇文章需要达到「${level.title}」才能阅读。你当前活跃度为 ${state.activityScore}，请提升后再阅读。`);
          }
          return;
        }
      }
      if (url.pathname.endsWith("whispers.html") && !state.isLoggedIn) {
        event.preventDefault();
        showWhisperLoginModal();
        return;
      }
      if (url.pathname.endsWith("whispers.html") && state.isLoggedIn) {
        // Clear the badge before navigation so the nav is immediately just "碎碎念".
        updateWhisperUnreadBadge(true);
      }
      event.preventDefault();
      navigate(url.href).catch(() => {
        sessionStorage.setItem("xiaoluo-music-state", JSON.stringify({
          index: state.musicIndex,
          time: document.querySelector("[data-music-player]")?.currentTime || 0,
          playing: !document.querySelector("[data-music-player]")?.paused
        }));
        window.location.href = url.href;
      });
    });
    window.addEventListener("popstate", () => navigate(location.href, false));
  }

  function initPostContextMenu() {
    if (document.body.dataset.postContextBound) return;
    document.body.dataset.postContextBound = "true";
    document.addEventListener("contextmenu", (event) => {
      const card = event.target.closest(".article-card, .article-detail");
      if (!card || !state.isAdmin) return;
      event.preventDefault();
      const id = card.dataset.postId || new URL($("a[href*='article-detail']", card)?.href || location.href).searchParams.get("id");
      if (!id) return;
      confirmPublish("确认删除这篇文章？", "删除后无法恢复。", "确认删除").then(async (confirmed) => {
        if (!confirmed) return;
        try {
          await window.XiaoLuoSupabase.deleteContent("posts", id, state.userId);
          data.posts = data.posts.filter((post) => post.id !== id);
          renderCurrentPage();
        } catch (error) { showCloudError(error); }
      });
    });
  }

  function initPostDeleteActions() {
    if (document.body.dataset.postDeleteBound) return;
    document.body.dataset.postDeleteBound = "true";
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-post]");
      if (!button || button.closest("[data-admin-posts]")) return;
      event.preventDefault();
      confirmPublish("确认删除这篇文章？", "删除后无法恢复。", "确认删除").then(async (confirmed) => {
        if (!confirmed) return;
        try {
          await window.XiaoLuoSupabase.deleteContent("posts", button.dataset.deletePost, state.userId);
          data.posts = data.posts.filter((post) => post.id !== button.dataset.deletePost);
          navigate("./articles.html");
        } catch (error) { showCloudError(error); }
      });
    });
  }

  function initWebSearch() {
    if (document.body.dataset.webSearchBound) return;
    document.body.dataset.webSearchBound = "true";
    const engineNames = { baidu: "百度", google: "谷歌", bing: "必应" };
    let currentEngine = localStorage.getItem("xiaoluo-search-engine") || "baidu";

    // 初始化按钮显示
    document.querySelectorAll("[data-search-engine-current]").forEach((btn) => {
      const label = btn.querySelector(".search-engine-label");
      if (label) label.textContent = engineNames[currentEngine] || "百度";
    });
    document.querySelectorAll(".search-engine-option").forEach((opt) => {
      opt.classList.toggle("active", opt.dataset.engine === currentEngine);
    });

    // 下拉菜单展开/收起
    document.addEventListener("click", (event) => {
      const dropdown = event.target.closest("[data-search-engine-dropdown]");
      const allDropdowns = document.querySelectorAll("[data-search-engine-dropdown]");
      allDropdowns.forEach((dd) => {
        if (dd !== dropdown) dd.classList.remove("open");
      });
      if (dropdown) {
        dropdown.classList.toggle("open");
      }
    });

    // 选择搜索引擎
    document.addEventListener("click", (event) => {
      const option = event.target.closest("[data-engine]");
      if (!option) return;
      const dropdown = option.closest("[data-search-engine-dropdown]");
      if (!dropdown) return;
      currentEngine = option.dataset.engine;
      localStorage.setItem("xiaoluo-search-engine", currentEngine);
      const label = dropdown.querySelector(".search-engine-label");
      if (label) label.textContent = engineNames[currentEngine] || currentEngine;
      dropdown.querySelectorAll(".search-engine-option").forEach((opt) => {
        opt.classList.toggle("active", opt.dataset.engine === currentEngine);
      });
      dropdown.classList.remove("open");
    });

    // 搜索提交
    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-web-search]");
      if (!form) return;
      event.preventDefault();
      const query = form.querySelector("input[name='q']")?.value?.trim();
      if (!query) return;
      const urls = {
        baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
        google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`
      };
      window.open(urls[currentEngine] || urls.baidu, "_blank");
    });
  }

  initTheme();
  initMusic();
    initPlaceholders();
  initProtectedDownloads();
  initPjax();
  initPostContextMenu();
  initPostDeleteActions();
  initWebSearch();
  watchAuthState();
  // Clear bundled prototype rows once during startup. Cloud content is loaded
  // immediately below and remains intact across later auth refresh events.
  resetPublicView();
  const entryLoaderEnabled = localStorage.getItem("xiaoluo-entry-loader-enabled") !== "false";
  if (pageName() === "home" && entryLoaderEnabled && !sessionStorage.getItem("xiaoluo-home-entry-seen")) {
    sessionStorage.setItem("xiaoluo-home-entry-seen", "true");
    showEntryLoader();
  }
  refreshAuthState()
    .then(async () => {
      renderCurrentPage();
      await loadCloudData();
      const cloudLoaderEnabled = data.site.contacts?.entry_loader_enabled !== false;
      localStorage.setItem("xiaoluo-entry-loader-enabled", String(cloudLoaderEnabled));
      const entryLoader = $("[data-entry-loader]");
      if (entryLoader && cloudLoaderEnabled) await hideEntryLoaderAfterAssets();
      else entryLoader?.remove();
    })
    .catch(() => { renderCurrentPage(); if ($("[data-entry-loader]")) hideEntryLoaderAfterAssets(); });
})();
