// Vercel Serverless Function: 获取访客公网 IP 和地理位置。
// Vercel 会覆盖外部伪造的 X-Forwarded-For，因此优先读取其受信任请求头。
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const firstIp = (value) => String(value || "").split(",")[0].trim().replace(/^::ffff:/, "");
  const realIp = firstIp(
    req.headers["x-vercel-forwarded-for"]
      || req.headers["x-real-ip"]
      || req.headers["x-forwarded-for"]
  );
  const decodeHeader = (value) => {
    if (!value) return "";
    try { return decodeURIComponent(String(value)); } catch (_) { return String(value); }
  };
  const vercelCountry = String(req.headers["x-vercel-ip-country"] || "").trim();
  const vercelRegion = decodeHeader(req.headers["x-vercel-ip-country-region"]);
  const vercelCity = decodeHeader(req.headers["x-vercel-ip-city"]);
  let countryName = vercelCountry;
  try { countryName = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(vercelCountry) || vercelCountry; } catch (_) {}
  const readableRegion = /^[A-Z0-9]{2,3}$/.test(vercelRegion) ? "" : vercelRegion;
  const vercelLocation = [countryName, readableRegion, vercelCity].filter(Boolean).join(" ");

  if (!realIp) {
    return res.status(200).json({ ip: "", location: "未知地址" });
  }

  // 优先尝试 hiofd 的公开 IP 查询接口。它可提供区县级中文归属地；
  // 失败时才依次使用其他定位库和 Vercel 的入口地理信息兜底。
  const providers = [
    {
      url: `https://tool.hiofd.com/ip/api.php?ip=${encodeURIComponent(realIp)}`,
      parse: (d) => ({
        country: d.country || "",
        country_code: d.country_code || "",
        region: d.province || d.region || "",
        city: d.city || ""
      }),
      valid: (d) => d && (d.country || d.province || d.region || d.city || d.addr),
      timeout: 2800,
      source: "hiofd"
    },
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
      return res.status(200).json({ ip: realIp, ...parsed, source: provider.source || "geo-provider" });
    } catch (_) {
      continue;
    }
  }

  // 所有补充接口失败时，至少保留 Vercel 入口识别的国家/地区。
  res.status(200).json({
    ip: realIp,
    location: vercelLocation || "未知地址",
    country_code: vercelCountry,
    region: readableRegion,
    city: vercelCity,
    source: "vercel"
  });
}
