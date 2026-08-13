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
    currentProfile: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const params = () => new URLSearchParams(window.location.search);
  const pageName = () => document.body.dataset.page || "home";

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function linkify(value) {
    return escapeHtml(value).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function formatExcerpt(paragraphs) {
    return (paragraphs || []).filter(Boolean).slice(0, 2).map((paragraph) => `<p>${linkify(paragraph)}</p>`).join("") || "<p>点击查看文章详情。</p>";
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
    $all("[data-site-name]").forEach((el) => { el.textContent = data.site.name; });
    $all("[data-site-logo]").forEach((el) => { el.textContent = data.site.logoText; });
    $all("[data-profile-avatar]").forEach((el) => {
      const fallback = el.classList.contains("avatar") ? (data.site.logoText || "罗") : (data.site.avatarText || data.site.logoText);
      el.textContent = fallback;
      const avatarUrl = data.site.avatarDataUrl || "";
      el.classList.toggle("has-avatar-image", Boolean(avatarUrl));
      el.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
      if (avatarUrl && !el.dataset.avatarChecked) {
        el.dataset.avatarChecked = "true";
        const image = new Image();
        image.onerror = () => {
          el.classList.remove("has-avatar-image");
          el.style.backgroundImage = "";
          el.textContent = fallback;
        };
        image.src = avatarUrl;
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
        hero.style.backgroundImage = `linear-gradient(90deg, rgba(36, 47, 67, 0.68), rgba(75, 91, 120, 0.18)), url("${data.site.homeBackground.imageUrl}")`;
      } else {
        hero.style.backgroundImage = "";
      }
    }

    const form = $("[data-site-settings-form]");
    if (form) {
      if (form.heroTitle) form.heroTitle.value = data.site.heroTitle;
      if (form.profileBio) form.profileBio.value = data.site.profileBio;
      if (form.announcement) form.announcement.value = data.site.announcement || "";
      if (form.profileName) form.profileName.value = data.site.profileName;
      if (form.contactEmail) form.contactEmail.value = data.site.contacts.email || "";
      if (form.contactQq) form.contactQq.value = data.site.contacts.qq || "";
      if (form.contactWechat) form.contactWechat.value = data.site.contacts.wechat || "";
      if (form.contactDouyin) form.contactDouyin.value = data.site.contacts.douyin || "";
    }
    const aboutForm = $("[data-about-settings-form]");
    if (aboutForm) {
      aboutForm.aboutTitle.value = data.site.aboutTitle;
      aboutForm.aboutBio.value = data.site.aboutBio;
      aboutForm.aboutSideBio.value = data.site.aboutSideBio;
    }

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

  function initUserProfileSettings() {
    if (document.body.dataset.userProfileBound) return;
    document.body.dataset.userProfileBound = "true";
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-user-profile-button]");
      if (!trigger || state.isAdmin || !state.isLoggedIn) return;
      let modal = $("[data-user-profile-modal]");
      if (!modal) {
        modal = document.createElement("div");
        modal.className = "modal user-profile-modal";
        modal.dataset.userProfileModal = "";
        modal.innerHTML = `<div class="modal-backdrop" data-user-profile-close></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="个人资料"><button class="modal-close" type="button" data-user-profile-close aria-label="关闭">x</button><p class="mini-title">PROFILE</p><h2>个人资料</h2><form data-user-profile-form><label><span>头像</span><input name="avatar" type="file" accept="image/*"></label><label><span>昵称</span><input name="displayName" type="text" maxlength="24" required></label><button class="primary-button small" type="submit">保存资料</button></form></section>`;
        document.body.appendChild(modal);
      }
      const form = $("[data-user-profile-form]", modal);
      form.displayName.value = state.currentProfile?.display_name || "普通用户";
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
          const avatarUrl = file ? await window.XiaoLuoSupabase.uploadFile(state.userId, "avatars", file) : (state.currentProfile?.avatar_url || "");
          state.currentProfile = await window.XiaoLuoSupabase.updateOwnIdentity(state.userId, { display_name: name, avatar_url: avatarUrl });
          modal.classList.remove("open");
          await refreshAuthState();
          renderCurrentPage();
        } catch (error) { showCloudError(error); }
        finally { submit.disabled = false; submit.textContent = "保存资料"; }
      };
    });
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
    if (state.userId && window.XiaoLuoSupabase?.isConfigured) {
      try {
        const profile = await window.XiaoLuoSupabase.getProfile(state.userId);
        state.currentProfile = profile || null;
        state.isAdmin = Boolean(profile?.is_admin);
      } catch (error) {
        console.warn("Admin role check failed:", error.message);
      }
    }
    migrateLegacyUserData();
    clearOversizedSettings();
    resetPublicView();
    state.sessionLoaded = true;
    document.body.classList.toggle("is-logged-in", state.isLoggedIn);
    $all("[data-auth-only]").forEach((el) => { el.hidden = !state.isLoggedIn; });
    $all("[data-guest-only]").forEach((el) => { el.hidden = state.isLoggedIn; });
    $all(".user-entry").forEach((el) => {
      el.hidden = true;
    });
    $all(".header-actions").forEach((actions) => {
      let status = $("[data-account-status]", actions);
      const statusTag = state.isAdmin ? "A" : "BUTTON";
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
      if (state.isAdmin) {
        status.href = "./dashboard.html";
        status.setAttribute("aria-label", "作者已登录，进入后台");
        status.innerHTML = '<img src="./font_fuhbx0kh6gc/作者.svg" alt="" aria-hidden="true"><span>作者</span>';
      } else {
        status.type = "button";
        status.dataset.userProfileButton = "";
        const name = state.currentProfile?.display_name || "普通用户";
        const avatar = state.currentProfile?.avatar_url || "";
        const initial = escapeHtml(name.slice(0, 1) || "普");
        status.innerHTML = `<span class="account-avatar${avatar ? " has-image" : ""}"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${initial}</span><span>${escapeHtml(name)}</span>`;
        status.removeAttribute("href");
        status.setAttribute("aria-label", "修改头像和昵称");
        status.setAttribute("title", "修改头像和昵称");
      }
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
    $all("[data-dashboard-status-title]").forEach((el) => {
      el.textContent = state.isAdmin ? "管理员已登录，管理博客内容" : "小罗的个人博客";
    });
    $all("[data-dashboard-status-text]").forEach((el) => {
      el.textContent = state.isAdmin ? "现在可以进入后台管理文章、动态和资料。" : "登录后可以参与点赞与评论。";
    });
    return session;
  }

  async function loadCloudData() {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    try {
      const adminProfile = await api.getAdminProfile();
      if (!adminProfile) return;
      state.adminId = adminProfile.id;
      const ownerId = adminProfile.id;
      const [categories, tags, moments, progress, posts] = await Promise.all([
        api.listTaxonomy("categories", ownerId),
        api.listTaxonomy("tags", ownerId),
        api.listContent("moments", ownerId),
        api.listContent("progress_logs", ownerId),
        state.isAdmin ? api.listPosts(ownerId) : api.listPublishedPosts(ownerId)
      ]);
      data.site.profileName = adminProfile.display_name || data.site.profileName;
      data.site.avatarText = (adminProfile.display_name || data.site.profileName).slice(0, 1);
      data.site.avatarDataUrl = adminProfile.avatar_url || "";
      data.site.heroTitle = adminProfile.home_title || data.site.heroTitle;
      data.site.profileBio = adminProfile.home_bio || data.site.profileBio;
      data.site.aboutTitle = adminProfile.about_title || data.site.aboutTitle;
      data.site.aboutBio = adminProfile.about_bio || data.site.aboutBio;
      data.site.aboutSideBio = adminProfile.about_side_bio || data.site.aboutSideBio;
      data.site.announcement = adminProfile.announcement || "";
      data.site.contacts = adminProfile.contacts || {};
      data.categories = categories.map((item) => ({ id: item.id, name: item.name, description: "" }));
      data.tags = tags.map((item) => ({ id: item.id, name: item.name }));
      data.moments = moments.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [] }));
      data.progress = progress.map((item) => ({ id: item.id, title: item.title, date: item.entry_date, text: item.body || "", images: item.image_urls || [] }));
      data.posts = posts.map((item) => ({ id: item.id, title: item.title, author: data.site.profileName, category: item.category || "未分类", tags: item.tags || [], attachments: item.attachments || [], publishedAt: formatPostDate(item.created_at), coverUrl: item.cover_url || "", coverClass: "gradient-a", excerpt: (item.content || "").slice(0, 110), content: (item.content || "").split(/\n+/).filter(Boolean), featured: false }));
      state.cloudOwnerId = ownerId;
      initBrand();
      populateFilters();
      if (pageName() === "dashboard" && state.isAdmin) renderContentManagers();
      if (pageName() === "dashboard" && state.isAdmin) renderDashboardStats();
      if (pageName() === "dashboard" && state.isAdmin) renderRegisteredUsers();
      if (pageName() === "home") renderHome();
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
    if (window.__xiaoluoClockTimer) return;
    const draw = () => {
      const now = new Date();
      $all("[data-live-clock]").forEach((el) => { el.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); });
      $all("[data-live-date]").forEach((el) => { el.textContent = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }); });
    };
    draw();
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
        ${post.coverUrl ? `<span class="article-cover ${post.coverClass}" style="background-image:url('${post.coverUrl}')"></span>` : ""}
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
        const images = await Promise.all(files.map((file) => window.XiaoLuoSupabase.uploadFile(state.userId, folder, file)));
        if (cancelled()) return;
        const entry = {
          id: `${type}-${Date.now()}`,
          title: form.title.value.trim(),
          date: form.date?.value || today(),
          text: form.text?.value.trim() || "",
          images
        };
        if (type === "album") {
          const row = await window.XiaoLuoSupabase.addContent("albums", { user_id: state.userId, title: entry.title, meta: form.meta.value.trim() || entry.date, description: form.description.value.trim() || "", image_urls: images });
          data.albums.unshift({ id: row.id, title: row.title, meta: row.meta, description: row.description, images: row.image_urls, photoClass: "photo-a" });
        } else if (type === "moment") {
          const row = await window.XiaoLuoSupabase.addContent("moments", { user_id: state.userId, title: entry.title, body: entry.text, entry_date: entry.date, image_urls: images });
          data.moments.unshift({ id: row.id, title: row.title, text: row.body, date: row.entry_date, images: row.image_urls });
        } else {
          const row = await window.XiaoLuoSupabase.addContent("progress_logs", { user_id: state.userId, title: entry.title, body: entry.text, entry_date: entry.date, image_urls: images });
          data.progress.unshift({ id: row.id, title: row.title, text: row.body, date: row.entry_date, images: row.image_urls });
        }
        form.reset();
        renderContentManagers();
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
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-content-editor-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="编辑帖子"><button class="modal-close" type="button" data-content-editor-close aria-label="关闭">×</button><p class="mini-title">POST EDITOR</p><h2 data-content-editor-heading>编辑帖子</h2><form data-content-editor-form><label><span>标题</span><input name="title" type="text" required></label><label><span>日期</span><input name="date" type="date" required></label><label><span>正文</span><textarea name="body" rows="6" placeholder="填写内容"></textarea></label><section class="post-editor-images"><div><strong>已有图片</strong><p>可替换或删除单张图片。</p></div><div class="content-editor-image-grid" data-content-editor-images></div></section><label><span>添加图片</span><input name="newImages" type="file" accept="image/*" multiple></label><div class="publish-confirm-actions"><button class="danger-button" type="button" data-content-editor-delete>删除整条帖子</button><button class="primary-button" type="submit">保存修改</button></div></form></section>`;
      document.body.appendChild(modal);
    }
    const table = type === "moment" ? "moments" : "progress_logs";
    const folder = type === "moment" ? "moments" : "progress";
    const form = $("[data-content-editor-form]", modal);
    let images = [...(item.images || [])];
    const replacements = new Map();
    const deleted = new Set();
    form.title.value = item.title || "";
    form.date.value = item.date || today();
    form.body.value = item.text || "";
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
              const uploaded = await window.XiaoLuoSupabase.uploadFile(state.userId, folder, replacement.file);
              if (cancelled()) return;
              nextImages.push(uploaded);
              oldImagesToDelete.push(oldUrl);
            } else nextImages.push(oldUrl);
          }
          const additions = await Promise.all(newFiles.map((file) => window.XiaoLuoSupabase.uploadFile(state.userId, folder, file)));
          if (cancelled()) return;
          nextImages.push(...additions);
          const updated = { title: form.title.value.trim(), body: form.body.value.trim(), entry_date: form.date.value, image_urls: nextImages };
          await window.XiaoLuoSupabase.updateContent(table, item.id, state.userId, updated);
          if (oldImagesToDelete.length) await window.XiaoLuoSupabase.deleteFilesByPublicUrls(oldImagesToDelete);
          item.title = updated.title;
          item.text = updated.body;
          item.date = updated.entry_date;
          item.images = nextImages;
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
      const card = event.target.closest("[data-open-timeline-post]");
      if (!card || event.target.closest("button, a")) return;
      const type = card.dataset.type;
      const list = type === "moment" ? data.moments : data.progress;
      openTimelineDetail(type, list.find((entry) => entry.id === card.dataset.id));
    });
  }

  function openTimelineDetail(type, item) {
    if (!item) return;
    let modal = $("[data-timeline-detail-modal]");
    if (!modal) {
      modal = document.createElement("div"); modal.className = "modal timeline-detail-modal"; modal.dataset.timelineDetailModal = "";
      modal.innerHTML = `<div class="modal-backdrop" data-timeline-detail-close></div><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-label="内容详情"><button class="modal-close" type="button" data-timeline-detail-close>x</button><p class="mini-title" data-timeline-detail-date></p><h2 data-timeline-detail-title></h2><p data-timeline-detail-text></p><div class="timeline-detail-images" data-timeline-detail-images></div><div class="post-actions"><button type="button" data-timeline-like>点赞 0</button><span class="post-engagement" data-timeline-engagement>阅读 0 · 评论 0</span></div><section class="timeline-comments"><h3>评论</h3><p data-timeline-comment-note>登录后可以评论。</p><form data-timeline-comment-form><textarea name="content" maxlength="1000" placeholder="写下你的评论"></textarea><button class="primary-button small" type="submit">发表评论</button></form><div class="comment-list" data-timeline-comment-list></div></section></section>`;
      document.body.appendChild(modal);
    }
    $("[data-timeline-detail-date]", modal).textContent = item.date;
    $("[data-timeline-detail-title]", modal).textContent = item.title;
    $("[data-timeline-detail-text]", modal).textContent = item.text;
    $("[data-timeline-detail-images]", modal).innerHTML = (item.images || []).map((url) => `<img src="${url}" alt="${escapeHtml(item.title)}">`).join("");
    $all("[data-timeline-detail-close]", modal).forEach((button) => { button.onclick = () => modal.classList.remove("open"); });
    const drawComments = async () => {
      try {
        const comments = await window.XiaoLuoSupabase.getContentComments(type, item.id);
        $("[data-timeline-comment-list]", modal).innerHTML = comments.map((comment) => `<article class="comment-item"><span class="comment-avatar${comment.profile?.avatar_url ? " has-image" : ""}"${comment.profile?.avatar_url ? ` style="background-image:url('${comment.profile.avatar_url}')"` : ""}>${escapeHtml((comment.profile?.display_name || "普").slice(0, 1))}</span><div class="comment-content"><strong>${escapeHtml(comment.profile?.display_name || "普通用户")}</strong><time>${formatPostDate(comment.created_at)}</time><p>${escapeHtml(comment.content)}</p></div></article>`).join("") || '<p class="comment-empty">还没有评论。</p>';
        if (state.isAdmin) {
          const commentList = $("[data-timeline-comment-list]", modal);
          $all(".comment-item", commentList).forEach((element, index) => {
            element.insertAdjacentHTML("beforeend", `<button class="comment-delete" type="button" data-delete-content-comment="${comments[index].id}">删除</button>`);
          });
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
        if (state.isLoggedIn) await window.XiaoLuoSupabase.recordContentView(type, item.id, state.userId);
        const engagement = await window.XiaoLuoSupabase.getContentEngagement(type, item.id, state.userId);
        const button = $("[data-timeline-like]", modal);
        button.textContent = engagement.liked ? `已点赞 ${engagement.likes}` : `点赞 ${engagement.likes}`;
        button.classList.toggle("is-liked", engagement.liked);
        button.onclick = async () => { if (!state.isLoggedIn) return alert("请先登录后再点赞。"); try { await window.XiaoLuoSupabase.toggleContentLike(type, item.id, state.userId, engagement.liked); drawEngagement(); } catch (error) { showCloudError(error); } };
        $("[data-timeline-engagement]", modal).textContent = `阅读 ${engagement.views} · 评论 ${engagement.comments}`;
      } catch (error) { console.warn("Timeline engagement load failed:", error.message); }
    };
    const form = $("[data-timeline-comment-form]", modal); form.reset();
    $("[data-timeline-comment-note]", modal).textContent = state.isLoggedIn ? "评论会保存到这条内容下方。" : "请先登录后发表评论。";
    form.onsubmit = async (event) => { event.preventDefault(); if (!state.isLoggedIn) return alert("请先登录后发表评论。"); const content = form.content.value.trim(); if (!content) return; try { await window.XiaoLuoSupabase.addContentComment(type, item.id, state.userId, content); form.reset(); drawComments(); drawEngagement(); } catch (error) { showCloudError(error); } };
    drawComments(); drawEngagement(); modal.classList.add("open");
  }

  function renderHome() {
    const latest = $("[data-latest-posts]");
    const featured = $("[data-featured-posts]");
    const chips = $("[data-category-chips]");
    if (latest) {
      const posts = data.posts.slice(0, 3);
      latest.innerHTML = posts.map(postCard).join("");
      loadPostCardEngagement(posts, latest);
    }
    if (featured) featured.innerHTML = "";
    if (chips) chips.innerHTML = "";
    $all("[data-site-announcement]").forEach((el) => { el.textContent = data.site.announcement || "暂无公告。"; });
  }

  function renderArticles() {
    const list = $("[data-article-list]");
    const form = $("[data-article-filter]");
    const pagination = $("[data-pagination]");
    if (!list || !form) return;
    const pageSize = 4;
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
      <article class="article-detail glass-card" data-post-id="${post.id}">
        <p class="eyebrow">${escapeHtml(post.category)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <div class="article-meta detail-meta"><span>${escapeHtml(post.author)}</span><span>${formatPostDate(post.publishedAt)}</span><span>${escapeHtml(post.category)}</span></div>
        <div class="tag-row">${post.tags.map((tag) => `<a href="./articles.html?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
        ${post.coverUrl ? `<div class="detail-cover ${post.coverClass}" style="background-image:url('${post.coverUrl}')"></div>` : ""}
        <div class="post-content">${post.content.map((paragraph) => `<p>${linkify(paragraph)}</p>`).join("")}</div>
        ${post.attachments?.length ? `<section class="post-attachments"><h2>附件下载</h2>${post.attachments.map((file) => `<a href="${file.url}" download="${escapeHtml(file.name)}" target="_blank" rel="noopener">下载：${escapeHtml(file.name)}</a>`).join("")}</section>` : ""}
        <div class="post-actions">
          ${state.isAdmin && state.cloudOwnerId === state.userId ? `<a class="ghost-button" href="./editor.html?id=${post.id}">编辑文章</a>` : ""}
          ${state.isAdmin && state.cloudOwnerId === state.userId ? `<button class="danger-button" type="button" data-delete-post="${post.id}">删除文章</button>` : ""}
          <button type="button" data-post-like="${post.id}">点赞</button>
          <button type="button" data-placeholder-action="bookmark">收藏</button>
          <span class="post-engagement" data-post-engagement>阅读 0 · 点赞 0 · 评论 0</span>
        </div>
      </article>
      <nav class="post-neighbor">
        ${prev ? `<a href="./article-detail.html?id=${prev.id}">上一篇：${escapeHtml(prev.title)}</a>` : "<span>已经是最新文章</span>"}
        ${next ? `<a href="./article-detail.html?id=${next.id}">下一篇：${escapeHtml(next.title)}</a>` : "<span>已经是最后一篇</span>"}
      </nav>
      <section class="comments glass-card">
        <h2>评论区域</h2>
        <p data-comment-note>登录后可以发表评论。</p>
        <form data-post-comment-form data-post-id="${post.id}"><textarea name="content" placeholder="写下你的评论" maxlength="1000"></textarea><button class="primary-button small" type="submit">发表评论</button></form>
        <div class="comment-list" data-comment-list></div>
      </section>
    `;
    loadPostEngagement(post.id);
  }

  async function loadPostEngagement(postId) {
    const api = window.XiaoLuoSupabase;
    if (!api?.isConfigured) return;
    try {
      if (state.isLoggedIn) await api.recordPostView(postId, state.userId);
      const engagement = await api.getPostEngagement(postId, state.userId);
      const summary = $("[data-post-engagement]");
      if (summary) summary.textContent = `阅读 ${engagement.views} · 点赞 ${engagement.likes} · 评论 ${engagement.comments.length}`;
      const likeButton = $("[data-post-like]");
      if (likeButton) {
        likeButton.textContent = engagement.liked ? `已点赞 ${engagement.likes}` : `点赞 ${engagement.likes}`;
        likeButton.classList.toggle("is-liked", engagement.liked);
        likeButton.onclick = async () => {
          if (!state.isLoggedIn) { alert("请先登录后再点赞。"); return; }
          try { await api.togglePostLike(postId, state.userId, engagement.liked); await loadPostEngagement(postId); } catch (error) { showCloudError(error); }
        };
      }
      const note = $("[data-comment-note]");
      if (note) note.textContent = state.isLoggedIn ? "评论会保存到文章下方。" : "请先登录后发表评论。";
      const commentList = $("[data-comment-list]");
      if (commentList) commentList.innerHTML = engagement.comments.map((comment) => {
        const name = comment.profile?.display_name || "普通用户";
        const avatar = comment.profile?.avatar_url || "";
        const initial = escapeHtml(name.slice(0, 1) || "普");
        return `<article class="comment-item"><span class="comment-avatar${avatar ? " has-image" : ""}"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${initial}</span><div class="comment-content"><div><strong>${escapeHtml(name)}</strong><time>${formatPostDate(comment.created_at)}</time></div><p>${escapeHtml(comment.content)}</p></div></article>`;
      }).join("") || '<p class="comment-empty">还没有评论。</p>';
      if (state.isAdmin && commentList) {
        $all(".comment-item", commentList).forEach((element, index) => {
          element.insertAdjacentHTML("beforeend", `<button class="comment-delete" type="button" data-delete-post-comment="${engagement.comments[index].id}">删除</button>`);
        });
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
      if (form && !form.dataset.bound) {
        form.dataset.bound = "true";
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (!state.isLoggedIn) { alert("请先登录后发表评论。"); return; }
          const content = form.content.value.trim();
          if (!content) return;
          try { await api.addPostComment(postId, state.userId, content); form.reset(); await loadPostEngagement(postId); } catch (error) { showCloudError(error); }
        });
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
      const images = item.images || (item.imageClass ? [item.imageClass] : []);
      const imagePayload = escapeHtml(JSON.stringify(images));
      const grid = images.length ? `<div class="moment-gallery count-${Math.min(images.length, 9)}">${images.slice(0, 9).map((img, index) => /^https?:\/\//.test(img) ? `<button class="moment-thumb uploaded-image" type="button" data-timeline-images="${imagePayload}" data-timeline-index="${index}" style="background-image:url('${img}')" aria-label="查看第 ${index + 1} 张图片"></button>` : `<button class="moment-thumb ${img}" type="button" data-timeline-images="${imagePayload}" data-timeline-index="${index}" aria-label="查看第 ${index + 1} 张图片"></button>`).join("")}</div>` : "";
      const adminActions = state.isAdmin ? `<button class="timeline-manage-button" type="button" data-manage-timeline-post data-type="${type}" data-id="${escapeHtml(item.id)}" aria-label="管理这条帖子" title="管理帖子">⋯</button>` : "";
      return `<article class="timeline-item glass-card timeline-openable" data-open-timeline-post data-type="${type}" data-id="${escapeHtml(item.id)}"><time>${escapeHtml(item.date)}</time><div class="timeline-content"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p>${grid}<span class="timeline-engagement" data-timeline-card-engagement>阅读 0 · 点赞 0 · 评论 0</span>${adminActions}</div></article>`;
    }).join("") || '<article class="timeline-item glass-card empty-state">暂时还没有内容。</article>';
    items.forEach((item) => loadTimelineCardEngagement(type, item.id, wrap));
  }

  async function loadTimelineCardEngagement(type, id, wrap) {
    try {
      const engagement = await window.XiaoLuoSupabase.getContentEngagement(type, id, state.userId);
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
      state.musicIndex = (index + data.music.length) % data.music.length;
      const track = data.music[state.musicIndex];
      const artistText = track.category ? `${track.artist} · ${track.category}` : track.artist;
      audio.src = track.src;
      $all("[data-track-title], [data-floating-title]").forEach((el) => { el.textContent = track.title; });
      $all("[data-track-artist], [data-floating-artist]").forEach((el) => { el.textContent = artistText; });
      if (shouldPlay) playAudio();
    };

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
      contacts: {
      email: form.contactEmail?.value.trim() || "",
      qq: form.contactQq?.value.trim() || "",
      wechat: form.contactWechat?.value.trim() || "",
      douyin: form.contactDouyin?.value.trim() || ""
      }
    };

    const avatarFile = form.avatar?.files?.[0];
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
        data.site.contacts = profile.contacts;
        initBrand();
        alert("已保存到 Supabase，首页现在已经生效。");
      } catch (error) { showCloudError(error); }
    };

    const upload = avatarFile
      ? window.XiaoLuoSupabase.uploadFile(state.userId, "avatars", avatarFile).then((url) => { profile.avatar_url = url; })
      : Promise.resolve();
    runWithLoading("正在保存首页设置…", async () => {
      await upload;
      await finish();
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
          if (form.dataset.authForm === "register") {
            const result = await api.signUpWithEmail(form.email.value, form.password.value);
            await refreshAuthState();
            if (result.session) {
              msg.textContent = state.isAdmin ? "注册成功，正在进入后台..." : "注册成功，正在进入博客...";
              window.location.href = state.isAdmin ? "./dashboard.html" : "./index.html";
              return;
            }
            msg.textContent = "注册成功，请先去邮箱点击确认链接，然后再回来登录。";
          } else {
            await api.signInWithEmail(form.email.value, form.password.value);
            await refreshAuthState();
            msg.textContent = state.isAdmin ? "登录成功，正在进入后台..." : "登录成功，正在进入博客...";
            window.location.href = state.isAdmin ? "./dashboard.html" : "./index.html";
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

  function initEditor() {
    const form = $("[data-editor-form]");
    if (!form || form.dataset.bound) return;
    if (!state.isAdmin) return;
    form.dataset.bound = "true";
    const panel = $("[data-preview-panel]");
    const title = $("[data-preview-title]");
    const content = $("[data-preview-content]");
    prepareEditorForEdit();
    $("[data-editor-preview]")?.addEventListener("click", () => {
      panel.hidden = false;
      title.textContent = form.title.value || "未命名文章";
      content.innerHTML = form.content.value.split(/\n+/).filter(Boolean).map((line) => `<p>${linkify(line)}</p>`).join("");
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
            const cover = form.cover?.files?.[0] ? await window.XiaoLuoSupabase.uploadFile(state.userId, "post-covers", form.cover.files[0]) : (existing?.coverUrl || null);
            if (cancelled()) return;
            const attachmentFiles = Array.from(form.attachments?.files || []);
            const attachments = attachmentFiles.length ? await Promise.all(attachmentFiles.map(async (file) => ({ name: file.name, url: await window.XiaoLuoSupabase.uploadFile(state.userId, "post-attachments", file) }))) : (existing?.attachments || []);
            if (cancelled()) return;
            const postData = { title: form.title.value.trim(), content: form.content.value.trim(), cover_url: cover, category: form.category.value || "未分类", tags: form.tags.value.split(",").map((tag) => tag.trim()).filter(Boolean), attachments, status: "published" };
            if (editingId) await window.XiaoLuoSupabase.updatePost(state.userId, editingId, postData);
            else await window.XiaoLuoSupabase.savePost(state.userId, postData);
            form.reset();
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
    form.content.value = (post.content || []).join("\n");
    form.tags.value = (post.tags || []).join(", ");
    if (![...form.category.options].some((option) => option.value === post.category)) {
      form.category.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(post.category)}">${escapeHtml(post.category)}</option>`);
    }
    form.category.value = post.category || "";
    const heading = $("[data-editor-heading]");
    if (heading) heading.textContent = "编辑文章";
    const submit = $("[data-publish-post]");
    if (submit) submit.textContent = "保存修改";
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
        return `<article class="registered-user-row"><span class="comment-avatar${avatar ? " has-image" : ""}"${avatar ? ` style="background-image:url('${avatar}')"` : ""}>${initial}</span><div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(user.email || "未提供邮箱")}</p></div><time>${formatPostDate(user.created_at)}</time></article>`;
      }).join("") || '<p class="empty-state">暂时还没有普通用户注册。</p>';
    }).catch((error) => {
      wrap.innerHTML = '<p class="empty-state">无法读取注册用户，请确认已执行用户列表权限脚本。</p>';
      console.warn("Registered users load failed:", error.message);
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

  function renderCurrentPage() {
    applySavedContent();
    initBrand();
    bindThemeButtons();
    bindNavToggle();
    setActiveNav();
    populateFilters();
    initForms();
    initContactCopy();
    initUserProfileSettings();
    initTimelinePostManagement();
    initAdminEntryGuard();
    initLiveClock();
    initTimelineImageViewer();
    const page = pageName();
    if (page === "home") renderHome();
    if (page === "articles") renderArticles();
    if (page === "categories") renderCategories();
    if (page === "article-detail") renderDetail();
    if (page === "life") renderTimeline("[data-life-timeline]", data.moments);
    if (page === "progress") renderTimeline("[data-progress-timeline]", data.progress);
    if (page === "about") renderAbout();
    if (page === "photos") renderGallery();
    if (page === "dashboard") {
      protectDashboard();
      if (state.isAdmin) {
        initDashboardSectionSpy();
        initContentManagement();
        renderAdminPosts();
        renderContentManagers();
        renderDashboardStats();
        renderRegisteredUsers();
        renderDashboardStats();
      }
    }
    if (page === "editor") {
      protectDashboard();
      if (state.isAdmin) initEditor();
    }
    window.XiaoLuoSupabase?.trackVisit?.(location.pathname + location.search);
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
    document.title = nextDoc.title;
    document.body.dataset.page = nextDoc.body.dataset.page || "home";
    currentMain.replaceWith(nextMain);
    if (push) history.pushState({}, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
    await refreshAuthState();
    renderCurrentPage();
    await loadCloudData();
  }

  function initPjax() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) return;
      if (link.target || link.hasAttribute("download") || (url.hash && url.pathname === location.pathname)) return;
      if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return;
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
  initPjax();
  initPostContextMenu();
  initPostDeleteActions();
  watchAuthState();
  refreshAuthState()
    .then(async () => {
      renderCurrentPage();
      await loadCloudData();
    })
    .catch(renderCurrentPage);
})();
