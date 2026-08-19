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

  // IP 信息缓存，避免每次心跳都请求第三方接口
  let cachedIpInfo = null;
  let ipInfoPromise = null;

  // 用户信息缓存，避免每次心跳都查数据库
  let cachedUserInfo = null;
  let userInfoCacheTime = 0;

  // 中国省份中英文映射
  const CN_PROVINCE_MAP = {
    "Beijing": "北京", "Tianjin": "天津", "Hebei": "河北", "Shanxi": "山西",
    "Inner Mongolia": "内蒙古", "Liaoning": "辽宁", "Jilin": "吉林",
    "Heilongjiang": "黑龙江", "Shanghai": "上海", "Jiangsu": "江苏",
    "Zhejiang": "浙江", "Anhui": "安徽", "Fujian": "福建", "Jiangxi": "江西",
    "Shandong": "山东", "Henan": "河南", "Hubei": "湖北", "Hunan": "湖南",
    "Guangdong": "广东", "Guangxi": "广西", "Hainan": "海南",
    "Chongqing": "重庆", "Sichuan": "四川", "Guizhou": "贵州",
    "Yunnan": "云南", "Tibet": "西藏", "Shaanxi": "陕西", "Gansu": "甘肃",
    "Qinghai": "青海", "Ningxia": "宁夏", "Xinjiang": "新疆",
    "Taiwan": "台湾", "Hong Kong": "香港", "Macau": "澳门"
  };

  // 中国主要城市中英文映射
  const CN_CITY_MAP = {
    "Zhengzhou": "郑州", "Kaifeng": "开封", "Luoyang": "洛阳",
    "Pingdingshan": "平顶山", "Anyang": "安阳", "Hebi": "鹤壁",
    "Xinxiang": "新乡", "Jiaozuo": "焦作", "Puyang": "濮阳",
    "Xuchang": "许昌", "Luohe": "漯河", "Sanmenxia": "三门峡",
    "Nanyang": "南阳", "Shangqiu": "商丘", "Xinyang": "信阳",
    "Zhoukou": "周口", "Zhumadian": "驻马店", "Jiyuan": "济源",
    "Guangzhou": "广州", "Shenzhen": "深圳", "Hangzhou": "杭州",
    "Nanjing": "南京", "Wuhan": "武汉", "Chengdu": "成都",
    "Xi'an": "西安", "Xian": "西安", "Changsha": "长沙", "Jinan": "济南",
    "Qingdao": "青岛", "Dalian": "大连", "Xiamen": "厦门",
    "Suzhou": "苏州", "Wuxi": "无锡", "Ningbo": "宁波",
    "Hefei": "合肥", "Fuzhou": "福州", "Harbin": "哈尔滨",
    "Changchun": "长春", "Shenyang": "沈阳", "Shijiazhuang": "石家庄",
    "Taiyuan": "太原", "Nanchang": "南昌", "Kunming": "昆明",
    "Guiyang": "贵阳", "Lanzhou": "兰州", "Urumqi": "乌鲁木齐",
    "Nanning": "南宁", "Haikou": "海口", "Lhasa": "拉萨",
    "Yinchuan": "银川", "Xining": "西宁", "Tangshan": "唐山",
    "Qinhuangdao": "秦皇岛", "Handan": "邯郸", "Baoding": "保定",
    "Zhangjiakou": "张家口", "Chengde": "承德", "Cangzhou": "沧州",
    "Langfang": "廊坊", "Hengshui": "衡水", "Datong": "大同",
    "Yangquan": "阳泉", "Changzhi": "长治", "Jincheng": "晋城",
    "Shuozhou": "朔州", "Jinzhong": "晋中", "Yuncheng": "运城",
    "Xinzhou": "忻州", "Linfen": "临汾", "Lvliang": "吕梁",
    "Wuhu": "芜湖", "Bengbu": "蚌埠", "Huainan": "淮南",
    "Maanshan": "马鞍山", "Huaibei": "淮北", "Tongling": "铜陵",
    "Anqing": "安庆", "Huangshan": "黄山", "Chuzhou": "滁州",
    "Fuyang": "阜阳", "Suzhou-Anhui": "宿州", "Lu'an": "六安",
    "Bozhou": "亳州", "Chizhou": "池州", "Xuancheng": "宣城",
    "Putian": "莆田", "Sanming": "三明", "Quanzhou": "泉州",
    "Zhangzhou": "漳州", "Nanping": "南平", "Longyan": "龙岩",
    "Ningde": "宁德", "Jingdezhen": "景德镇", "Pingxiang": "萍乡",
    "Jiujiang": "九江", "Xinyu": "新余", "Yingtan": "鹰潭",
    "Ganzhou": "赣州", "Ji'an": "吉安", "Yichun": "宜春",
    "Fuzhou-Jiangxi": "抚州", "Shangrao": "上饶", "Zibo": "淄博",
    "Zaozhuang": "枣庄", "Dongying": "东营", "Yantai": "烟台",
    "Weifang": "潍坊", "Jining": "济宁", "Tai'an": "泰安",
    "Weihai": "威海", "Rizhao": "日照", "Linyi": "临沂",
    "Dezhou": "德州", "Liaocheng": "聊城", "Binzhou": "滨州",
    "Heze": "菏泽", "Huangshi": "黄石", "Shiyan": "十堰",
    "Yichang": "宜昌", "Xiangyang": "襄阳", "Ezhou": "鄂州",
    "Jingmen": "荆门", "Xiaogan": "孝感", "Jingzhou": "荆州",
    "Huanggang": "黄冈", "Xianning": "咸宁", "Suizhou": "随州",
    "Enshi": "恩施", "Zhuzhou": "株洲", "Xiangtan": "湘潭",
    "Hengyang": "衡阳", "Shaoyang": "邵阳", "Yueyang": "岳阳",
    "Changde": "常德", "Zhangjiajie": "张家界", "Yiyang": "益阳",
    "Chenzhou": "郴州", "Yongzhou": "永州", "Huaihua": "怀化",
    "Loudi": "娄底", "Xiangxi": "湘西", "Shaoguan": "韶关",
    "Zhuhai": "珠海", "Shantou": "汕头", "Foshan": "佛山",
    "Jiangmen": "江门", "Zhanjiang": "湛江", "Maoming": "茂名",
    "Zhaoqing": "肇庆", "Huizhou": "惠州", "Meizhou": "梅州",
    "Shanwei": "汕尾", "Heyuan": "河源", "Yangjiang": "阳江",
    "Qingyuan": "清远", "Dongguan": "东莞", "Zhongshan": "中山",
    "Chaozhou": "潮州", "Jieyang": "揭阳", "Yunfu": "云浮",
    "Liuzhou": "柳州", "Guilin": "桂林", "Wuzhou": "梧州",
    "Beihai": "北海", "Fangchenggang": "防城港", "Qinzhou": "钦州",
    "Guigang": "贵港", "Yulin": "玉林", "Baise": "百色",
    "Hezhou": "贺州", "Hechi": "河池", "Laibin": "来宾",
    "Chongzuo": "崇左", "Sanya": "三亚", "Sansha": "三沙",
    "Danzhou": "儋州", "Wuzhong": "吴忠", "Guyaun": "固原",
    "Zhongwei": "中卫", "Shizuishan": "石嘴山", "Panzhihua": "攀枝花",
    "Luzhou": "泸州", "Deyang": "德阳", "Mianyang": "绵阳",
    "Guangyuan": "广元", "Suining": "遂宁", "Neijiang": "内江",
    "Leshan": "乐山", "Nanchong": "南充", "Meishan": "眉山",
    "Yibin": "宜宾", "Guang'an": "广安", "Dazhou": "达州",
    "Ya'an": "雅安", "Bazhong": "巴中", "Ziyang": "资阳",
    "Aba": "阿坝", "Garze": "甘孜", "Liangshan": "凉山",
    "Liupanshui": "六盘水", "Zunyi": "遵义", "Anshun": "安顺",
    "Bijie": "毕节", "Tongren": "铜仁", "Qujing": "曲靖",
    "Yuxi": "玉溪", "Baoshan": "保山", "Zhaotong": "昭通",
    "Lijiang": "丽江", "Pu'er": "普洱", "Lincang": "临沧",
    "Chuxiong": "楚雄", "Honghe": "红河", "Wenshan": "文山",
    "Xishuangbanna": "西双版纳", "Dali": "大理", "Dehong": "德宏",
    "Nujiang": "怒江", "Diqu": "迪庆", "Lhasa": "拉萨",
    "Tongchuan": "铜川", "Baoji": "宝鸡", "Xianyang": "咸阳",
    "Weinan": "渭南", "Yan'an": "延安", "Hanzhong": "汉中",
    "Yulin": "榆林", "Ankang": "安康", "Shangluo": "商洛",
    "Jiayuguan": "嘉峪关", "Jinchang": "金昌", "Baiyin": "白银",
    "Tianshui": "天水", "Wuwei": "武威", "Zhangye": "张掖",
    "Pingliang": "平凉", "Jiuquan": "酒泉", "Qingyang": "庆阳",
    "Dingxi": "定西", "Longnan": "陇南", "Linxia": "临夏",
    "Gannan": "甘南", "Xiangyang": "襄阳", "Lijiang": "丽江"
  };

  function toChineseLocation(json) {
    // 国内接口直接返回中文，拼接省/市/区
    if (json.__chinese) {
      const parts = [];
      if (json.province) parts.push(json.province);
      if (json.city && json.city !== json.province) parts.push(json.city);
      if (json.district && json.district !== json.city) parts.push(json.district);
      return parts.join(" ") || (json.country || "中国");
    }
    const isChina = json.country_code === "CN" || json.country === "China";
    if (!isChina) {
      const parts = [];
      if (json.country) parts.push(json.country);
      if (json.region && json.region !== json.country) parts.push(json.region);
      if (json.city && json.city !== json.region) parts.push(json.city);
      return parts.join(" ") || (json.country_code || "未知位置");
    }
    const province = CN_PROVINCE_MAP[json.region] || json.region || "";
    const city = CN_CITY_MAP[json.city] || json.city || "";
    const result = [province, city].filter(Boolean).join(" ");
    return result || "中国";
  }

  async function fetchIpInfo() {
    if (cachedIpInfo) return cachedIpInfo;
    if (ipInfoPromise) return ipInfoPromise;
    ipInfoPromise = (async () => {
      // 优先调用服务端接口（Vercel Serverless Function，最稳妥）
      try {
        const resp = await fetch("/api/visitor-info", { cache: "no-store" });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ip) {
            const location = data.location
              ? data.location
              : toChineseLocation({
                  country: data.country,
                  country_code: data.country_code,
                  region: data.region,
                  city: data.city
                });
            cachedIpInfo = {
              ip: data.ip,
              location: location && location !== "中国" ? location : "未知地址"
            };
            return cachedIpInfo;
          }
        }
      } catch (_) {
        // 服务端接口不可用（如本地开发），降级到前端方案
      }

      // 降级：前端同时查询多个IP库，取有位置且精度最高的
      const candidates = await Promise.allSettled([
        (async () => {
          const resp = await fetch("https://whois.pconline.com.cn/ipJson.jsp?json=true", { cache: "no-store" });
          if (!resp.ok) throw new Error("pconline status");
          const text = await resp.text();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error("pconline no json");
          const d = JSON.parse(jsonMatch[0]);
          if (!d || !d.ip) throw new Error("pconline invalid");
          const parts = [];
          if (d.pro) parts.push(d.pro.replace(/省$/, ""));
          if (d.city && d.city !== d.pro) parts.push(d.city.replace(/市$/, ""));
          if (d.region && d.region !== d.city) parts.push(d.region.replace(/县$/, "").replace(/区$/, ""));
          return { ip: d.ip, location: parts.join(" ") || (d.addr && d.addr !== "中国" ? d.addr : ""), precision: parts.length };
        })(),
        (async () => {
          const resp = await fetch("https://ip.useragentinfo.com/json", { cache: "no-store" });
          if (!resp.ok) throw new Error("uai status");
          const d = await resp.json();
          if (!d || !d.ip) throw new Error("uai invalid");
          const parts = [];
          if (d.province) parts.push(d.province.replace(/省$/, ""));
          if (d.city && d.city !== d.province) parts.push(d.city.replace(/市$/, ""));
          if (d.district && d.district !== d.city) parts.push(d.district.replace(/县$/, "").replace(/区$/, ""));
          return { ip: d.ip, location: parts.join(" "), precision: parts.length };
        })(),
        (async () => {
          const resp = await fetch("https://api.ip.sb/geoip", { cache: "no-store" });
          if (!resp.ok) throw new Error("ipsb status");
          const d = await resp.json();
          if (!d || !d.ip) throw new Error("ipsb invalid");
          return { ip: d.ip, location: toChineseLocation({ country: d.country, country_code: d.country_code, region: d.region, city: d.city }), precision: d.city ? 2 : d.region ? 1 : 0 };
        })(),
        (async () => {
          const resp = await fetch("https://ipwho.is/", { cache: "no-store" });
          if (!resp.ok) throw new Error("ipwho status");
          const d = await resp.json();
          if (!d || d.success === false || !d.ip) throw new Error("ipwho invalid");
          return { ip: d.ip, location: toChineseLocation(d), precision: d.city ? 2 : d.region ? 1 : 0 };
        })()
      ]);

      let best = null;
      for (const r of candidates) {
        if (r.status !== "fulfilled" || !r.value || !r.value.ip) continue;
        const hasLocation = r.value.location && r.value.location !== "中国" && r.value.location !== "未知位置";
        if (!best) { best = r.value; continue; }
        const bestHasLoc = best.location && best.location !== "中国" && best.location !== "未知位置";
        if (hasLocation && !bestHasLoc) { best = r.value; continue; }
        if (!hasLocation && bestHasLoc) continue;
        if (r.value.precision > best.precision) best = r.value;
      }

      if (!best) {
        cachedIpInfo = { ip: "", location: "未知地址" };
        ipInfoPromise = null;
        return cachedIpInfo;
      }
      if (!best.location || best.location === "中国") best.location = "未知地址";
      cachedIpInfo = { ip: best.ip, location: best.location };
      return cachedIpInfo;
    })();
    return ipInfoPromise;
  }

  async function getCurrentUserInfo() {
    if (!client) return { userId: null, userName: null };
    const now = Date.now();
    if (cachedUserInfo && now - userInfoCacheTime < 60000) return cachedUserInfo;
    try {
      const { data } = await client.auth.getUser();
      const user = data?.user;
      if (!user) { cachedUserInfo = { userId: null, userName: null }; userInfoCacheTime = now; return cachedUserInfo; }
      const { data: profile } = await client.from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      cachedUserInfo = {
        userId: user.id,
        userName: profile?.display_name || user.email || "登录用户"
      };
      userInfoCacheTime = now;
      return cachedUserInfo;
    } catch (_) {
      cachedUserInfo = { userId: null, userName: null };
      userInfoCacheTime = now;
      return cachedUserInfo;
    }
  }

  window.XiaoLuoSupabase = {
    client,
    isConfigured,
    getVisitorId,

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
      const results = await Promise.allSettled([fetchIpInfo(), getCurrentUserInfo()]);
      const ipInfo = results[0].status === "fulfilled" ? results[0].value : { ip: "", location: "" };
      const userInfo = results[1].status === "fulfilled" ? results[1].value : { userId: null, userName: null };
      await Promise.allSettled([
        client.from("page_views").insert({ page_path: pagePath, user_agent: navigator.userAgent }),
        client.rpc("record_site_presence", {
          p_visitor_id: getVisitorId(),
          p_page_path: pagePath,
          p_ip_address: ipInfo.ip || null,
          p_ip_location: ipInfo.location || null,
          p_user_id: userInfo.userId || null,
          p_user_name: userInfo.userName || null,
          p_increment_count: true
        })
      ]);
    },

    async heartbeatPresence(pagePath) {
      if (!client) return;
      const results = await Promise.allSettled([fetchIpInfo(), getCurrentUserInfo()]);
      const ipInfo = results[0].status === "fulfilled" ? results[0].value : { ip: "", location: "" };
      const userInfo = results[1].status === "fulfilled" ? results[1].value : { userId: null, userName: null };
      const { error } = await client.rpc("record_site_presence", {
        p_visitor_id: getVisitorId(),
        p_page_path: pagePath,
        p_ip_address: ipInfo.ip || null,
        p_ip_location: ipInfo.location || null,
        p_user_id: userInfo.userId || null,
        p_user_name: userInfo.userName || null
      });
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

    async getOnlineVisitorsDetail() {
      if (!client) return [];
      const { data, error } = await client.rpc("get_online_visitors_detail");
      if (error) throw error;
      return data || [];
    },

    async getTodayVisitorsDetail() {
      if (!client) return [];
      const { data, error } = await client.rpc("get_today_visitors_detail");
      if (error) throw error;
      return data || [];
    },

    async getAllVisitorsDetail() {
      if (!client) return [];
      const { data, error } = await client.rpc("get_all_visitors_detail");
      if (error) throw error;
      return data || [];
    },

    async getRepeatVisitorsDetail() {
      if (!client) return [];
      const { data, error } = await client.rpc("get_repeat_visitors_detail");
      if (error) throw error;
      return data || [];
    },

    async getRepeatVisitorsDetail() {
      if (!client) return [];
      const { data, error } = await client.rpc("get_repeat_visitors_detail");
      if (error) throw error;
      return data || [];
    },

    async searchVisitorLogs(ip) {
      if (!client || !ip) return [];
      const { data, error } = await client.rpc("search_visitor_logs", { p_ip: ip });
      if (error) throw error;
      return data || [];
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
      if (!rpcError) return (rpcRows || []).map((row) => ({
        player_key: row.out_player_key || row.player_key,
        display_name: row.out_display_name || row.display_name,
        avatar_url: row.out_avatar_url || row.avatar_url,
        best_score: Number(row.out_best_score ?? row.best_score ?? 0),
        is_guest: row.out_is_guest ?? row.is_guest,
        profile: { display_name: row.out_display_name || row.display_name, avatar_url: row.out_avatar_url || row.avatar_url }
      }));
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
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        return row ? { best_score: Number(row.out_best_score ?? row.best_score ?? 0) } : null;
      }
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
      return row ? { display_name: row.out_display_name || row.display_name, best_score: Number(row.out_best_score ?? row.best_score ?? 0) } : null;
    },

    async setGuestNickname(guestToken, nickname) {
      const { data, error } = await client.rpc("set_guest_nickname", { p_guest_token: guestToken, p_nickname: String(nickname || "").trim() });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? { display_name: row.out_display_name || row.display_name, best_score: Number(row.out_best_score ?? row.best_score ?? 0) } : null;
    },

    async deleteGuestJumpScore(guestToken) {
      const { error } = await client.rpc("delete_guest_jump_score", { p_guest_token: guestToken });
      if (error) throw error;
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

    async getPostEngagement(postId, userId, visitorId) {
      const ownLikeQuery = userId
        ? client.from("post_likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
        : visitorId
          ? client.from("post_likes").select("id").eq("post_id", postId).eq("visitor_id", visitorId).maybeSingle()
          : Promise.resolve({ data: null, error: null });
      const [likes, views, comments, ownLike] = await Promise.all([
        client.from("post_likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_views").select("id", { count: "exact", head: true }).eq("post_id", postId),
        client.from("post_comments").select("id, content, created_at, user_id, parent_id").eq("post_id", postId).order("created_at", { ascending: true }),
        ownLikeQuery
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

    async togglePostLike(postId, userId, liked, visitorId) {
      const isAnonymous = !userId && visitorId;
      if (liked) {
        let query = client.from("post_likes").delete().eq("post_id", postId);
        query = isAnonymous ? query.eq("visitor_id", visitorId) : query.eq("user_id", userId);
        const { error } = await query;
        if (error) throw error;
        return false;
      }
      const { error } = await client.from("post_likes").insert({
        post_id: postId,
        user_id: userId || null,
        visitor_id: isAnonymous ? visitorId : null
      });
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

    async getContentEngagement(contentType, contentId, userId, visitorId) {
      const ownLikeQuery = userId
        ? client.from("content_likes").select("id").eq("content_type", contentType).eq("content_id", contentId).eq("user_id", userId).maybeSingle()
        : visitorId
          ? client.from("content_likes").select("id").eq("content_type", contentType).eq("content_id", contentId).eq("visitor_id", visitorId).maybeSingle()
          : Promise.resolve({ data: null, error: null });
      const [likes, views, comments, ownLike] = await Promise.all([
        client.from("content_likes").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        client.from("content_views").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        client.from("content_comments").select("id", { count: "exact", head: true }).eq("content_type", contentType).eq("content_id", contentId),
        ownLikeQuery
      ]);
      if (likes.error || views.error || comments.error || ownLike.error) throw likes.error || views.error || comments.error || ownLike.error;
      return { likes: likes.count || 0, views: views.count || 0, comments: comments.count || 0, liked: Boolean(ownLike.data) };
    },

    async recordContentView(contentType, contentId, userId) {
      const visitorId = getViewIdentity(userId);
      const { error } = await client.from("content_views").upsert({ content_type: contentType, content_id: contentId, user_id: userId || null, visitor_id: visitorId }, { onConflict: "content_type,content_id,visitor_id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async toggleContentLike(contentType, contentId, userId, liked, visitorId) {
      const isAnonymous = !userId && visitorId;
      if (liked) {
        let query = client.from("content_likes").delete().eq("content_type", contentType).eq("content_id", contentId);
        query = isAnonymous ? query.eq("visitor_id", visitorId) : query.eq("user_id", userId);
        const { error } = await query;
        if (error) throw error;
        return false;
      }
      const { error } = await client.from("content_likes").insert({
        content_type: contentType,
        content_id: contentId,
        user_id: userId || null,
        visitor_id: isAnonymous ? visitorId : null
      });
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
