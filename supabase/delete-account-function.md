# Deploy the account deletion function

1. In Supabase, open **Edge Functions** and choose **Create a new function**.
2. Name it `delete-account` and keep JWT verification enabled.
3. Replace the editor content with `functions/delete-account/index.ts` from this folder.
4. Deploy the function.

The function uses Supabase's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. Do not add the service role key to the website or Vercel.
