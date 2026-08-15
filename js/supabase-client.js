(function () {
  const config = window.XiaoLuoSupabaseConfig || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;

  function getVisitorId() {
    const key = "xiaoluo-site-visitor-id";
    let visitorId = localStorage.getItem(key);
    if (!visitorId) {
      visitorId = window.crypto?.randomUUID?.() || `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, visitorId);
    }
    return visitorId;
  }

  function getViewIdentity(userId) {
    return userId ? `user:${userId}` : `visitor:${getVisitorId()}`;
  }

  window.XiaoLuoSupabase = {
    client,
    isConfigured,

    async signUpWithEmail(email, password) {
      if (!client) throw new Error("Supabase 还没有配置。");
      const { data, error } = await client.auth.signUp({
        email: String(email || "").trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login.html`
        }
      });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        const duplicateError = new Error("这个邮箱已经注册过了，可以直接登录。");
        duplicateError.code = "user_already_registered";
        throw duplicateError;
      }
      await this.ensureProfile(data.user, email);
      return data;
    },

    async signInWithEmail(email, password) {
      if (!client) throw new Error("Supabase 还没有配置。");
      const { data, error } = await client.auth.signInWithPassword({
        email: String(email || "").trim(),
        password
      });
      if (error) throw error;
      if (data.user && !data.user.email_confirmed_at && !data.user.confirmed_at) {
        await client.auth.signOut();
        const verificationError = new Error("请先去邮箱确认账号，再登录。");
        verificationError.code = "email_not_confirmed";
        throw verificationError;
      }
      await this.ensureProfile(data.user, email);
      return data;
    },

    async verifyPassword(email, password) {
      const { error } = await client.auth.signInWithPassword({ email: String(email || "").trim(), password });
      if (error) throw error;
    },

    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
    },

    async requestAccountDeletion(password) {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData.session) throw sessionError || new Error("登录状态已失效。");
      const response = await fetch(`${config.url}/functions/v1/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "注销账户失败。");
      if (result.deleted !== true) throw new Error("注销服务尚未正确部署，请在 Supabase 重新部署 delete-account 函数。");
    },

    async signOut() {
      if (!client) return;
      await client.auth.signOut();
    },

    async getSession() {
      if (!client) return null;
      const { data } = await client.auth.getSession();
      return data.session;
    },

    async ensureProfile(user, email) {
      if (!client || !user) return;
      const { data: existing, error: readError } = await client.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (readError) throw readError;
      if (existing) return;
      const { error } = await client.from("profiles").insert({ id: user.id, phone: null, updated_at: new Date().toISOString() });
      if (error) console.warn("Profile save skipped:", error.message);
    },

    async trackVisit(pagePath) {
      if (!client) return;
      await Promise.allSettled([
        client.from("page_views").insert({ page_path: pagePath, user_agent: navigator.userAgent }),
        client.rpc("record_site_presence", { p_visitor_id: getVisitorId(), p_page_path: pagePath })
      ]);
    },

    async heartbeatPresence(pagePath) {
      if (!client) return;
      const { error } = await client.rpc("record_site_presence", { p_visitor_id: getVisitorId(), p_page_path: pagePath });
      if (error && error.code !== "PGRST202") throw error;
    },

    async getSiteMetrics() {
      if (!client) return { uniqueVisitors: 0, onlineVisitors: 0, todayVisitors: 0 };
      const [{ data, error }, todayResult] = await Promise.all([
        client.rpc("get_site_metrics"),
        client.rpc("get_today_site_visitors")
      ]);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        uniqueVisitors: Number(row?.unique_visitors || 0),
        onlineVisitors: Number(row?.online_visitors || 0),
        todayVisitors: Number(todayResult.data || 0)
      };
    },

    async listGuestbookMessages(limit = 40) {
      const { data, error } = await client.from("guestbook_messages")
        .select("id, nickname, message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    async addGuestbookMessage(nickname, message) {
      const { data, error } = await client.from("guestbook_messages")
        .insert({ nickname: String(nickname || "").trim(), message: String(message || "").trim() })
        .select("id, nickname, message, created_at")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteGuestbookMessage(messageId) {
      const { error } = await client.from("guestbook_messages").delete().eq("id", messageId);
      if (error) throw error;
    },

    async listWhispers(userId = "", limit = 100) {
      let request = client.from("whispers")
        .select("id, user_id, parent_id, content, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (userId) request = request.eq("user_id", userId);
      const { data, error } = await request;
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((item) => item.user_id).filter(Boolean))];
      const { data: profiles, error: profileError } = ids.length
        ? await client.from("profiles").select("id, display_name, avatar_url, is_admin").in("id", ids)
        : { data: [], error: null };
      if (profileError) throw profileError;
      const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return rows.map((item) => ({ ...item, profile: profilesById.get(item.user_id) || null }));
    },

    async addWhisper(userId, content, parentId = null) {
      const { data, error } = await client.from("whispers")
        .insert({ user_id: userId, parent_id: parentId || null, content: String(content || "").trim() })
        .select("id, user_id, parent_id, content, created_at, updated_at")
        .single();
      if (error) throw error;
      return data;
    },

    async deleteWhisper(whisperId) {
      const { error } = await client.from("whispers").delete().eq("id", whisperId);
      if (error) throw error;
    },

    async getWhisperCount(userId) {
      const { count, error } = await client.from("whispers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("parent_id", null);
      if (error) throw error;
      return count || 0;
    },

    async getPublicWhisperSummary(userId) {
      const { data, error } = await client.rpc("get_public_whisper_summary", { p_user_id: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const previews = Array.isArray(row?.previews)
        ? row.previews
        : (typeof row?.previews === "string" ? JSON.parse(row.previews || "[]") : []);
      return { count: Number(row?.total_count || 0), previews };
    },

    async getWhisperUnreadCount(since, currentUserId = "") {
      if (!since) return 0;
      let request = client.from("whispers")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since);
      if (currentUserId) request = request.neq("user_id", currentUserId);
      const { count, error } = await request;
      if (error) throw error;
      return count || 0;
    },

    async listWhisperTemplates() {
      const { data, error } = await client.from("whisper_templates").select("id, content, sort_order, created_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async addWhisperTemplate(content) {
      const { data: latest } = await client.from("whisper_templates").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await client.from("whisper_templates").insert({ content: String(content || "").trim(), sort_order: Number(latest?.sort_order || 0) + 10 }).select("id, content, sort_order, created_at").single();
      if (error) throw error;
      return data;
    },

    async deleteWhisperTemplate(templateId) {
      const { error } = await client.from("whisper_templates").delete().eq("id", templateId);
      if (error) throw error;
    },

    async listJumpGameRanking(limit = 20) {
      const { data: rpcRows, error: rpcError } = await client.rpc("list_jump_game_leaderboard", { p_limit: limit });
      if (!rpcError) return (rpcRows || []).map((row) => ({ ...row, best_score: Number(row.best_score || 0), profile: { display_name: row.display_name, avatar_url: row.avatar_url } }));
      const { data, error } = await client.from("jump_game_scores")
        .select("user_id, best_score, updated_at")
        .order("best_score", { ascending: false })
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      const scores = data || [];
      if (!scores.length) return [];
      const { data: profiles, error: profileError } = await client.from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", scores.map((row) => row.user_id));
      if (profileError) throw profileError;
      const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return scores.map((row) => ({ ...row, profile: profileById.get(row.user_id) || null }));
    },

    async getMyJumpGameScore(userId) {
      const { data, error } = await client.from("jump_game_scores")
        .select("user_id, best_score, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile, error: profileError } = await client.from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      return { ...data, profile: profile || null };
    },

    async submitJumpGameScore(score) {
      const { data, error } = await client.rpc("submit_jump_game_score", { p_score: Math.max(0, Math.floor(Number(score) || 0)) });
      if (!error) return data;
      const session = await this.getSession();
      if (!session) throw error;
      const nextScore = Math.max(0, Math.floor(Number(score) || 0));
      const { data: existing, error: readError } = await client.from("jump_game_scores").select("best_score").eq("user_id", session.user.id).maybeSingle();
      if (readError) throw error;
      const bestScore = Math.max(nextScore, Number(existing?.best_score || 0));
      const { data: saved, error: writeError } = await client.from("jump_game_scores")
        .upsert({ user_id: session.user.id, best_score: bestScore, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
        .select("user_id, best_score, updated_at")
        .single();
      if (writeError) throw error;
      return saved;
    },

    async submitGuestJumpGameScore(guestToken, score) {
      const { data, error } = await client.rpc("submit_guest_jump_game_score", { p_guest_token: guestToken, p_score: Math.max(0, Math.floor(Number(score) || 0)) });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { ...row, best_score: Number(row.best_score || 0) } : null;
    },

    async listFriendLinks() {
      const { data, error } = await client.from("friend_links").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async addFriendLink(link) {
      const { data: latest } = await client.from("friend_links").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await client.from("friend_links").insert({ ...link, sort_order: Number(latest?.sort_order || 0) + 10 }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteFriendLink(linkId) {
      const { error } = await client.from("friend_links").delete().eq("id", linkId);
      if (error) throw error;
    },

    async getProfile(userId) {
      const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },

    async getPublicProfile(userId) {
      const { data, error } = await client.from("profiles")
        .select("id, display_name, avatar_url, is_admin, gender, personal_tags, personal_bio, mbti")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async getAdminProfile() {
      const { data, error } = await client.from("profiles").select("*").eq("is_admin", true).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },

    async saveProfile(userId, profile) {
      const payload = {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url || null,
        home_title: profile.home_title,
        home_bio: profile.home_bio,
        home_background_url: profile.home_background_url || null,
        about_title: profile.about_title || "关于小罗",
        about_bio: profile.about_bio || "",
        about_side_bio: profile.about_side_bio || "",
        announcement: profile.announcement || "",
        contacts: profile.contacts || {},
        updated_at: new Date().toISOString()
      };
      const { data: existing, error: readError } = await client.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (readError) throw readError;
      const request = existing
        ? client.from("profiles").update(payload).eq("id", userId)
        : client.from("profiles").insert({ id: userId, ...payload });
      const { error } = await request;
      if (error) throw error;
    },

    async updateOwnIdentity(userId, identity) {
      const { data, error } = await client.from("profiles")
        .update({
          display_name: identity.display_name,
          avatar_url: identity.avatar_url || null,
          gender: identity.gender || null,
          personal_tags: Array.isArray(identity.personal_tags) ? identity.personal_tags.slice(0, 4) : [],
          personal_bio: identity.personal_bio || null,
          mbti: identity.mbti || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async uploadFile(userId, folder, file) {
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
      const { error } = await client.storage.from("xiaoluo-media").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      return client.storage.from("xiaoluo-media").getPublicUrl(path).data.publicUrl;
    },

    async deleteFilesByPublicUrls(urls) {
      const paths = (urls || []).map((url) => {
        try {
          const marker = "/storage/v1/object/public/xiaoluo-media/";
          const path = new URL(url).pathname.split(marker)[1];
          return path ? decodeURIComponent(path) : null;
        } catch (_) { return null; }
      }).filter(Boolean);
      if (!paths.length) return;
      const { error } = await client.storage.from("xiaoluo-media").remove(paths);
      if (error) throw error;
    },

    async listMusicTracks(userId) {
      let query = client.from("music_tracks").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
      if (userId) query = query.eq("user_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async addMusicTrack(userId, track) {
      const { data, error } = await client.from("music_tracks").insert({ user_id: userId, ...track }).select().single();
      if (error) throw error;
      return data;
    },

    async updateMusicTrack(userId, trackId, track) {
      const { error } = await client.from("music_tracks").update({ ...track, updated_at: new Date().toISOString() }).eq("id", trackId).eq("user_id", userId);
      if (error) throw error;
    },

    async deleteMusicTrack(userId, trackId) {
      const { error } = await client.from("music_tracks").delete().eq("id", trackId).eq("user_id", userId);
      if (error) throw error;
    },

    async listContent(table, userId) {
      let query = client.from(table).select("*").eq("user_id", userId);
      query = (table === "moments" || table === "progress_logs")
        ? query.order("entry_date", { ascending: false }).order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async listMomentTeasers(userId) {
      const { data, error } = await client.rpc("list_locked_moment_teasers", { p_owner_id: userId });
      if (error) throw error;
      return data || [];
    },

    async addContent(table, row) {
      const { data, error } = await client.from(table).insert(row).select().single();
      if (error) throw error;
      return data;
    },

    async updateContent(table, id, userId, row) {
      const { error } = await client.from(table).update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },

    async deleteContent(table, id, userId) {
      const { error } = await client.from(table).delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    },

    async listPosts(userId) {
      const { data, error } = await client.from("posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async listPublishedPosts(userId) {
      const { data, error } = await client.from("posts").select("*").eq("user_id", userId).eq("status", "published").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async savePost(userId, post) {
      const { data, error } = await client.from("posts").insert({ user_id: userId, ...post }).select().single();
      if (error) throw error;
      return data;
    },

    async updatePost(userId, postId, post) {
      const { data, error } = await client.from("posts")
        .update({ ...post, updated_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async getPostEngagement(postId, userId) {
      const [likes, views, comments, ownLike] = await Promise.all([
        client.from("post_likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_views").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_comments").select("id, content, created_at, user_id, parent_id").eq("post_id", postId).order("created_at", { ascending: true }),
        userId ? client.from("post_likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);
      if (likes.error || views.error || comments.error || ownLike.error) throw likes.error || views.error || comments.error || ownLike.error;
      const commentRows = comments.data || [];
      const userIds = [...new Set(commentRows.map((comment) => comment.user_id).filter(Boolean))];
      let profiles = [];
      if (userIds.length) {
        const { data, error } = await client.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
        if (error) throw error;
        profiles = data || [];
      }
      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
      return {
        likes: likes.count || 0,
        views: views.count || 0,
        comments: commentRows.map((comment) => ({ ...comment, profile: profilesById.get(comment.user_id) || null })),
        liked: Boolean(ownLike.data)
      };
    },

    async getPostEngagementSummary(postId) {
      const [likes, views, comments] = await Promise.all([
        client.from("post_likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_views").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_comments").select("id", { count: "exact", head: true }).eq("post_id", postId)
      ]);
      if (likes.error || views.error || comments.error) throw likes.error || views.error || comments.error;
      return { likes: likes.count || 0, views: views.count || 0, comments: comments.count || 0 };
    },

    async recordPostView(postId, userId) {
      const visitorId = getViewIdentity(userId);
      const { error } = await client.from("post_views").upsert({ post_id: postId, user_id: userId || null, visitor_id: visitorId }, { onConflict: "post_id,visitor_id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async togglePostLike(postId, userId, liked) {
      if (liked) {
        const { error } = await client.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
        if (error) throw error;
        return false;
      }
      const { error } = await client.from("post_likes").insert({ post_id: postId, user_id: userId });
      if (error) throw error;
      return true;
    },

    async addPostComment(postId, userId, content, parentId = null) {
      const { data, error } = await client.from("post_comments").insert({ post_id: postId, user_id: userId, content, parent_id: parentId }).select().single();
      if (error) throw error;
      return data;
    },

    async deletePostComment(commentId) {
      const { error } = await client.from("post_comments").delete().eq("id", commentId);
      if (error) throw error;
    },

    async getTotalLikes() {
      const { count, error } = await client.from("post_likes").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },

    async getStorageUsage() {
      const { data, error } = await client.rpc("get_blog_storage_usage");
      if (error) throw error;
      return Number(data || 0);
    },

    async getContentComments(contentType, contentId) {
      const { data, error } = await client.from("content_comments").select("id, content, created_at, user_id, parent_id").eq("content_type", contentType).eq("content_id", contentId).order("created_at", { ascending: true });
      if (error) throw error;
      const ids = [...new Set((data || []).map((item) => item.user_id))];
      const { data: profiles, error: profileError } = ids.length ? await client.from("profiles").select("id, display_name, avatar_url").in("id", ids) : { data: [], error: null };
      if (profileError) throw profileError;
      const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      return (data || []).map((item) => ({ ...item, profile: profilesById.get(item.user_id) || null }));
    },

    async addContentComment(contentType, contentId, userId, content, parentId = null) {
      const { error } = await client.from("content_comments").insert({ content_type: contentType, content_id: contentId, user_id: userId, content, parent_id: parentId });
      if (error) throw error;
    },

    async deleteContentComment(commentId) {
      const { error } = await client.from("content_comments").delete().eq("id", commentId);
      if (error) throw error;
    },

    async getContentEngagement(contentType, contentId, userId) {
      const [likes, views, comments, ownLike] = await Promise.all([
        client.from("content_likes").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        client.from("content_views").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        client.from("content_comments").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        userId ? client.from("content_likes").select("id").eq("content_type", contentType).eq("content_id", contentId).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);
      if (likes.error || views.error || comments.error || ownLike.error) throw likes.error || views.error || comments.error || ownLike.error;
      return { likes: likes.count || 0, views: views.count || 0, comments: comments.count || 0, liked: Boolean(ownLike.data) };
    },

    async recordContentView(contentType, contentId, userId) {
      const visitorId = getViewIdentity(userId);
      const { error } = await client.from("content_views").upsert({ content_type: contentType, content_id: contentId, user_id: userId || null, visitor_id: visitorId }, { onConflict: "content_type,content_id,visitor_id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async toggleContentLike(contentType, contentId, userId, liked) {
      if (liked) {
        const { error } = await client.from("content_likes").delete().eq("content_type", contentType).eq("content_id", contentId).eq("user_id", userId);
        if (error) throw error;
        return false;
      }
      const { error } = await client.from("content_likes").insert({ content_type: contentType, content_id: contentId, user_id: userId });
      if (error) throw error;
      return true;
    },

    async getActivityStatus() {
      const { data, error } = await client.rpc("get_my_activity_status");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? {
        score: Number(row.score || 0),
        title: row.title || "初入人",
        checkedToday: Boolean(row.checked_today),
        nextScore: Number(row.next_score || 0),
        nextTitle: row.next_title || ""
      } : null;
    },

    async dailyActivityCheckIn() {
      const { data, error } = await client.rpc("daily_activity_checkin");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { score: Number(row.score || 0), title: row.title || "初入人", checkedToday: true } : null;
    },

    async listActivityLeaderboard() {
      const { data, error } = await client.rpc("list_activity_leaderboard");
      if (error) throw error;
      return (data || []).map((row) => ({
        ...row,
        score: Number(row.score || 0),
        rank: Number(row.rank || 0)
      }));
    },

    async getUserActivitySummary(userId) {
      const { data, error } = await client.rpc("get_user_activity_summary", { p_user_id: userId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { score: Number(row.score || 0), title: row.title || "初入人" } : null;
    },

    async getActivityHeatmap(userId = null) {
      const { data, error } = await client.rpc("get_activity_heatmap", { p_user_id: userId || null });
      if (error) throw error;
      return (data || []).map((row) => ({ date: row.activity_date, count: Number(row.activity_count || 0) }));
    },

    async listRegisteredUsers() {
      const { data, error } = await client.rpc("list_blog_registered_users");
      if (error) throw error;
      return data || [];
    },

    async listTaxonomy(table, userId) {
      const { data, error } = await client.from(table).select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    async addTaxonomy(table, userId, name) {
      const { data, error } = await client.from(table).insert({ user_id: userId, name }).select().single();
      if (error) throw error;
      return data;
    },

    async deleteTaxonomy(table, id, userId) {
      const { error } = await client.from(table).delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
    }
  };
})();
