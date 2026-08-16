// Vercel Serverless Function: 获取访客真实IP和地理位置
// 服务端获取IP比客户端更可靠，不受CORS和客户端网络限制
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  // 1. 从请求头获取客户端真实IP
  const forwarded = req.headers["x-forwarded-for"] || "";
  const realIp = forwarded.split(",")[0].trim().replace(/^::ffff:/, "") || "";

  if (!realIp) {
    return res.status(200).json({ ip: "", location: "未知地址" });
  }

  // 2. 依次尝试多个IP定位API，取第一个有结果的
  const providers = [
    {
      url: `https://ipwho.is/${encodeURIComponent(realIp)}`,
      parse: (d) => ({
        country: d.country || "",
        country_code: d.country_code || "",
        region: d.region || "",
        city: d.city || ""
      }),
      valid: (d) => d && d.success !== false && (d.country || d.region || d.city),
      timeout: 4000
    },
    {
      url: `https://ipapi.co/${encodeURIComponent(realIp)}/json/`,
      parse: (d) => ({
        country: d.country_name || "",
        country_code: d.country_code || "",
        region: d.region || "",
        city: d.city || ""
      }),
      valid: (d) => d && !d.error && (d.country_name || d.region || d.city),
      timeout: 4000
    },
    {
      url: `https://api.ip.sb/geoip/${encodeURIComponent(realIp)}`,
      parse: (d) => ({
        country: d.country || "",
        country_code: d.country_code || "",
        region: d.region || "",
        city: d.city || ""
      }),
      valid: (d) => d && (d.country || d.region || d.city),
      timeout: 4000
    },
    {
      // hiofd 在线工具网兜底（如接口不可用则跳过，前端日志页提供手动查位置链接）
      url: `https://tool.hiofd.com/ip/api.php?ip=${encodeURIComponent(realIp)}`,
      parse: (d) => ({
        country: d.country || "",
        country_code: d.country_code || "",
        region: d.province || d.region || "",
        city: d.city || ""
      }),
      valid: (d) => d && (d.country || d.province || d.city || d.addr),
      timeout: 2500
    }
  ];

  for (const provider of providers) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeout || 4000);
      const resp = await fetch(provider.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) continue;
      const d = await resp.json();
      if (!provider.valid(d)) continue;
      const parsed = provider.parse(d);
      return res.status(200).json({ ip: realIp, ...parsed });
    } catch (_) {
      continue;
    }
  }

  // 3. 所有接口都失败，返回IP和未知位置
  res.status(200).json({ ip: realIp, location: "未知地址" });
}
