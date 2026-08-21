(() => {
  async function initSnakeGame() {
    const canvas = document.querySelector("[data-snake-canvas]");
    if (!canvas || canvas.dataset.snakeReady || canvas.dataset.snakeBooting) return;
    canvas.dataset.snakeBooting = "true";

    if (!document.querySelector("[data-snake-nickname-modal]")) {
      const modal = document.createElement("div");
      modal.className = "modal game-nickname-modal";
      modal.dataset.snakeNicknameModal = "";
      modal.innerHTML = `<button class="modal-backdrop" type="button" data-snake-nickname-close aria-label="关闭"></button><section class="modal-card glass-card" role="dialog" aria-modal="true" aria-labelledby="snake-nickname-title"><button class="modal-close" type="button" data-snake-nickname-close aria-label="关闭">×</button><p class="mini-title">JOIN LEADERBOARD</p><h2 id="snake-nickname-title">参与贪吃蛇排行</h2><p class="game-nickname-desc">填写上榜昵称，之后的最高分会自动保存。</p><form class="game-nickname-form" data-snake-nickname-form><input type="text" name="nickname" maxlength="20" placeholder="输入你的昵称（1-20字）" required><button class="primary-button" type="submit">确认上榜</button></form><p class="game-nickname-error" data-snake-nickname-error hidden></p></section>`;
      document.body.appendChild(modal);
    }

    const api = window.XiaoLuoSupabase;
    let session = null;
    try { session = await api?.getSession?.(); } catch (error) { console.warn("Snake session check failed:", error); }
    const guestTokenKey = "xiaoluo-jump-game-guest-token";
    const guestNicknameKey = "xiaoluo-snake-game-nickname";
    const scoreRuleVersionKey = "xiaoluo-snake-score-rule-version";
    if (localStorage.getItem(scoreRuleVersionKey) !== "ten-point-v2") {
      localStorage.removeItem("xiaoluo-snake-local-best");
      localStorage.removeItem("xiaoluo-snake-total-score");
      localStorage.setItem(scoreRuleVersionKey, "ten-point-v2");
    }
    let guestToken = localStorage.getItem(guestTokenKey);
    if (!session && !guestToken) { guestToken = crypto.randomUUID(); localStorage.setItem(guestTokenKey, guestToken); }
    const playerKey = session ? `user:${session.user.id}` : `guest:${guestToken}`;
    let guestRegistered = session ? true : Boolean(localStorage.getItem(guestNicknameKey));
    let isAdmin = false;
    if (session && api?.getProfile) {
      try { isAdmin = Boolean((await api.getProfile(session.user.id))?.is_admin); } catch (_) {}
    }

    canvas.dataset.snakeReady = "true";
    canvas.dataset.snakeBooting = "";
    const ctx = canvas.getContext("2d");
    const scoreEl = document.querySelector("[data-snake-score]");
    const bestEl = document.querySelector("[data-snake-best]");
    const hintEl = document.querySelector("[data-snake-hint]");
    const startButton = document.querySelector("[data-snake-start]");
    const restartButton = document.querySelector("[data-snake-restart]");
    const rankingList = document.querySelector("[data-snake-ranking-list]");
    const events = new AbortController();
    const signal = events.signal;
    const size = 720;
    const cells = 24;
    const cell = size / cells;
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    let snake = [];
    let previousSnake = [];
    let food = null;
    let direction = { x: 1, y: 0 };
    let queuedDirection = { x: 1, y: 0 };
    let moveDirection = { x: 1, y: 0 };
    let score = 0;
    let best = 0;
    let started = false;
    let paused = false;
    let gameOver = false;
    let lastFrame = performance.now();
    let accumulator = 0;
    let stepDuration = 104;
    let particles = [];
    let frame = 0;
    let touchStart = null;
    const skinKey = "xiaoluo-snake-skin";
    const totalScoreKey = "xiaoluo-snake-total-score";
    const skins = {
      forest: { name: "森林藤蔓", unlock: 0, decor: "leaf", head: "hsl(154 62% 48%)", body: "hsl(160 56% 42%)", glow: "rgba(55,210,139,.5)", eye: "#10261f", food: "#ff6b7d" },
      ocean: { name: "深海气泡", unlock: 30, decor: "bubble", head: "hsl(204 76% 52%)", body: "hsl(196 69% 45%)", glow: "rgba(66,177,237,.52)", eye: "#08253a", food: "#ffd166" },
      sunset: { name: "落日焰纹", unlock: 60, decor: "flame", head: "hsl(20 81% 58%)", body: "hsl(35 76% 50%)", glow: "rgba(244,133,86,.52)", eye: "#3a1b15", food: "#f16b92" },
      violet: { name: "紫夜符文", unlock: 120, decor: "rune", head: "hsl(267 68% 62%)", body: "hsl(282 60% 52%)", glow: "rgba(177,119,238,.5)", eye: "#28183b", food: "#76d7ff" },
      neon: { name: "霓虹电弧", unlock: 240, decor: "bolt", head: "#00e5ff", body: "#2875ff", glow: "rgba(0,229,255,.72)", eye: "#061125", food: "#ff4ad8" },
      royal: { name: "王冠秘金", unlock: 450, decor: "crown", head: "#f8c955", body: "#b87420", glow: "rgba(248,201,85,.66)", eye: "#38240c", food: "#7ef2de" },
      mecha: { name: "机甲核心", unlock: 800, decor: "mecha", head: "#dceaff", body: "#57718f", glow: "rgba(180,221,255,.65)", eye: "#0c1d31", food: "#ff7366" },
      celestial: { name: "星际轨道", unlock: 1400, decor: "star", head: "#ffec9f", body: "#6859db", glow: "rgba(232,215,255,.75)", eye: "#21174b", food: "#7efff1" },
      magma: { name: "熔岩裂痕", unlock: 1800, decor: "magma", head: "#ff8b45", body: "#a83c27", glow: "rgba(255,91,48,.75)", eye: "#35100a", food: "#70ff8d" },
      ice: { name: "极地冰晶", unlock: 2600, decor: "ice", head: "#c9f7ff", body: "#4da9d8", glow: "rgba(111,226,255,.8)", eye: "#10364d", food: "#ff6b7d" },
      prism: { name: "棱镜幻彩", unlock: 3600, decor: "prism", head: "#ff9cf2", body: "#765bdb", glow: "rgba(255,137,244,.8)", eye: "#28113d", food: "#ffd166" },
      glitch: { name: "故障像素", unlock: 5000, decor: "glitch", head: "#d8ff52", body: "#3c6d4a", glow: "rgba(190,255,66,.85)", eye: "#152315", food: "#ff4ad8" }
    };
    let skinName = skins[localStorage.getItem(skinKey)] ? localStorage.getItem(skinKey) : "forest";
    let totalScore = Number(localStorage.getItem(totalScoreKey) || 0);
    let audioContext = null;
    let musicTimer = 0;
    let musicStep = 0;
    let musicEnabled = localStorage.getItem("xiaoluo-snake-music") !== "off";
    let sfxVolume = Math.min(2, Math.max(0, Number(localStorage.getItem("xiaoluo-snake-sfx-volume") || 1.5)));
    let slowUntil = 0;
    let fastUntil = 0;

    function randomFreeCell() {
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const point = { x: Math.floor(Math.random() * cells), y: Math.floor(Math.random() * cells) };
        const occupied = snake.some((part) => part.x === point.x && part.y === point.y) || (food && food.x === point.x && food.y === point.y);
        if (!occupied) return point;
      }
      return { x: 2, y: 2 };
    }

    function randomFood() {
      const point = randomFreeCell();
      const roll = Math.random();
      return { ...point, kind: roll < .68 ? "green" : roll < .84 ? "blue" : "red" };
    }

    function ensureAudio() {
      if (!audioContext) {
        try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; }
      }
      if (audioContext.state === "suspended") audioContext.resume();
      return audioContext;
    }

    function tone(frequency, duration, volume, type = "sine", offset = 0) {
      const audio = ensureAudio();
      if (!audio) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime + offset;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + .015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(at); oscillator.stop(at + duration + .03);
    }

    function sfxTone(frequency, duration, volume, type = "sine", offset = 0) {
      tone(frequency, duration, Math.min(.32, volume * sfxVolume), type, offset);
    }

    function playSkinEatSound(skin, foodKind) {
      const sounds = {
        forest: () => { sfxTone(330, .12, .12, "triangle"); sfxTone(495, .16, .08, "sine", .05); },
        ocean: () => { sfxTone(220, .18, .1, "sine"); sfxTone(440, .2, .08, "sine", .08); },
        sunset: () => { sfxTone(180, .1, .13, "sawtooth"); sfxTone(260, .18, .08, "triangle", .06); },
        violet: () => { sfxTone(620, .12, .1, "sine"); sfxTone(930, .18, .08, "sine", .06); },
        neon: () => {
          // Short, layered original discharge texture: a bright spark, noisy arc and low electric thump.
          for (let index = 0; index < 5; index += 1) {
            const offset = index * .018;
            sfxTone(820 + Math.random() * 980, .035 + Math.random() * .025, .11, "square", offset);
            sfxTone(120 + Math.random() * 260, .055, .07, "sawtooth", offset + .012);
          }
          sfxTone(68, .2, .12, "triangle", .075);
        },
        royal: () => { sfxTone(392, .16, .1, "triangle"); sfxTone(523, .2, .1, "triangle", .08); sfxTone(784, .25, .07, "sine", .14); },
        mecha: () => { sfxTone(110, .16, .14, "square"); sfxTone(220, .12, .08, "square", .08); },
        celestial: () => { sfxTone(880, .22, .08, "sine"); sfxTone(1320, .3, .06, "sine", .1); },
        magma: () => { sfxTone(90, .18, .13, "sawtooth"); sfxTone(180, .12, .09, "square", .06); },
        ice: () => { sfxTone(1046, .2, .08, "sine"); sfxTone(1568, .28, .06, "sine", .1); },
        prism: () => { sfxTone(523, .1, .08, "sine"); sfxTone(659, .1, .07, "sine", .06); sfxTone(988, .2, .06, "sine", .12); },
        glitch: () => { sfxTone(1000, .04, .1, "square"); sfxTone(260, .05, .08, "square", .05); sfxTone(1400, .06, .08, "square", .1); }
      };
      sounds[skin]?.();
      if (foodKind === "blue") sfxTone(1300, .14, .06, "sine", .06);
      if (foodKind === "red") sfxTone(95, .16, .09, "sawtooth", .05);
    }

    function playMusicBeat() {
      if (!musicEnabled || !started || paused || gameOver) return;
      const melody = [392, 440, 523.25, 440, 349.23, 392, 440, 329.63];
      const bass = [98, 98, 130.81, 110, 87.31, 98, 110, 82.41];
      const index = musicStep % melody.length;
      tone(melody[index], .22, .044, "sine");
      if (index % 2 === 0) tone(bass[index], .26, .029, "triangle");
      musicStep += 1;
    }

    function startMusic() {
      if (!musicEnabled || musicTimer) return;
      ensureAudio();
      playMusicBeat();
      musicTimer = window.setInterval(playMusicBeat, 340);
    }

    function stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = 0;
    }

    function syncSkinControls() {
      if (!skins[skinName] || totalScore < skins[skinName].unlock) skinName = "forest";
      const skin = skins[skinName];
      const skinToggle = document.querySelector("[data-snake-skin-toggle]");
      if (skinToggle) skinToggle.textContent = `皮肤：${skin.name}`;
      document.querySelectorAll("[data-snake-skin]").forEach((button) => {
        const option = skins[button.dataset.snakeSkin];
        const locked = totalScore < option.unlock;
        button.classList.toggle("active", button.dataset.snakeSkin === skinName);
        button.classList.toggle("locked", locked);
        button.disabled = locked;
        button.title = locked ? `累计获得 ${option.unlock} 分后解锁` : `${option.name} 已解锁`;
        const label = button.querySelector("small");
        if (label) label.textContent = locked ? `还差 ${option.unlock - totalScore} 分` : option.unlock ? "已解锁" : "默认皮肤";
      });
    }

    function syncMusicControls() {
      const musicToggle = document.querySelector("[data-snake-music-toggle]");
      if (!musicToggle) return;
      musicToggle.textContent = musicEnabled ? "音乐：开" : "音乐：关";
      musicToggle.setAttribute("aria-pressed", String(musicEnabled));
    }

    function reset() {
      snake = [{ x: 10, y: 12 }, { x: 9, y: 12 }, { x: 8, y: 12 }, { x: 7, y: 12 }];
      previousSnake = snake.map((part) => ({ ...part }));
      food = randomFood();
      direction = { x: 1, y: 0 };
      queuedDirection = { x: 1, y: 0 };
      moveDirection = { x: 1, y: 0 };
      score = 0;
      started = false;
      paused = false;
      gameOver = false;
      accumulator = 0;
      stepDuration = 104;
      slowUntil = 0;
      fastUntil = 0;
      particles = [];
      scoreEl.textContent = "0";
      hintEl.textContent = "按方向键、WASD 或滑动屏幕开始";
      startButton.hidden = false;
      startButton.textContent = "开始游戏";
    }

    function start() {
      if (gameOver) reset();
      started = true;
      paused = false;
      startButton.hidden = true;
      hintEl.textContent = "保持节奏，别撞到自己";
      startMusic();
    }

    function togglePause() {
      if (!started || gameOver) return;
      paused = !paused;
      startButton.hidden = !paused;
      startButton.textContent = paused ? "继续游戏" : "开始游戏";
      hintEl.textContent = paused ? "游戏已暂停" : "继续前进";
      accumulator = 0;
    }

    function setDirection(next) {
      if (next.x === -moveDirection.x && next.y === -moveDirection.y) return;
      queuedDirection = next;
      direction = next;
      if (!started || gameOver) start();
    }

    function addParticles(point, color) {
      for (let i = 0; i < 14; i += 1) particles.push({ x: (point.x + .5) * cell, y: (point.y + .5) * cell, vx: (Math.random() - .5) * 5, vy: (Math.random() - .5) * 5, life: 1, color });
    }

    async function saveScore() {
      if (!api?.isConfigured || score <= 0) return;
      if (!session && !guestRegistered) {
        const local = Number(localStorage.getItem("xiaoluo-snake-local-best") || 0);
        if (score > local) localStorage.setItem("xiaoluo-snake-local-best", String(score));
        best = Math.max(best, score);
        bestEl.textContent = best;
        return;
      }
      try {
        const saved = session ? await api.submitSnakeGameScore(score) : await api.submitGuestSnakeGameScore(guestToken, score);
        best = Math.max(best, Number(saved?.best_score || 0));
        bestEl.textContent = best;
        renderRanking();
      } catch (error) { console.warn("Snake score save failed:", error.message); }
    }

    function endGame() {
      gameOver = true;
      paused = false;
      startButton.hidden = false;
      startButton.textContent = "再来一局";
      hintEl.textContent = `本局 ${score} 分，按 R 或点击按钮重开`;
      saveScore();
    }

    function tick(now) {
      direction = queuedDirection;
      moveDirection = { ...direction };
      previousSnake = snake.map((part) => ({ ...part }));
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= cells || head.y >= cells;
      const hitBody = snake.some((part, index) => index < snake.length - 1 && part.x === head.x && part.y === head.y);
      if (hitWall || hitBody) { endGame(); return; }
      snake.unshift(head);
      const ateFood = head.x === food.x && head.y === food.y;
      if (ateFood) {
        const foodKind = food.kind || "green";
        const points = foodKind === "green" ? 10 : 5;
        score += points;
        totalScore += points;
        localStorage.setItem(totalScoreKey, String(totalScore));
        scoreEl.textContent = score;
        best = Math.max(best, score);
        bestEl.textContent = best;
        addParticles(head, skins[skinName].food);
        if (foodKind === "blue") { slowUntil = now + 5000; fastUntil = 0; }
        if (foodKind === "red") { fastUntil = now + 5000; slowUntil = 0; }
        food = randomFood();
        hintEl.textContent = foodKind === "green" ? `+${points} 分` : foodKind === "blue" ? "+5 分 · 冰冻减速" : "+5 分 · 急速冲刺";
        playSkinEatSound(skinName, foodKind);
        syncSkinControls();
      } else {
        snake.pop();
      }
    }

    function roundedRect(x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); }

    function drawSkinDecoration(x, y, index, now) {
      const skin = skins[skinName];
      const midX = x + cell / 2;
      const midY = y + cell / 2;
      const phase = now / 180 + index * .72;
      ctx.save();
      ctx.lineWidth = 2;
      if (skin.decor === "leaf") {
        ctx.strokeStyle = "rgba(221,255,193,.72)";
        ctx.beginPath(); ctx.moveTo(x + 7, midY + Math.sin(phase) * 2); ctx.quadraticCurveTo(midX, y + 5, x + cell - 7, midY - Math.sin(phase) * 2); ctx.stroke();
        ctx.fillStyle = "rgba(223,255,190,.72)"; ctx.beginPath(); ctx.ellipse(midX + Math.sin(phase) * 4, midY - 4, 4, 2.2, phase * .18, 0, Math.PI * 2); ctx.fill();
      } else if (skin.decor === "bubble") {
        ctx.strokeStyle = "rgba(220,250,255,.78)"; ctx.shadowColor = "#9aeaff"; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(midX - 5, midY - 3 - Math.sin(phase) * 3, 3.5, 0, Math.PI * 2); ctx.arc(midX + 6, midY + 5 - Math.cos(phase) * 2, 2.3, 0, Math.PI * 2); ctx.stroke();
      } else if (skin.decor === "flame") {
        ctx.fillStyle = `rgba(255,239,166,${.62 + Math.sin(phase) * .16})`; ctx.shadowColor = "#ffb342"; ctx.shadowBlur = 10 + Math.sin(phase) * 4; ctx.beginPath(); ctx.moveTo(midX + Math.sin(phase) * 2, y + 5); ctx.quadraticCurveTo(x + 6, midY, midX, y + cell - 6); ctx.quadraticCurveTo(x + cell - 6, midY, midX + Math.sin(phase) * 2, y + 5); ctx.fill();
      } else if (skin.decor === "rune") {
        ctx.translate(midX, midY); ctx.rotate(phase * .12); ctx.strokeStyle = `rgba(238,212,255,${.55 + Math.sin(phase) * .2})`; ctx.shadowColor = "#d6a6ff"; ctx.shadowBlur = 9; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
      } else if (skin.decor === "bolt") {
        ctx.strokeStyle = `rgba(232,255,255,${.7 + Math.sin(phase * 2) * .25})`; ctx.shadowColor = "#00f0ff"; ctx.shadowBlur = 15; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(midX + 6, y + 4); ctx.lineTo(midX - 4 + Math.sin(phase) * 3, midY - 2); ctx.lineTo(midX + 3, midY + 1); ctx.lineTo(midX - 6, y + cell - 4); ctx.stroke();
        if ((Math.floor(now / 90) + index) % 3 === 0) { ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 2, midY); ctx.lineTo(x - 5, midY - 6); ctx.moveTo(x + cell - 2, midY + 3); ctx.lineTo(x + cell + 6, midY - 3); ctx.stroke(); }
      } else if (skin.decor === "crown") {
        ctx.fillStyle = "rgba(255,242,151,.92)"; ctx.shadowColor = "#ffd45a"; ctx.shadowBlur = 10 + Math.sin(phase) * 3; ctx.beginPath(); ctx.moveTo(x + 7, midY + 5); ctx.lineTo(x + 9, y + 8); ctx.lineTo(midX, y + 14); ctx.lineTo(x + cell - 9, y + 8); ctx.lineTo(x + cell - 7, midY + 5); ctx.closePath(); ctx.fill();
      } else if (skin.decor === "mecha") {
        ctx.strokeStyle = "rgba(12,30,48,.72)"; ctx.strokeRect(x + 9, y + 9, cell - 18, cell - 18); ctx.beginPath(); ctx.moveTo(midX, y + 7); ctx.lineTo(midX, y + cell - 7); ctx.stroke(); ctx.fillStyle = Math.sin(phase * 2) > 0 ? "#75efff" : "#ff765f"; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 11; ctx.beginPath(); ctx.arc(midX, midY, 3, 0, Math.PI * 2); ctx.fill();
      } else if (skin.decor === "star") {
        ctx.strokeStyle = "rgba(255,250,201,.84)"; ctx.shadowColor = "#fff2a3"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(midX, midY, 7 + Math.sin(phase) * 1.2, phase, phase + Math.PI * 1.55); ctx.stroke(); const orbitX = midX + Math.cos(phase) * 9; const orbitY = midY + Math.sin(phase) * 9; ctx.fillStyle = "#fff6ad"; ctx.beginPath(); ctx.arc(orbitX, orbitY, 2.2, 0, Math.PI * 2); ctx.fill();
      } else if (skin.decor === "magma") {
        ctx.strokeStyle = `rgba(255,220,104,${.6 + Math.sin(phase) * .2})`; ctx.shadowColor = "#ff4e2f"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(x + 7, y + 5); ctx.lineTo(midX - 2, midY); ctx.lineTo(x + cell - 8, y + cell - 5); ctx.moveTo(midX + 3, y + 5); ctx.lineTo(midX, midY + 4); ctx.stroke();
      } else if (skin.decor === "ice") {
        ctx.strokeStyle = "rgba(228,253,255,.9)"; ctx.shadowColor = "#8beaff"; ctx.shadowBlur = 13; ctx.beginPath(); ctx.moveTo(midX, y + 5); ctx.lineTo(x + cell - 6, midY); ctx.lineTo(midX, y + cell - 5); ctx.lineTo(x + 6, midY); ctx.closePath(); ctx.stroke();
      } else if (skin.decor === "prism") {
        ctx.strokeStyle = `hsla(${(now / 8 + index * 34) % 360}, 90%, 78%, .8)`; ctx.shadowColor = "#ff9cf2"; ctx.shadowBlur = 11; ctx.beginPath(); ctx.arc(midX, midY, 8, phase, phase + Math.PI * 1.5); ctx.stroke();
      } else if (skin.decor === "glitch") {
        ctx.fillStyle = `rgba(220,255,82,${.55 + Math.sin(phase * 4) * .3})`; ctx.fillRect(x + 5 + ((index * 3) % 8), y + 7, 6, 3); ctx.fillRect(x + 15, y + 18 + ((index * 5) % 7), 9, 3); ctx.strokeStyle = "rgba(255,77,213,.7)"; ctx.beginPath(); ctx.moveTo(x + 4, midY); ctx.lineTo(x + cell - 5, midY + Math.sin(phase * 3) * 4); ctx.stroke();
      }
      ctx.restore();
    }
    function draw(now, progress) {
      const dark = document.body.classList.contains("dark-mode");
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, dark ? "#13233d" : "#e8f7f2");
      gradient.addColorStop(1, dark ? "#263b5c" : "#dcecff");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = dark ? "rgba(180,205,240,.07)" : "rgba(57,98,139,.08)";
      ctx.lineWidth = 1;
      for (let i = 1; i < cells; i += 1) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke(); }

      const drawFood = (item) => {
        if (!item) return;
        const pulse = 1 + Math.sin(now / 180) * .08;
        const x = (item.x + .5) * cell;
        const y = (item.y + .5) * cell;
        const foodColor = item.kind === "blue" ? "#58caff" : item.kind === "red" ? "#ff5361" : "#70e68a";
        ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse); ctx.shadowColor = foodColor; ctx.shadowBlur = 18;
        ctx.fillStyle = foodColor; ctx.beginPath(); ctx.arc(0, 0, cell * .28, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(-5, -6, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      };
      drawFood(food);

      for (let index = snake.length - 1; index >= 0; index -= 1) {
        const part = snake[index];
        const previous = previousSnake[index] || previousSnake[previousSnake.length - 1] || part;
        const x = (previous.x + (part.x - previous.x) * progress) * cell + 3;
        const y = (previous.y + (part.y - previous.y) * progress) * cell + 3;
        const inset = index === 0 ? 1 : Math.min(4, index * .08);
        ctx.shadowColor = index === 0 ? skins[skinName].glow : "transparent";
        ctx.shadowBlur = index === 0 ? 15 : 0;
        roundedRect(x + inset, y + inset, cell - 6 - inset * 2, cell - 6 - inset * 2, 9);
        ctx.fillStyle = index === 0 ? skins[skinName].head : skins[skinName].body;
        ctx.fill();
        drawSkinDecoration(x + inset, y + inset, index, now);
        if (index === 0) {
          ctx.shadowBlur = 0; ctx.fillStyle = skins[skinName].eye;
          const horizontal = direction.x !== 0;
          const eyes = horizontal ? [[direction.x > 0 ? 19 : 8, 8], [direction.x > 0 ? 19 : 8, 18]] : [[8, direction.y > 0 ? 19 : 8], [18, direction.y > 0 ? 19 : 8]];
          eyes.forEach(([eyeX, eyeY]) => { ctx.beginPath(); ctx.arc(x + eyeX, y + eyeY, 2.8, 0, Math.PI * 2); ctx.fill(); });
        }
      }
      particles.forEach((item) => { ctx.globalAlpha = item.life; ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(item.x, item.y, 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
      const effect = slowUntil > now ? "slow" : fastUntil > now ? "fast" : "";
      if (effect) {
        const edge = Math.max(34, cell * 1.45);
        const rgb = effect === "slow" ? "126,216,255" : "255,74,54";
        const top = ctx.createLinearGradient(0, 0, 0, edge);
        top.addColorStop(0, `rgba(${rgb},.3)`); top.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = top; ctx.fillRect(0, 0, size, edge);
        const bottom = ctx.createLinearGradient(0, size, 0, size - edge);
        bottom.addColorStop(0, `rgba(${rgb},.3)`); bottom.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = bottom; ctx.fillRect(0, size - edge, size, edge);
        const left = ctx.createLinearGradient(0, 0, edge, 0);
        left.addColorStop(0, `rgba(${rgb},.3)`); left.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = left; ctx.fillRect(0, 0, edge, size);
        const right = ctx.createLinearGradient(size, 0, size - edge, 0);
        right.addColorStop(0, `rgba(${rgb},.3)`); right.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = right; ctx.fillRect(size - edge, 0, edge, size);
        ctx.save();
        ctx.lineWidth = effect === "slow" ? 3 : 2;
        ctx.strokeStyle = effect === "slow" ? "rgba(224,252,255,.62)" : "rgba(255,147,97,.62)";
        for (let i = 0; i < 7; i += 1) {
          const drift = (now / (effect === "slow" ? 34 : 20) + i * 98) % (size + 80) - 40;
          ctx.beginPath();
          if (i % 2 === 0) { ctx.moveTo(drift, edge - 6); ctx.lineTo(drift + 16, 8); }
          else { ctx.moveTo(size - edge + 6, drift); ctx.lineTo(size - 8, drift + 16); }
          ctx.stroke();
        }
        ctx.restore();
      }
      if (paused || gameOver) {
        ctx.fillStyle = dark ? "rgba(7,14,27,.48)" : "rgba(232,241,252,.62)"; ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = dark ? "#fff" : "#203553"; ctx.textAlign = "center"; ctx.font = "800 48px sans-serif"; ctx.fillText(gameOver ? "撞到了" : "暂停一下", size / 2, size / 2 - 12);
        ctx.font = "500 24px sans-serif"; ctx.fillText(gameOver ? `本局 ${score} 分` : "准备好就继续", size / 2, size / 2 + 38);
      }
    }

    function loop(now) {
      const delta = Math.min(now - lastFrame, 80);
      lastFrame = now;
      stepDuration = fastUntil > now ? 58 : slowUntil > now ? 168 : Math.max(62, 104 - Math.floor(score / 25) * 4);
      if (started && !paused && !gameOver) {
        accumulator += delta;
        while (accumulator >= stepDuration) { accumulator -= stepDuration; tick(now); if (gameOver) break; }
      }
      particles.forEach((item) => { item.x += item.vx; item.y += item.vy; item.vx *= .96; item.vy *= .96; item.life -= .025; });
      particles = particles.filter((item) => item.life > 0);
      draw(now, started && !paused && !gameOver ? Math.min(accumulator / stepDuration, 1) : 1);
      frame = requestAnimationFrame(loop);
    }

    const keyDirections = { ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 } };
    document.addEventListener("keydown", (event) => {
      if (keyDirections[event.code]) { event.preventDefault(); setDirection(keyDirections[event.code]); }
      if (event.code === "Space") { event.preventDefault(); togglePause(); }
      if (event.code === "KeyR") { event.preventDefault(); reset(); start(); }
    }, { signal });
    canvas.addEventListener("pointerdown", (event) => { event.preventDefault(); touchStart = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture?.(event.pointerId); }, { signal });
    canvas.addEventListener("pointerup", (event) => {
      event.preventDefault();
      if (!touchStart) return;
      const dx = event.clientX - touchStart.x;
      const dy = event.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { if (!started || gameOver) start(); return; }
      setDirection(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) });
    }, { signal });
    startButton.addEventListener("click", () => paused ? togglePause() : start(), { signal });
    restartButton.addEventListener("click", () => { reset(); start(); }, { signal });
    const musicToggle = document.querySelector("[data-snake-music-toggle]");
    const skinToggle = document.querySelector("[data-snake-skin-toggle]");
    const skinPicker = document.querySelector("[data-snake-skin-picker]");
    const sfxVolumeControl = document.querySelector("[data-snake-sfx-volume]");
    if (sfxVolumeControl) {
      sfxVolumeControl.value = String(sfxVolume);
      sfxVolumeControl.addEventListener("input", () => {
        sfxVolume = Math.min(2, Math.max(0, Number(sfxVolumeControl.value)));
        localStorage.setItem("xiaoluo-snake-sfx-volume", String(sfxVolume));
      }, { signal });
    }
    musicToggle?.addEventListener("click", () => {
      musicEnabled = !musicEnabled;
      localStorage.setItem("xiaoluo-snake-music", musicEnabled ? "on" : "off");
      if (musicEnabled && started && !paused && !gameOver) startMusic();
      else if (!musicEnabled) stopMusic();
      syncMusicControls();
    }, { signal });
    skinToggle?.addEventListener("click", () => {
      const opening = skinPicker.hidden;
      skinPicker.hidden = !opening;
      skinToggle.setAttribute("aria-expanded", String(opening));
    }, { signal });
    document.querySelectorAll("[data-snake-skin]").forEach((button) => button.addEventListener("click", () => {
      if (totalScore < skins[button.dataset.snakeSkin].unlock) return;
      skinName = button.dataset.snakeSkin;
      localStorage.setItem(skinKey, skinName);
      skinPicker.hidden = true;
      skinToggle?.setAttribute("aria-expanded", "false");
      syncSkinControls();
    }, { signal }));

    const rowKey = (row) => row.player_key || (row.user_id ? `user:${row.user_id}` : `guest:${row.guest_token}`);
    async function renderRanking() {
      if (!rankingList || !api?.isConfigured) return;
      try {
        const rows = await api.listSnakeGameRanking(50);
        let mine = rows.find((row) => rowKey(row) === playerKey);
        if (!mine && session) mine = await api.getMySnakeGameScore(session.user.id);
        best = Math.max(best, Number(mine?.best_score || (!session ? localStorage.getItem("xiaoluo-snake-local-best") : 0) || 0));
        bestEl.textContent = best;
        const displayRows = mine && !rows.some((row) => rowKey(row) === playerKey) ? [...rows, mine] : rows;
        rankingList.innerHTML = displayRows.map((row, index) => {
          const profile = row.profile || {};
          const key = rowKey(row);
          const userId = row.user_id || (String(key).startsWith("user:") ? String(key).slice(5) : "");
          const mineRow = key === playerKey;
          const name = profile.display_name || row.display_name || `玩家${index + 1}`;
          const avatarStyle = profile.avatar_url ? ` style="background-image:url('${escapeHtml(profile.avatar_url)}')"` : "";
          const avatar = row.is_guest ? '<span class="game-ranking-avatar game-guest-avatar">游</span>' : `<button class="game-ranking-avatar" type="button" data-profile-user-id="${escapeHtml(userId)}" aria-label="查看${escapeHtml(name)}的资料"${avatarStyle}>${profile.avatar_url ? "" : escapeHtml(name.slice(0, 1))}</button>`;
          return `<li class="game-ranking-row${mineRow ? " is-me" : ""}"><span class="game-ranking-rank">${index + 1}</span>${avatar}<strong class="game-ranking-name">${escapeHtml(name)}${mineRow ? "（我）" : ""}</strong><span class="game-ranking-score">${Number(row.best_score || 0)}</span></li>`;
        }).join("") || '<li class="game-ranking-empty">完成一局后，这里会显示你的成绩。</li>';
      } catch (error) {
        rankingList.innerHTML = '<li class="game-ranking-empty">请先执行 snake-game.sql 开启排行榜。</li>';
      }
    }

    const joinButton = document.querySelector("[data-snake-join-btn]");
    const nicknameModal = document.querySelector("[data-snake-nickname-modal]");
    const nicknameForm = document.querySelector("[data-snake-nickname-form]");
    const nicknameError = document.querySelector("[data-snake-nickname-error]");
    function updateJoinButton() {
      joinButton.textContent = session ? "已自动上榜" : guestRegistered ? "已上榜" : "参与排行榜";
      joinButton.disabled = Boolean(session || guestRegistered);
      joinButton.classList.toggle("is-active", Boolean(session || guestRegistered));
    }
    function closeNickname() { nicknameModal?.classList.remove("open"); }
    joinButton?.addEventListener("click", () => nicknameModal?.classList.add("open"), { signal });
    document.querySelectorAll("[data-snake-nickname-close]").forEach((button) => button.addEventListener("click", closeNickname, { signal }));
    nicknameForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nickname = nicknameForm.elements.nickname.value.trim();
      if (!nickname) return;
      try {
        const result = await api.setGuestSnakeNickname(guestToken, nickname);
        localStorage.setItem(guestNicknameKey, result.display_name);
        guestRegistered = true;
        const localBest = Number(localStorage.getItem("xiaoluo-snake-local-best") || 0);
        if (localBest > 0) { await api.submitGuestSnakeGameScore(guestToken, localBest); localStorage.removeItem("xiaoluo-snake-local-best"); }
        updateJoinButton(); closeNickname(); renderRanking();
      } catch (error) { nicknameError.textContent = error.message || "设置失败"; nicknameError.hidden = false; }
    }, { signal });

    const adminPanel = document.querySelector("[data-snake-admin-panel]");
    const adminList = document.querySelector("[data-snake-admin-list]");
    async function renderAdminList() {
      if (!isAdmin || !adminList) return;
      try {
        const guests = (await api.listSnakeGameRanking(100)).filter((row) => row.is_guest);
        adminList.innerHTML = guests.map((row) => { const token = String(row.player_key || "").replace(/^guest:/, ""); return `<li><span class="game-admin-name">${escapeHtml(row.display_name)}</span><span class="game-admin-score">${row.best_score}分</span><button type="button" class="game-admin-delete" data-delete-snake-guest="${escapeHtml(token)}">删除</button></li>`; }).join("") || '<li class="game-admin-empty">暂无游客记录</li>';
      } catch (_) { adminList.innerHTML = '<li class="game-admin-empty">加载失败</li>'; }
    }
    if (isAdmin && adminPanel) { adminPanel.hidden = false; renderAdminList(); document.querySelector("[data-snake-admin-refresh]")?.addEventListener("click", renderAdminList, { signal }); }
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-snake-guest]");
      if (!button || !isAdmin || !confirm("确认删除这条贪吃蛇游客成绩？")) return;
      button.disabled = true;
      try { await api.deleteGuestSnakeScore(button.dataset.deleteSnakeGuest); await renderRanking(); await renderAdminList(); } catch (error) { alert("删除失败：" + error.message); button.disabled = false; }
    }, { signal });

    syncMusicControls();
    syncSkinControls();
    updateJoinButton();
    reset();
    renderRanking();
    lastFrame = performance.now();
    frame = requestAnimationFrame(loop);
    window.destroyXiaoLuoSnakeGame = () => { cancelAnimationFrame(frame); stopMusic(); events.abort(); canvas.dataset.snakeReady = ""; window.destroyXiaoLuoSnakeGame = null; };
  }

  window.initXiaoLuoSnakeGame = initSnakeGame;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSnakeGame, { once: true });
  else initSnakeGame();
})();
