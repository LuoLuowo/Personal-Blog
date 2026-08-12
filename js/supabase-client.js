(function () {
  const config = window.XiaoLuoSupabaseConfig || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;

  window.XiaoLuoSupabase = {
    client,
    isConfigured,

    async signUpWithEmail(email, password) {
      if (!client) throw new Error("Supabase 还没有配置。");
      const { data, error } = await client.auth.signUp({
        email: String(email || "").trim(),
        password
      });
      if (error) throw error;
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
      await this.ensureProfile(data.user, email);
      return data;
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
      await client.from("page_views").insert({
        page_path: pagePath,
        user_agent: navigator.userAgent
      });
    },

    async getProfile(userId) {
      const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
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
        .update({ display_name: identity.display_name, avatar_url: identity.avatar_url || null, updated_at: new Date().toISOString() })
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

    async listContent(table, userId) {
      const { data, error } = await client.from(table).select("*").eq("user_id", userId).order("created_at", { ascending: false });
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
        client.from("post_comments").select("id, content, created_at, user_id").eq("post_id", postId).order("created_at", { ascending: false }),
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

    async recordPostView(postId, userId) {
      if (!userId) return;
      const { error } = await client.from("post_views").upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
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

    async addPostComment(postId, userId, content) {
      const { data, error } = await client.from("post_comments").insert({ post_id: postId, user_id: userId, content }).select().single();
      if (error) throw error;
      return data;
    },

    async getTotalLikes() {
      const { count, error } = await client.from("post_likes").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
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
