/* ===== 英语高频词 · 记忆卡片 交互逻辑 ===== */
(function () {
  "use strict";

  var PAGE_SIZE = 30;          // 每页卡片数
  var MAX_PAGE_BTNS = 7;       // 分页按钮最多显示数

  var state = {
    tab: "words",        // words | phrases
    dir: "en2zh",        // en2zh | zh2en
    view: "card",        // card | list
    cat: "__all",
    keyword: "",
    shuffled: false,
    page: 1
  };

  var $ = function (id) { return document.getElementById(id); };

  var tabBtnW = $("tabBtnWords"), tabBtnP = $("tabBtnPhrases");
  var searchInput = $("searchInput"), clearBtn = $("clearSearch");
  var cardGrid = $("cardGrid"), listView = $("listView"), emptyState = $("emptyState");
  var pagination = $("pagination"), catBar = $("catBar");
  var resultInfo = $("resultInfo");

  var dataCache = { words: null, phrases: null };

  function getData() {
    if (dataCache[state.tab]) return dataCache[state.tab];
    var src = state.tab === "words" ? window.WORD_DATA : window.PHRASE_DATA;
    var items = (src || []).slice();
    dataCache[state.tab] = items;
    return items;
  }

  /* ---------- 分类 ---------- */
  function buildCats() {
    var items = getData();
    var map = {};
    items.forEach(function (it) { map[it.g] = (map[it.g] || 0) + 1; });
    var html = '<button class="chip active" data-cat="__all">全部 <span class="cat-n">' + items.length + '</span></button>';
    Object.keys(map).forEach(function (cat) {
      html += '<button class="chip" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(cat) +
              ' <span class="cat-n">' + map[cat] + '</span></button>';
    });
    catBar.innerHTML = html;

    Array.prototype.forEach.call(catBar.querySelectorAll(".chip"), function (chip) {
      chip.addEventListener("click", function () {
        state.cat = chip.getAttribute("data-cat");
        state.page = 1;
        Array.prototype.forEach.call(catBar.querySelectorAll(".chip"), function (c) {
          c.classList.toggle("active", c === chip);
        });
        render();
      });
    });
  }

  function catCount() {
    var map = {};
    getData().forEach(function (it) { map[it.g] = 1; });
    return Object.keys(map).length;
  }

  /* ---------- 过滤 ---------- */
  function filtered() {
    var items = getData();
    var kw = state.keyword.trim().toLowerCase();

    var out = items.filter(function (it) {
      if (state.cat !== "__all" && it.g !== state.cat) return false;
      if (!kw) return true;
      return it.e.toLowerCase().indexOf(kw) !== -1 || it.c.indexOf(kw) !== -1;
    });

    if (state.shuffled && !kw && state.cat === "__all") {
      // 保持已打乱顺序的数组本身被 shuffle 过（shuffle 直接作用于 dataCache）
    }
    return out;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var list = filtered();
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    if (state.page < 1) state.page = 1;

    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);

    resultInfo.textContent = "共 " + total + " 条 · 第 " + state.page + "/" + pages + " 页";

    if (total === 0) {
      cardGrid.hidden = true;
      listView.hidden = true;
      emptyState.hidden = false;
      pagination.innerHTML = "";
      return;
    }
    emptyState.hidden = true;

    if (state.view === "card") {
      cardGrid.hidden = false;
      listView.hidden = true;
      renderCards(pageItems, start);
    } else {
      cardGrid.hidden = true;
      listView.hidden = false;
      renderList(pageItems, start);
    }
    renderPagination(pages);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function cardClass(item) {
    return "card dir-" + state.dir;
  }

  function renderCards(items, startIdx) {
    var html = "";
    items.forEach(function (it, i) {
      var idx = startIdx + i + 1;
      var front = state.dir === "en2zh" ? it.e : it.c;
      var back = state.dir === "en2zh" ? it.c : it.e;
      html +=
        '<div class="' + cardClass(it) + '" data-idx="' + idx + '">' +
          '<div class="card-inner">' +
            '<div class="card-face card-front">' +
              '<div class="card-word">' + escapeHtml(front) + '</div>' +
              '<div class="card-cat">' + escapeHtml(it.g) + '</div>' +
              '<div class="card-tip">点击翻面</div>' +
            '</div>' +
            '<div class="card-face card-back">' +
              '<div class="card-meaning">' + escapeHtml(back) + '</div>' +
              '<div class="card-cat">' + escapeHtml(it.g) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
    cardGrid.innerHTML = html;

    Array.prototype.forEach.call(cardGrid.children, function (card) {
      card.addEventListener("click", function () {
        card.classList.toggle("flipped");
      });
    });
  }

  function renderList(items, startIdx) {
    var head =
      '<div class="list-head">' +
        '<span>#</span><span>English</span><span>中文</span><span class="col-cat">分类</span>' +
      '</div>';
    var rows = "";
    items.forEach(function (it, i) {
      rows +=
        '<div class="list-row">' +
          '<span class="list-idx">' + (startIdx + i + 1) + '</span>' +
          '<span class="list-en">' + escapeHtml(it.e) + '</span>' +
          '<span class="list-cn">' + escapeHtml(it.c) + '</span>' +
          '<span class="list-cat">' + escapeHtml(it.g) + '</span>' +
        '</div>';
    });
    listView.innerHTML = head + rows;
  }

  /* ---------- 分页 ---------- */
  function renderPagination(pages) {
    if (pages <= 1) { pagination.innerHTML = ""; return; }

    var cur = state.page;
    var btns = [];

    var pushPage = function (p) {
      btns.push('<button class="page-btn' + (p === cur ? " active" : "") + '" data-page="' + p + '">' + p + "</button>");
    };

    // 生成页码序列（首尾+当前附近）
    var set = [];
    for (var p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - cur) <= 1) set.push(p);
    }
    // 补省略号
    var html = '<button class="page-btn" data-page="' + (cur - 1) + '"' + (cur === 1 ? " disabled" : "") + '>‹</button>';
    var prev = 0;
    set.forEach(function (p) {
      if (p - prev > 1) html += '<span class="page-ellipsis">…</span>';
      html += '<button class="page-btn' + (p === cur ? " active" : "") + '" data-page="' + p + '">' + p + "</button>";
      prev = p;
    });
    html += '<button class="page-btn" data-page="' + (cur + 1) + '"' + (cur === pages ? " disabled" : "") + '>›</button>';
    pagination.innerHTML = html;

    Array.prototype.forEach.call(pagination.querySelectorAll(".page-btn:not(:disabled)"), function (btn) {
      btn.addEventListener("click", function () {
        state.page = parseInt(btn.getAttribute("data-page"), 10);
        render();
        scrollToTop();
      });
    });
  }

  function scrollToTop() {
    var y = window.pageYOffset;
    if (y > 260) window.scrollTo({ top: 250, behavior: "smooth" });
  }

  /* ---------- 事件绑定 ---------- */
  var tabBtns = document.querySelectorAll(".tab-btn");
  Array.prototype.forEach.call(tabBtns, function (btn) {
    btn.addEventListener("click", function () {
      var t = btn.getAttribute("data-tab");
      if (t === state.tab) return;
      state.tab = t;
      state.page = 1;
      state.cat = "__all";
      state.shuffled = false;
      state.keyword = "";
      searchInput.value = "";
      clearBtn.style.display = "none";
      Array.prototype.forEach.call(tabBtns, function (b) { b.classList.toggle("active", b === btn); });
      dataCache = { words: null, phrases: null };
      buildCats();
      render();
    });
  });

  var dirBtns = document.querySelectorAll("#directionSeg .seg-btn");
  Array.prototype.forEach.call(dirBtns, function (btn) {
    btn.addEventListener("click", function () {
      state.dir = btn.getAttribute("data-dir");
      Array.prototype.forEach.call(dirBtns, function (b) { b.classList.toggle("active", b === btn); });
      render();
    });
  });

  var viewBtns = document.querySelectorAll("#viewSeg .seg-btn");
  Array.prototype.forEach.call(viewBtns, function (btn) {
    btn.addEventListener("click", function () {
      state.view = btn.getAttribute("data-view");
      Array.prototype.forEach.call(viewBtns, function (b) { b.classList.toggle("active", b === btn); });
      render();
    });
  });

  searchInput.addEventListener("input", function () {
    state.keyword = searchInput.value;
    state.page = 1;
    clearBtn.style.display = state.keyword ? "block" : "none";
    render();
  });

  clearBtn.addEventListener("click", function () {
    searchInput.value = "";
    state.keyword = "";
    clearBtn.style.display = "none";
    render();
  });

  $("shuffleBtn").addEventListener("click", function () {
    state.shuffled = !state.shuffled;
    if (state.shuffled) {
      var arr = dataCache[state.tab] || getData();
      // Fisher-Yates
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      $("shuffleBtn").classList.add("active");
      $("shuffleBtn").style.borderColor = "var(--teal)";
      $("shuffleBtn").style.color = "var(--teal)";
    } else {
      dataCache = { words: null, phrases: null };
      buildCats();
      $("shuffleBtn").classList.remove("active");
      $("shuffleBtn").style.borderColor = "";
      $("shuffleBtn").style.color = "";
    }
    state.page = 1;
    render();
  });

  /* ---------- 键盘快捷键 ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  /* ---------- 启动 ---------- */
  buildCats();
  render();
})();
