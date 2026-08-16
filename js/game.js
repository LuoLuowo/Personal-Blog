(() => {
  async function initJumpGame() {
  const canvas = document.querySelector("[data-jump-canvas]");
  if (!canvas || canvas.dataset.gameReady || canvas.dataset.gameBooting) return;
  canvas.dataset.gameBooting = "true";
  const api = window.XiaoLuoSupabase;
  let session = null;
  try { session = await api?.getSession?.(); } catch (e) { console.warn("Jump game session check failed:", e); }
  const guestStorageKey = "xiaoluo-jump-game-guest-token";
  const guestNicknameKey = "xiaoluo-jump-game-nickname";
  let guestToken = localStorage.getItem(guestStorageKey);
  if (!session && !guestToken) { guestToken = crypto.randomUUID(); localStorage.setItem(guestStorageKey, guestToken); }
  const playerKey = session ? `user:${session.user.id}` : `guest:${guestToken}`;
  // 游客是否已设置昵称参与排行榜
  let guestRegistered = session ? true : Boolean(localStorage.getItem(guestNicknameKey));
  // 管理员状态
  let isAdmin = false;
  if (session && api?.getProfile) {
    try { const profile = await api.getProfile(session.user.id); isAdmin = Boolean(profile?.is_admin); } catch (e) { console.warn("Admin check failed:", e); }
  }
  canvas.dataset.gameReady = "true";
  canvas.dataset.gameBooting = "";
  const ctx = canvas.getContext("2d");
  const scoreEl = document.querySelector("[data-game-score]");
  const bestEl = document.querySelector("[data-game-best]");
  const hintEl = document.querySelector("[data-game-hint]");
  const restart = document.querySelector("[data-game-restart]");
  const W = canvas.width;
  const H = canvas.height;
  const ground = 860;
  const blockHeight = 170;
  const gravity = .48;
  let best = 0;
  let score = 0;
  let current;
  let next;
  let player;
  let charging = false;
  let chargeStarted = 0;
  let charge = 0;
  let gameOver = false;
  let camera = 0;
  let targetCamera = 0;
  let sparkles = [];
  let frame;
  const events = new AbortController();

  bestEl.textContent = best;
  const blockColors = ["#5d8dd8", "#d88763", "#71a384", "#9579c8", "#d5a956", "#4e9caf"];
  const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const rankingList = document.querySelector("[data-game-ranking-list]");
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const renderRanking = async () => {
    if (!rankingList || !api?.isConfigured) return;
    try {
      const rows = await api.listJumpGameRanking(50);
      const rowKey = (row) => row.player_key || (row.user_id ? `user:${row.user_id}` : `guest:${row.guest_token}`);
      let mine = rows.find((row) => rowKey(row) === playerKey);
      if (!mine && session) mine = await api.getMyJumpGameScore(session.user.id);
      best = Number(mine?.best_score || 0);
      bestEl.textContent = best;
      const displayRows = mine && !rows.some((row) => rowKey(row) === playerKey) ? [...rows, mine] : rows;
      rankingList.innerHTML = displayRows.map((row, index) => {
        const profile = row.profile || {};
        const key = rowKey(row);
        const profileUserId = row.user_id || (String(key).startsWith("user:") ? String(key).slice(5) : "");
        const isMine = key === playerKey;
        const name = profile.display_name || row.display_name || `玩家${index + 1}`;
        const avatarStyle = profile.avatar_url ? ` style="background-image:url('${escapeHtml(profile.avatar_url)}')"` : "";
        const rank = isMine && !rows.some((entry) => rowKey(entry) === playerKey) ? "我" : index + 1;
        const avatar = row.is_guest ? '<span class="game-ranking-avatar game-guest-avatar">游</span>' : `<button class="game-ranking-avatar" type="button" data-profile-user-id="${escapeHtml(profileUserId)}" aria-label="查看${escapeHtml(name)}的资料"${avatarStyle}>${profile.avatar_url ? "" : escapeHtml(name.slice(0, 1))}</button>`;
        return `<li class="game-ranking-row${isMine ? " is-me" : ""}"><span class="game-ranking-rank">${rank}</span>${avatar}<strong class="game-ranking-name">${escapeHtml(name)}${isMine ? "（我）" : ""}</strong><span class="game-ranking-score">${row.best_score}</span></li>`;
      }).join("") || '<li class="game-ranking-empty">完成一局游戏后，这里会显示你的成绩。</li>';
    } catch (error) {
      rankingList.innerHTML = '<li class="game-ranking-empty">排行榜暂时无法读取。</li>';
      console.warn("Jump leaderboard load failed:", error.message);
    }
  };

  const saveScore = async () => {
    if (!api?.isConfigured || score <= 0) return;
    // 游客未设置昵称时不上传成绩，仅保留本地最高分
    if (!session && !guestRegistered) {
      const localBest = Number(localStorage.getItem("xiaoluo-jump-local-best") || 0);
      if (score > localBest) localStorage.setItem("xiaoluo-jump-local-best", String(score));
      best = Math.max(best, score);
      bestEl.textContent = best;
      return;
    }
    try {
      const saved = session ? await api.submitJumpGameScore(score) : await api.submitGuestJumpGameScore(guestToken, score);
      best = Math.max(best, Number(saved?.best_score || 0));
      bestEl.textContent = best;
      renderRanking();
    } catch (error) {
      console.warn("Jump score save failed:", error.message);
    }
  };

  function makeBlock(x, width) { return { x, width, color: blockColors[random(0, blockColors.length - 1)] }; }
  function resetPlayer() { player = { x: current.x + current.width / 2, y: ground - blockHeight - 33, vx: 0, vy: 0, jumping: false, squash: 0 }; }
  function makeNext() { next = makeBlock(current.x + current.width + random(122, 320), random(124, 205)); }
  function reset() {
    current = makeBlock(150, 188);
    makeNext();
    resetPlayer();
    score = 0;
    charge = 0;
    charging = false;
    gameOver = false;
    camera = 0;
    targetCamera = 0;
    sparkles = [];
    scoreEl.textContent = score;
    hintEl.textContent = "按住画面开始蓄力";
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
  }
  function start() {
    if (gameOver) return reset();
    if (player.jumping || charging) return;
    charging = true;
    chargeStarted = performance.now();
    hintEl.textContent = "松开起跳";
  }
  function release() {
    if (!charging || gameOver) return;
    charging = false;
    const power = Math.min(charge, 1);
    player.vx = 7 + power * 20.5;
    player.vy = -(8.2 + power * 11.8);
    player.jumping = true;
    hintEl.textContent = "飞向下一块";
  }
  function award(points) {
    score += points;
    scoreEl.textContent = score;
    if (score > best) { best = score; bestEl.textContent = best; }
    sparkles.push({ x: player.x, y: player.y - 72, text: `+${points}`, life: 1, color: points === 3 ? "#f5c65d" : "#f5f7fb" });
  }
  function land(block) {
    const centre = block.x + block.width / 2;
    const distance = Math.abs(player.x - centre);
    const points = distance < block.width * .16 ? 3 : distance < block.width * .43 ? 2 : 1;
    award(points);
    current = { ...block };
    makeNext();
    resetPlayer();
    player.squash = 1;
    targetCamera = Math.max(0, current.x - 190);
    hintEl.textContent = points === 3 ? "完美落点，继续！" : "继续蓄力";
  }
  function fail() {
    gameOver = true;
    charging = false;
    player.jumping = false;
    player.x = current.x + current.width / 2;
    player.y = ground - blockHeight - 33;
    targetCamera = Math.max(0, current.x - 190);
    camera = targetCamera;
    hintEl.textContent = `本局 ${score} 分，点击画面或按 R 重开`;
    saveScore();
  }
  function update() {
    if (charging) charge = Math.min((performance.now() - chargeStarted) / 900, 1);
    if (player.jumping) {
      player.x += player.vx;
      player.y += player.vy;
      player.vy += gravity;
      const landingY = ground - blockHeight - 33;
      if (player.vy > 0 && player.y >= landingY - 6 && player.y <= landingY + 24) {
        const onNext = player.x >= next.x && player.x <= next.x + next.width;
        const onCurrent = player.x >= current.x && player.x <= current.x + current.width;
        if (onNext) land(next);
        else if (onCurrent) { resetPlayer(); hintEl.textContent = "回到原地，再试一次"; }
      }
      if (player.y > ground + 270) fail();
    }
    player.squash *= .86;
    camera += (targetCamera - camera) * .075;
    sparkles.forEach((item) => { item.y -= 1.3; item.life -= .018; });
    sparkles = sparkles.filter((item) => item.life > 0);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function drawBlock(block) {
    const x = block.x - camera;
    const y = ground - blockHeight;
    ctx.save();
    ctx.shadowColor = "rgba(5,13,29,.32)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 13;
    roundRect(x, y, block.width, blockHeight, 20); ctx.fillStyle = block.color; ctx.fill();
    ctx.shadowColor = "transparent";
    roundRect(x + 7, y - 4, block.width - 14, 26, 14); ctx.fillStyle = "rgba(255,255,255,.32)"; ctx.fill();
    ctx.fillStyle = "rgba(12,23,46,.16)";
    for (let dot = 0; dot < 4; dot += 1) { ctx.beginPath(); ctx.arc(x + 24 + dot * ((block.width - 44) / 3), y + 105, 13, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function drawBird() {
    const x = player.x - camera;
    const y = player.y;
    const scaleX = 1 - player.squash * .16 - (charging ? charge * .14 : 0);
    const scaleY = 1 + player.squash * .12 + (charging ? charge * .12 : 0);
    ctx.save(); ctx.translate(x, y); ctx.scale(scaleX, scaleY);
    ctx.shadowColor = "rgba(6,12,25,.28)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#775039"; ctx.beginPath(); ctx.ellipse(0, 3, 27, 21, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cfa98c"; ctx.beginPath(); ctx.ellipse(3, 8, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = "#4c3329"; ctx.beginPath(); ctx.ellipse(-23, 0, 19, 9, -.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(23, 0, 19, 9, .35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5d3d2c"; ctx.beginPath(); ctx.arc(0, -18, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#121826"; ctx.beginPath(); ctx.arc(-6, -20, 3.4, 0, Math.PI * 2); ctx.arc(6, -20, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5, -21, 1.2, 0, Math.PI * 2); ctx.arc(7, -21, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e3a04d"; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(11, -11); ctx.lineTo(0, -9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#223a67"); sky.addColorStop(.62, "#8fc5dc"); sky.addColorStop(1, "#dbeaf2"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.15)"; for (let i = 0; i < 20; i += 1) { ctx.beginPath(); ctx.arc((i * 109 - camera * .08) % (W + 180), 90 + (i % 5) * 85, 2 + i % 4, 0, Math.PI * 2); ctx.fill(); }
    drawBlock(current); drawBlock(next); drawBird();
    if (charging && !gameOver) { const width = 116; const x = player.x - camera - width / 2; const y = player.y - 76; roundRect(x, y, width, 14, 7); ctx.fillStyle = "rgba(8,17,35,.75)"; ctx.fill(); roundRect(x, y, width * charge, 14, 7); ctx.fillStyle = "#f3bc55"; ctx.fill(); }
    sparkles.forEach((item) => { ctx.save(); ctx.globalAlpha = item.life; ctx.font = "800 38px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = item.color; ctx.fillText(item.text, item.x - camera, item.y); ctx.restore(); });
    if (gameOver) { ctx.fillStyle = "rgba(9,17,33,.52)"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "800 56px Inter, sans-serif"; ctx.fillText("再来一次", W / 2, H / 2 - 28); ctx.font = "500 28px Inter, sans-serif"; ctx.fillText(`本局得分 ${score}`, W / 2, H / 2 + 32); }
  }
  function loop() { update(); draw(); frame = requestAnimationFrame(loop); }
  canvas.addEventListener("pointerdown", (event) => { event.preventDefault(); start(); }, { signal: events.signal });
  canvas.addEventListener("pointerup", (event) => { event.preventDefault(); release(); }, { signal: events.signal });
  canvas.addEventListener("pointerleave", () => { if (charging) release(); }, { signal: events.signal });
  document.addEventListener("keydown", (event) => { if (event.code === "Space") { event.preventDefault(); start(); } if (event.code === "KeyR") reset(); }, { signal: events.signal });
  document.addEventListener("keyup", (event) => { if (event.code === "Space") { event.preventDefault(); release(); } }, { signal: events.signal });
  if (restart) restart.addEventListener("click", reset, { signal: events.signal });

  // ===== 游客昵称 / 参与排行榜 =====
  const joinBtn = document.querySelector("[data-game-join-btn]");
  const nicknameModal = document.querySelector("[data-game-nickname-modal]");
  const nicknameForm = document.querySelector("[data-game-nickname-form]");
  const nicknameError = document.querySelector("[data-game-nickname-error]");

  function updateJoinButton() {
    if (!joinBtn) return;
    // 已登录用户：自动上榜，显示状态提示；未注册游客：显示参与按钮
    if (session) {
      joinBtn.hidden = false;
      joinBtn.textContent = "已自动上榜";
      joinBtn.disabled = true;
      joinBtn.classList.add("is-active");
    } else if (guestRegistered) {
      joinBtn.hidden = false;
      joinBtn.textContent = "已上榜";
      joinBtn.disabled = true;
      joinBtn.classList.add("is-active");
    } else {
      joinBtn.hidden = false;
      joinBtn.textContent = "参与排行榜";
      joinBtn.disabled = false;
      joinBtn.classList.remove("is-active");
    }
  }

  function openNicknameModal() {
    if (!nicknameModal) return;
    nicknameModal.classList.add("open");
    const input = nicknameForm?.querySelector("input[name='nickname']");
    if (input) { input.value = ""; setTimeout(() => input.focus(), 50); }
    if (nicknameError) nicknameError.hidden = true;
  }

  function closeNicknameModal() {
    if (!nicknameModal) return;
    nicknameModal.classList.remove("open");
  }

  if (joinBtn) joinBtn.addEventListener("click", openNicknameModal, { signal: events.signal });
  document.querySelectorAll("[data-game-nickname-close]").forEach((btn) => {
    btn.addEventListener("click", closeNicknameModal, { signal: events.signal });
  });

  if (nicknameForm) {
    nicknameForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = nicknameForm.querySelector("input[name='nickname']");
      const nickname = input?.value?.trim();
      if (!nickname) return;
      if (nicknameError) { nicknameError.hidden = true; nicknameError.textContent = ""; }
      try {
        const result = await api.setGuestNickname(guestToken, nickname);
        if (result) {
          localStorage.setItem(guestNicknameKey, result.display_name);
          guestRegistered = true;
          updateJoinButton();
          closeNicknameModal();
          // 如果当前有本地最高分，立即上传
          const localBest = Number(localStorage.getItem("xiaoluo-jump-local-best") || 0);
          if (localBest > 0) {
            await api.submitGuestJumpGameScore(guestToken, localBest);
            localStorage.removeItem("xiaoluo-jump-local-best");
          }
          best = Number(result.best_score || 0);
          bestEl.textContent = best;
          renderRanking();
        }
      } catch (error) {
        if (nicknameError) {
          nicknameError.textContent = error.message || "设置失败，请重试";
          nicknameError.hidden = false;
        }
      }
    }, { signal: events.signal });
  }

  // 未注册游客加载本地最高分
  if (!session && !guestRegistered) {
    const localBest = Number(localStorage.getItem("xiaoluo-jump-local-best") || 0);
    if (localBest > 0) { best = localBest; bestEl.textContent = best; }
  }

  // ===== 管理员：管理游客榜单 =====
  const adminPanel = document.querySelector("[data-game-admin-panel]");
  const adminList = document.querySelector("[data-game-admin-list]");
  const adminRefresh = document.querySelector("[data-game-admin-refresh]");

  async function renderAdminGuestList() {
    if (!isAdmin || !adminList || !api?.isConfigured) return;
    try {
      const rows = await api.listJumpGameRanking(50);
      const guests = rows.filter((row) => row.is_guest);
      if (!guests.length) {
        adminList.innerHTML = '<li class="game-admin-empty">暂无游客记录</li>';
        return;
      }
      adminList.innerHTML = guests.map((row) => {
        const token = String(row.player_key || "").replace(/^guest:/, "");
        return `<li><span class="game-admin-name">${escapeHtml(row.display_name || "游客")}</span><span class="game-admin-score">${row.best_score}分</span><button type="button" class="game-admin-delete" data-delete-guest="${escapeHtml(token)}" data-delete-name="${escapeHtml(row.display_name || "游客")}">删除</button></li>`;
      }).join("");
    } catch (error) {
      adminList.innerHTML = '<li class="game-admin-empty">加载失败</li>';
    }
  }

  if (isAdmin && adminPanel) {
    adminPanel.hidden = false;
    renderAdminGuestList();
    if (adminRefresh) adminRefresh.addEventListener("click", renderAdminGuestList, { signal: events.signal });
  }

  // 删除游客（事件委托，排行榜行和管理面板都用）
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-delete-guest]");
    if (!btn || !isAdmin) return;
    const token = btn.dataset.deleteGuest;
    const name = btn.dataset.deleteName || "该游客";
    if (!window.confirm(`确定删除游客「${name}」的榜单记录吗？`)) return;
    btn.disabled = true;
    try {
      await api.deleteGuestJumpScore(token);
      await renderRanking();
      await renderAdminGuestList();
    } catch (error) {
      window.alert("删除失败：" + (error.message || "未知错误"));
      btn.disabled = false;
    }
  }, { signal: events.signal });

  updateJoinButton();
  renderRanking();
  reset();
  window.destroyXiaoLuoJumpGame = () => {
    cancelAnimationFrame(frame);
    events.abort();
    canvas.dataset.gameReady = "";
    window.destroyXiaoLuoJumpGame = null;
  };
  }
  window.initXiaoLuoJumpGame = initJumpGame;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initJumpGame, { once: true });
  else initJumpGame();
})();
