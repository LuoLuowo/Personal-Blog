-- 仅运行一次：清空旧计分制下的贪吃蛇排行榜成绩。
-- 不会删除用户账号、昵称或其他博客数据。
begin;
delete from public.snake_game_scores;
delete from public.snake_game_guest_scores;
commit;
