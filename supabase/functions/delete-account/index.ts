import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("未登录。");
    const { password } = await request.json();
    if (!password) throw new Error("请输入当前密码确认。");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user?.email) throw new Error("登录状态已失效，请重新登录。");

    const passwordCheck = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password })
    });
    if (!passwordCheck.ok) throw new Error("当前密码不正确。");

    const adminClient = createClient(url, serviceRoleKey);
    const folders = ["avatars", "post-covers", "post-attachments", "moments", "progress", "albums", "music"];
    for (const folder of folders) {
      const prefix = `${user.id}/${folder}`;
      const { data: files } = await adminClient.storage.from("xiaoluo-media").list(prefix, { limit: 1000 });
      if (files?.length) await adminClient.storage.from("xiaoluo-media").remove(files.map((file) => `${prefix}/${file.name}`));
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, true);
    if (deleteError) throw deleteError;
    return Response.json({ deleted: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "注销账户失败。" }, { status: 400, headers: corsHeaders });
  }
});
