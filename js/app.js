(function () {
  const data = window.NeverBlogData;
  const defaultData = JSON.parse(JSON.stringify(data));
  const state = {
    isLoggedIn: false,
    sessionLoaded: false,
    musicIndex: 0,
    seeking: false,
    musicReady: false,
    userId: null,
    cloudOwnerId: null,
    adminId: null,
    isAdmin: false,
    currentProfile: null,
    activityScore: 0,
    activityTitle: "初入人",
    activityCheckedToday: false,
    activityNextScore: 50,
    activityNextTitle: "漂泊者"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const params = () => new URLSearchParams(window.location.search);
  const pageName = () => document.body.dataset.page || "home";

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
      const progressLink = $("a[href='./progress.html']", nav);
      nav.insertBefore(link, progressLink || $("a[href='./about.html']", nav) || null);
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

  const HIGHLIGHT_COLORS = new Set(["#ffddd8", "#d8f2e2", "#dce9ff"]);
  const PROFILE_TAGS = ["注重感情", "独处", "自由", "全球游", "世界游", "热爱阅读", "探索未知", "爱动脑子", "脑洞大", "敏感", "爱学习", "吃货一枚", "学霸一枚", "热爱生活", "热爱旅游", "喜欢美女", "喜欢帅哥", "爱音乐"];
  const ADMIN_PROFILE_TAGS = ["注重感情", "独处", "自由", "世界游", "热爱阅读", "探索未知"];
  const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];
  const WHISPER_EMOJIS = ["😀", "😂", "🥹", "😭", "😡", "🥳", "❤️", "👍", "✨", "🌈", "🍜", "☕", "🎮", "📚", "🌙", "🔥"];
  const ACTIVITY_LEVELS = [
    { score: 10, title: "初入人", right: "解锁发布、评论功能" },
    { score: 50, title: "漂泊者", right: "解锁小罗生活圈入口" },
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
        [...node.childNodes].forEach((child) => appendClean(child, parent));
        if (node.nextSibling) parent.append(document.createElement("br"));
        return;
      }
      [...node.childNodes].forEach((child) => appendClean(child, parent));
    };
    [...source.childNodes].forEach((node) => appendClean(node, output));
    return output.innerHTML;
  }

  function formatRichText(value) {
    const raw = String(value || "");
    return /<\/?[a-z][\s\S]*>/i.test(raw) ? sanitizeRichHtml(raw) : formatPlainRichText(raw);
  }

  function linkify(value) { return formatRichText(value); }

  function enhanceFormatToolbar(toolbar) {
    if (toolbar.querySelector('[data-format-action="orderedList"]')) return;
    const divider = $(".format-toolbar-divider", toolbar);
    const group = document.createDocumentFragment();
    [["orderedList", "1.", "有序列表"], ["unorderedList", "•", "无序列表"], ["codeBlock", "</>", "插入代码块"]].forEach(([action, label, title]) => {
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
      document.execCommand("insertHTML", false, `<pre data-language="${language}"><code ${languageAttribute}>${escapeHtml(code)}</code></pre><div><br></div>`);
      input.dispatchEvent(new Event("input", { bubbles: true }));
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

  function bindTextFormatToolbars(scope = document) {
    $all("[data-format-toolbar]", scope).forEach((toolbar) => {
      if (toolbar.dataset.bound) return;
      enhanceFormatToolbar(toolbar);
      toolbar.dataset.bound = "true";
      const input = toolbar.parentElement?.querySelector("[data-format-input]");
      if (!input) return;
      $all("[data-format-action]", toolbar).forEach((button) => {
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.onclick = () => {
          if (input.isContentEditable) {
            input.focus();
            const action = button.dataset.formatAction;
            if (action === "bold") document.execCommand("bold");
            else if (action === "underline") document.execCommand("underline");
            else if (action === "orderedList") document.execCommand("insertOrderedList");
            else if (action === "unorderedList") document.execCommand("insertUnorderedList");
            else if (action === "codeBlock") { openCodeBlockDialog(input); return; }
            else if (action === "highlight") document.execCommand("hiliteColor", false, button.dataset.highlightColor || "#dce9ff");
            else if (action === "link") {
              const url = window.prompt("请输入链接地址", "https://");
              if (!url || !/^https?:\/\//i.test(url)) return;
              document.execCommand("createLink", false, url);
              $all("a", input).forEach((link) => { link.target = "_blank"; link.rel = "noopener noreferrer"; });
            }
            input.dispatchEvent(new Event("input", { bubbles: true }));
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
        input.addEventListener("keydown", (event) => {
          if (!(event.ctrlKey || event.metaKey)) return;
          if (event.key.toLowerCase() === "b") { event.preventDefault(); document.execCommand("bold"); }
          if (event.key.toLowerCase() === "u") { event.preventDefault(); document.execCommand("underline"); }
        });
      }
    });
  }

  function editorContentValue(form) {
    const input = $("[data-editor-content]", form);
    return input ? sanitizeRichHtml(input.innerHTML) : (form.content?.value || "");
  }

  function setEditorContent(form, value) {
    const input = $("[data-editor-content]", form);
    if (input) input.innerHTML = formatRichText(value);
    else if (form.content) form.content.value = value || "";
  }

  function contentEntryValue(form) {
    const input = $("[data-content-text]", form);
    return input ? sanitizeRichHtml(input.innerHTML) : (form.text?.value || "");
  }

  function renderPostContent(parts) {
    return (parts || []).filter(Boolean).map((part) => `<div class="post-content-part">${formatRichText(part).replace(/\n/g, "<br>")}</div>`).join("");
  }

  function formatExcerpt(paragraphs) {
    const items = (paragraphs || []).filter(Boolean).slice(0, 2);
    if (!items.length) return "<p>点击查看文章详情。</p>";
    // 首页摘要：剥离 HTML 标签，纯文本截断，避免列表/代码块撑开卡片
    const plain = items.map((item) => String(item).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).join(" ");
    const truncated = plain.length > 90 ? plain.slice(0, 90) + "…" : plain;
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
    const maxSide = options.maxSide || 1920;
    const targetBytes = options.targetBytes || 600 * 1024;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      let width = bitmap.width;
      let height = bitmap.height;
      const initialScale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.max(1, Math.round(width * initialScale));
      height = Math.max(1, Math.round(height * initialScale));
      let blob = null;
      for (let pass = 0; pass < 4; pass += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        for (const quality of [.84, .76, .68, .6, .52]) {
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
      const tooltip = $("[data-contact-value]", item);
      if (tooltip) tooltip.textContent = value || "暂未填写";
      item.classList.toggle("has-contact", Boolean(value));
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
    const update = () => {
      const point = 140;
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
    resetPublicView();
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
    try {
      const adminProfile = await api.getAdminProfile();
      if (!adminProfile) return;
      state.adminId = adminProfile.id;
      const ownerId = adminProfile.id;
      const [categories, tags, moments, progress, posts, musicTracks, lockedMomentTeasers] = await Promise.all([
        api.listTaxonomy("categories", ownerId),
        api.listTaxonomy("tags", ownerId),
        api.listContent("moments", ownerId),
        api.listContent("progress_logs", ownerId),
        state.isAdmin ? api.listPosts(ownerId) : api.listPublishedPosts(ownerId),
        api.listMusicTracks(ownerId),
        api.listMomentTeasers ? api.listMomentTeasers(ownerId).catch(() => []) : Promise.resolve([])
      ]);
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
      const updateDates = [adminProfile.updated_at, ...posts.map((item) => item.updated_at || item.created_at), ...moments.map((item) => item.updated_at || item.created_at), ...progress.map((item) => item.updated_at || item.created_at), ...musicTracks.map((item) => item.updated_at || item.created_at)].filter(Boolean);
      data.site.lastUpdatedAt = updateDates.sort((a, b) => new Date(b) - new Date(a))[0] || "";
      data.categories = categories.map((item) => ({ id: item.id, name: item.name, description: "" }));
      data.tags = tags.map((item) => ({ id: item.id, name: item.name }));
      const visibleMoments = moments.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [], isPublic: Boolean(item.is_public) }));
      const lockedMoments = lockedMomentTeasers.filter((item) => !visibleMoments.some((moment) => moment.id === item.id)).map((item) => ({ id: item.id, title: "生活圈内容已锁定", date: item.entry_date, text: "登录后活跃值达到50可以解锁内容", images: [], isLocked: true, isPublic: false }));
      data.moments = sortTimelineByDate([...visibleMoments, ...lockedMoments]);
      data.progress = sortTimelineByDate(progress.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [] })));
      data.posts = posts.map((item) => ({ id: item.id, title: item.title, author: data.site.profileName, category: item.category || "未分类", tags: item.tags || [], attachments: item.attachments || [], publishedAt: formatPostDate(item.created_at), coverUrl: item.cover_url || "", coverClass: "gradient-a", excerpt: (item.content || "").replace(/<[^>]+>/g, "").slice(0, 110), content: [item.content || ""], featured: false }));
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
      if (pageName() === "life") renderTimeline("[data-life-timeline]", data.moments);
      if (pageName() === "progress") renderTimeline("[data-progress-timeline]", data.progress);
      if (pageName() === "about") renderAbout();
      if (pageName() === "photos") renderGallery();
      if (pageName() === "editor") prepareEditorForEdit();
    } catch (error) {
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
  }

  function bindThemeButtons() {
    $all("[data-theme-toggle]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem("neverblog-theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
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

  function setActiveNav() {
    const current = location.pathname.split("/").pop() || "index.html";
    $all(".top-nav a").forEach((link) => {
      const target = new URL(link.href, location.href).pathname.split("/").pop() || "index.html";
      link.classList.toggle("active", target === current);
    });
  }

  function postCard(post) {
    return `
      <article class="article-card glass-card ${post.coverUrl ? "has-cover" : "no-cover"}" data-post-id="${escapeHtml(post.id)}">
        <a class="article-card-hit" href="./article-detail.html?id=${post.id}" aria-label="阅读 ${escapeHtml(post.title)}"></a>
        ${post.coverUrl ? `<span class="article-cover ${post.coverClass}"><img src="${post.coverUrl}" alt="${escapeHtml(post.title)} 封面"></span>` : ""}
        <div class="article-body">
          <p class="mini-title">${escapeHtml(post.category)}</p>
          <h3>${escapeHtml(post.title)}</h3>
          <div class="article-excerpt">${formatExcerpt(post.content || [post.excerpt])}</div>
          <div class="article-meta"><span>${formatPostDate(post.publishedAt)}</span><span>${escapeHtml(post.author)}</span></div>
          <span class="article-engagement" data-post-card-engagement data-post-card-id="${escapeHtml(post.id)}">阅读 0 · 点赞 0 · 评论 0</span>
          ${post.attachments?.length ? `<p class="article-attachment-hint">含 ${post.attachments.length} 个附件，进入详情可下载</p>` : ""}
          <div class="tag-row">${post.tags.map((tag) => `<a href="./articles.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
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
      data.tags.forEach((tag) => tagFilter.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(typeof tag === "string" ? tag : tag.name)}">${escapeHtml(typeof tag === "string" ? tag : tag.name)}</option>`));
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
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-content-editor-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="编辑帖子"><button class="modal-close" type="button" data-content-editor-close aria-label="关闭">×</button><p class="mini-title">POST EDITOR</p><h2 data-content-editor-heading>编辑帖子</h2><form data-content-editor-form><label><span>标题</span><input name="title" type="text" required></label><label><span>日期</span><input name="date" type="date" required></label><label><span>正文</span><div class="text-format-editor"><div class="text-format-toolbar" data-format-toolbar><button type="button" data-format-action="bold" title="加粗（Ctrl+B）"><b>B</b></button><button type="button" data-format-action="underline" title="下划线（Ctrl+U）"><u>U</u></button><button type="button" data-format-action="link" title="添加超链接">↗</button><span class="format-toolbar-divider"></span><button type="button" class="format-highlight red" data-format-action="highlight" data-highlight-color="#ffddd8" title="红色高亮"></button><button type="button" class="format-highlight green" data-format-action="highlight" data-highlight-color="#d8f2e2" title="绿色高亮"></button><button type="button" class="format-highlight blue" data-format-action="highlight" data-highlight-color="#dce9ff" title="蓝色高亮"></button></div><div class="rich-text-input compact" data-format-input data-content-editor-body contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="选择文字后可使用加粗、下划线、链接和高亮"></div></div></label><section class="post-editor-images"><div><strong>已有图片</strong><p>可替换或删除单张图片。</p></div><div class="content-editor-image-grid" data-content-editor-images></div></section><label><span>添加图片</span><input name="newImages" type="file" accept="image/*" multiple></label><div class="publish-confirm-actions"><button class="danger-button" type="button" data-content-editor-delete>删除整条帖子</button><button class="primary-button" type="submit">保存修改</button></div></form></section>`;
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
            renderTimeline("[data-life-timeline]", data.moments);
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
    $all("[data-profile-moment-count]").forEach((el) => { el.textContent = data.moments.length; });
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
    $("[data-activity-heatmap-title]").textContent = "全站 365 天活跃热力图";
    try {
      const rows = await window.XiaoLuoSupabase.getActivityHeatmap(targetUserId);
      const counts = new Map(rows.map((row) => [row.date, row.count]));
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
      const mondayOffset = (start.getDay() + 6) % 7;
      const cells = Array.from({ length: mondayOffset }, () => '<i class="is-empty" aria-hidden="true"></i>');
      for (let index = 0; index < 365; index += 1) {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const count = counts.get(key) || 0;
        const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : count < 11 ? 4 : 5;
        cells.push(`<i class="level-${level}" title="${key} · ${count} 次活跃" aria-label="${key}，${count}次活跃"></i>`);
      }
      grid.innerHTML = cells.join("");
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
        items.filter((item) => item.parent_id).forEach((item) => {
          if (!repliesByParent.has(item.parent_id)) repliesByParent.set(item.parent_id, []);
          repliesByParent.get(item.parent_id).push(item);
        });
        const renderReply = (item) => {
          const itemProfile = item.profile || {};
          const name = itemProfile.display_name || "普通用户";
          const avatar = itemProfile.avatar_url || "";
          const canDelete = state.isAdmin || item.user_id === state.userId;
          return `<article class="whisper-reply"><button class="whisper-avatar comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${item.user_id}"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</button><div><header><button type="button" data-profile-user-id="${item.user_id}">${escapeHtml(name)}</button><time>${formatPostDate(item.created_at)}</time></header><p class="whisper-rich-text">${renderWhisperContent(item.content)}</p></div>${canDelete ? `<button class="whisper-delete" type="button" data-delete-whisper="${item.id}">删除</button>` : ""}</article>`;
        };
        feed.innerHTML = items.filter((item) => !item.parent_id).map((item) => {
          const itemProfile = item.profile || {};
          const name = itemProfile.display_name || "普通用户";
          const avatar = itemProfile.avatar_url || "";
          const canDelete = state.isAdmin || item.user_id === state.userId;
          const replies = repliesByParent.get(item.id) || [];
          return `<article class="whisper-card glass-card${item.user_id === state.userId ? " is-own" : ""}"><button class="whisper-avatar comment-avatar${avatar ? " has-image" : ""}" type="button" data-profile-user-id="${item.user_id}" aria-label="查看${escapeHtml(name)}的资料"${avatar ? ` style="background-image:url('${escapeHtml(avatar)}')"` : ""}>${avatar ? "" : escapeHtml(name.slice(0, 1))}</button><div class="whisper-card-body"><header><button type="button" data-profile-user-id="${item.user_id}">${escapeHtml(name)}</button>${itemProfile.is_admin ? '<span class="whisper-author-badge">作者</span>' : ""}${item.user_id === state.userId ? '<span class="whisper-own-badge">我的碎碎念</span>' : ""}<time>${formatPostDate(item.created_at)}</time></header><p class="whisper-rich-text">${renderWhisperContent(item.content)}</p><button class="comment-reply-button" type="button" data-reply-whisper="${item.id}" data-reply-name="${escapeHtml(name)}">回复</button>${replies.length ? `<div class="whisper-replies">${replies.map(renderReply).join("")}</div>` : ""}</div>${canDelete ? `<button class="whisper-delete" type="button" data-delete-whisper="${item.id}" aria-label="删除这条碎碎念">删除</button>` : ""}</article>`;
        }).join("") || '<p class="empty-state">这里还没有碎碎念，来写下第一条吧。</p>';
        $all("[data-reply-whisper]", feed).forEach((button) => { button.onclick = () => { replyTo = button.dataset.replyWhisper; replyBar.hidden = false; replyBar.querySelector("span").textContent = `正在回复 ${button.dataset.replyName}`; textarea.focus(); textarea.scrollIntoView({ behavior: "smooth", block: "center" }); }; });
        $all("[data-delete-whisper]", feed).forEach((button) => {
          button.onclick = async () => {
            if (!await confirmPublish("确认删除这条碎碎念？", "删除后无法恢复。", "确认删除")) return;
            try { await window.XiaoLuoSupabase.deleteWhisper(button.dataset.deleteWhisper); await draw(); } catch (error) { showCloudError(error); }
          };
        });
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
    form.q.value = params().get("q") || "";
    form.category.value = params().get("category") || "";
    form.tag.value = params().get("tag") || "";

    const draw = () => {
      const q = form.q.value.trim().toLowerCase();
      const category = form.category.value;
      const tag = form.tag.value;
      const filtered = data.posts.filter((post) => {
        const hitText = [post.title, post.excerpt, post.category, post.tags.join(" ")].join(" ").toLowerCase().includes(q);
        return hitText && (!category || post.category === category) && (!tag || post.tags.includes(tag));
      });
      const total = Math.max(1, Math.ceil(filtered.length / pageSize));
      currentPage = Math.min(currentPage, total);
      list.innerHTML = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(postCard).join("") || '<p class="empty-state">暂时没有找到文章。</p>';
      loadPostCardEngagement(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), list);
      if (pagination) pagination.innerHTML = Array.from({ length: total }, (_, index) => `<button class="${index + 1 === currentPage ? "active" : ""}" type="button" data-page-number="${index + 1}">${index + 1}</button>`).join("");
    };

    if (!form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
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
    const index = data.posts.findIndex((item) => item.id === post.id);
    const prev = data.posts[index - 1];
    const next = data.posts[index + 1];
    document.title = `${post.title} | ${data.site.name}`;
    wrap.innerHTML = `
      <section class="article-detail-layout">
      <article class="article-detail glass-card" data-post-id="${post.id}">
        <p class="eyebrow">${escapeHtml(post.category)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta detail-meta"><span>${escapeHtml(post.author)}</span><span>${formatPostDate(post.publishedAt)}</span><span>${escapeHtml(post.category)}</span></div>
        <div class="tag-row">${post.tags.map((tag) => `<a href="./articles.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
        ${post.coverUrl ? `<div class="detail-cover"><img src="${post.coverUrl}" alt="${escapeHtml(post.title)} 封面"></div>` : ""}
        <div class="post-content">${renderPostContent(post.content)}</div>
        ${post.attachments?.length ? `<section class="post-attachments"><h2>附件下载</h2>${post.attachments.map((file) => `<a href="${file.url}" data-protected-download download="${escapeHtml(file.name)}" target="_blank" rel="noopener">下载：${escapeHtml(file.name)}</a>`).join("")}</section>` : ""}
        <div class="post-actions">
          ${state.isAdmin && state.cloudOwnerId === state.userId ? `<a class="ghost-button" href="./editor.html?id=${post.id}">编辑文章</a>` : ""}
          ${state.isAdmin && state.cloudOwnerId === state.userId ? `<button class="danger-button" type="button" data-delete-post="${post.id}">删除文章</button>` : ""}
          <button type="button" data-post-like="${post.id}">点赞</button>
          <button type="button" data-placeholder-action="bookmark">收藏</button>
          <span class="post-engagement" data-post-engagement>阅读 0 · 点赞 0 · 评论 0</span>
        </div>
      </article>
      <aside class="comments glass-card detail-comments-sidebar">
        <h2>评论</h2>
        <p data-comment-note>登录后可以发表评论。</p>
        <form data-post-comment-form data-post-id="${post.id}"><textarea name="content" placeholder="写下你的评论" maxlength="1000"></textarea><button class="primary-button small" type="submit">发表评论</button></form>
        <div class="comment-list" data-comment-list></div>
      </aside>
      </section>
      <nav class="post-neighbor">
        ${prev ? `<a href="./article-detail.html?id=${prev.id}">上一篇：${escapeHtml(prev.title)}</a>` : "<span>已经是最新文章</span>"}
        ${next ? `<a href="./article-detail.html?id=${next.id}">下一篇：${escapeHtml(next.title)}</a>` : "<span>已经是最后一篇</span>"}
      </nav>
    `;
    highlightCodeBlocks(wrap);
    loadPostEngagement(post.id);
  }

  async function loadPostEngagement(postId) {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    try {
      await api.recordPostView(postId, state.userId);
      const engagement = await api.getPostEngagement(postId, state.userId, api.getVisitorId());
      const summary = $("[data-post-engagement]");
      if (summary) summary.textContent = `阅读 ${engagement.views} · 点赞 ${engagement.likes} · 评论 ${engagement.comments.length}`;
      const likeButton = $("[data-post-like]");
      if (likeButton) {
        likeButton.textContent = engagement.liked ? `已点赞 ${engagement.likes}` : `点赞 ${engagement.likes}`;
        likeButton.classList.toggle("is-liked", engagement.liked);
        likeButton.onclick = async () => {
          try { await api.togglePostLike(postId, state.userId, engagement.liked, api.getVisitorId()); await refreshAuthState(); await loadPostEngagement(postId); } catch (error) { showCloudError(error); }
        };
      }
      const note = $("[data-comment-note]");
      if (note) note.textContent = state.isLoggedIn ? "评论会保存到文章下方。" : "请先登录后发表评论。";
      const commentList = $("[data-comment-list]");
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
      const form = $("[data-post-comment-form]");
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
    }
  }

  function loadPostCardEngagement(posts, scope) {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured || !posts?.length || !scope) return;
    posts.forEach(async (post) => {
      try {
        const engagement = await api.getPostEngagementSummary(post.id);
        const target = scope.querySelector(`[data-post-card-id="${post.id}"]`);
        if (target) target.textContent = `阅读 ${engagement.views} · 点赞 ${engagement.likes} · 评论 ${engagement.comments}`;
      } catch (error) { console.warn("Post card engagement load failed:", error.message); }
    });
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
      "[data-about-moment-count]": data.moments.length,
      "[data-about-progress-count]": data.progress.length
    };
    Object.entries(stats).forEach(([selector, count]) => {
      const target = $(selector);
      if (target) target.textContent = count;
    });
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
        const icon = type === "github" ? '<i class="social-icon social-icon-github" aria-hidden="true"></i>' : type === "instagram" ? '<i class="social-icon social-icon-instagram" aria-hidden="true"></i>' : type === "douyin" ? '<i class="about-platform-icon iconfont icon-douyin2" aria-hidden="true"></i>' : '<i class="about-platform-icon email" aria-hidden="true">@</i>';
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
      email: form.contactEmail?.value.trim() || "",
      github: form.contactGithub?.value.trim() || "https://github.com/LuoLuowo",
      douyin: form.contactDouyin?.value.trim() || "",
      instagram: form.contactInstagram?.value.trim() || "xiaoluo672"
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
        initBrand();
        alert("已保存到 Supabase，首页现在已经生效。");
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
          msg.textContent = "正在处理...";
          const requestedNext = new URLSearchParams(location.search).get("next");
          const nextPage = requestedNext && requestedNext.startsWith("/") ? `.${requestedNext}` : "";
          if (form.dataset.authForm === "register") {
            const result = await api.signUpWithEmail(form.email.value, form.password.value);
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
            const cover = form.cover?.files?.[0] ? await uploadOptimizedImage(state.userId, "post-covers", form.cover.files[0]) : oldCover;
            if (cancelled()) return;
            const attachmentFiles = Array.from(form.attachments?.files || []);
            const attachments = [...(existing?.attachments || []), ...await Promise.all(attachmentFiles.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "post-attachments", file) })))];
            if (cancelled()) return;
            const postData = { title: form.title.value.trim(), content: editorContentValue(form).trim(), cover_url: cover, category: form.category.value || "未分类", tags: form.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean), attachments, status: "published" };
            if (editingId) await window.XiaoLuoSupabase.updatePost(state.userId, editingId, postData);
            else await window.XiaoLuoSupabase.savePost(state.userId, postData);
            if (editingId && form.cover?.files?.[0] && oldCover && oldCover !== cover) await window.XiaoLuoSupabase.deleteFilesByPublicUrls([oldCover]);
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
    if (coverSection && coverPreview) {
      coverSection.hidden = !post.coverUrl;
      coverPreview.src = post.coverUrl || "";
      if (coverInputLabel) coverInputLabel.textContent = post.coverUrl ? "替换封面" : "文章封面";
    }
    if (attachmentSection && attachmentList) {
      attachmentSection.hidden = !(post.attachments?.length);
      attachmentList.innerHTML = (post.attachments || []).map((file, index) => `<div><a href="${file.url}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a><button class="danger-button" type="button" data-delete-post-attachment="${index}">删除</button></div>`).join("");
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
      ...data.progress.map((item) => `${item.title || ""}${item.text || ""}`)
    ].reduce((count, value) => count + value.replace(/\s/g, "").length, 0);
    const totalAttachments = data.posts.reduce((count, post) => count + (post.attachments?.length || 0), 0);
    const totalImages = [...data.moments, ...data.progress].reduce((count, item) => count + (item.images?.length || 0), 0);
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

  let visitorMonitorState = { tab: "online", loading: false, allRows: [], displayCount: 20, searchQuery: "" };

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
      else if (tab === "today") rows = await api.getTodayVisitorsDetail?.() || [];
      else if (tab === "repeat") rows = await api.getRepeatVisitorsDetail?.() || [];
      else rows = await api.getAllVisitorsDetail?.() || [];

      // 按日期从最新往下排
      rows.sort((a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0));

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
    const query = (visitorMonitorState.searchQuery || "").trim().toLowerCase();
    let rows = visitorMonitorState.allRows || [];
    // IP 搜索过滤（支持 IPv4 / IPv6，部分匹配）
    if (query) {
      rows = rows.filter((row) => {
        const ip = (row.ip_address || "").toLowerCase();
        return ip.includes(query);
      });
    }
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
      // 访问次数徽章
      const visitCount = Number(row.visit_count) || 1;
      const countBadge = `<span class="visitor-count" title="累计访问次数">第${visitCount}次</span>`;
      // 位置显示，未知位置提供 hiofd 手动查询链接
      let locEl;
      if (row.ip_location && row.ip_location !== "未知地址") {
        locEl = `<span class="visitor-loc">${escapeHtml(row.ip_location)}</span>`;
      } else {
        const queryUrl = `https://tool.hiofd.com/ip/?ip=${encodeURIComponent(fullIp)}`;
        locEl = `<span class="visitor-loc unknown">未知位置 <a href="${queryUrl}" target="_blank" rel="noopener" class="visitor-loc-lookup" title="使用 hiofd 查询此 IP 归属地">查位置</a></span>`;
      }
      const timeText = formatVisitorTime(row.last_seen);
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
      searchInput.addEventListener("input", () => {
        visitorMonitorState.searchQuery = searchInput.value;
        visitorMonitorState.displayCount = 20;
        renderVisitorRows();
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
    if (albumWrap) albumWrap.innerHTML = data.albums.map((album) => `<div class="manager-row"><strong>${escapeHtml(album.title)}</strong><span>${escapeHtml(album.meta)}</span><div><button type="button" data-edit-content data-type="album" data-id="${escapeHtml(album.id)}">编辑</button><button type="button" data-remove-content data-type="album" data-id="${escapeHtml(album.id)}">删除</button></div></div>`).join("");
    if (momentWrap) momentWrap.innerHTML = "";
    if (progressWrap) progressWrap.innerHTML = "";
  }

  async function protectDashboard() {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    const session = await refreshAuthState();
    if (!session) window.location.href = "./login.html";
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
    bindThemeButtons();
    bindTextFormatToolbars();
    bindNavToggle();
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
    startWhisperUnreadPolling();
    updateWhisperUnreadBadge(page === "whispers");
    if (page === "home") renderHome();
    if (page === "articles") renderArticles();
    if (page === "categories") renderCategories();
    if (page === "article-detail") renderDetail();
    if (page === "life") renderTimeline("[data-life-timeline]", data.moments);
    if (page === "progress") renderTimeline("[data-progress-timeline]", data.progress);
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
    if (page === "dashboard") {
      protectDashboard().then(() => {
        if (!state.isAdmin) return;
        initDashboardSectionSpy();
        initContentManagement();
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
      drawer.innerHTML = `<button class="blog-game-tab" type="button" data-game-drawer-toggle aria-expanded="false" aria-label="打开小罗自制小游戏"><img src="./assets/images/xiaoluo-jump-game-icon.jpg" alt=""></button><div class="blog-game-drawer-panel"><button class="blog-game-close" type="button" data-game-drawer-close aria-label="关闭小游戏入口">×</button><img src="./assets/images/xiaoluo-jump-game-icon.jpg" alt="小罗跳一跳图标"><p class="mini-title">XIAOLUO MINI GAME</p><h2>小罗自制小游戏</h2><p>小罗跳一跳：按住蓄力，松开起跳。</p><a class="primary-button small" href="./game.html" data-game-entry>开玩</a></div>`;
      document.body.appendChild(drawer);
      const toggle = $("[data-game-drawer-toggle]", drawer);
      const close = () => { drawer.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };
      toggle.onclick = () => { const open = drawer.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); };
      $("[data-game-drawer-close]", drawer).onclick = close;
    }
    // 游戏页面隐藏右侧抽屉
    drawer.style.display = pageName() === "game" ? "none" : "";
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

  async function navigate(url, push = true) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      window.location.href = url;
      return;
    }
    const html = await response.text();
    const nextDoc = new DOMParser().parseFromString(html, "text/html");
    const nextMain = nextDoc.querySelector("main");
    const currentMain = document.querySelector("main");
    const currentHasHeader = Boolean(document.querySelector(".site-header"));
    const nextHasHeader = Boolean(nextDoc.querySelector(".site-header"));
    if (!nextMain || !currentMain || currentHasHeader !== nextHasHeader) {
      window.location.href = url;
      return;
    }
    if (pageName() === "game") window.destroyXiaoLuoJumpGame?.();
    document.title = nextDoc.title;
    // 只更新 data-page 和必要的页面 class（如 game-page），不整体替换 className，避免全局样式重计算
    document.body.dataset.page = nextDoc.body.dataset.page || "home";
    document.body.classList.toggle("game-page", nextDoc.body.classList.contains("game-page"));
    currentMain.replaceWith(nextMain);
    if (push) history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 只用内存中已有的认证状态更新 UI，不发网络请求，不重置数据
    applyAuthUI();
    // 延迟渲染，让音频播放不被阻塞
    requestAnimationFrame(() => renderCurrentPage());
  }

  function initPjax() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (link.target || link.hasAttribute("download") || (url.hash && url.pathname === location.pathname)) return;
      if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return;
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

  initTheme();
  initMusic();
    initPlaceholders();
  initProtectedDownloads();
  initPjax();
  initPostContextMenu();
  initPostDeleteActions();
  watchAuthState();
  if (pageName() === "home" && !sessionStorage.getItem("xiaoluo-home-entry-seen")) {
    sessionStorage.setItem("xiaoluo-home-entry-seen", "true");
    showEntryLoader();
  }
  refreshAuthState()
    .then(async () => {
      renderCurrentPage();
      await loadCloudData();
      if ($("[data-entry-loader]")) await hideEntryLoaderAfterAssets();
    })
    .catch(() => { renderCurrentPage(); if ($("[data-entry-loader]")) hideEntryLoaderAfterAssets(); });
})();
