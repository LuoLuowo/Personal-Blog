-- Run once in Supabase SQL Editor after the music files are deployed with the website.
-- Existing music is preserved; only missing bundled tracks are inserted.
with admin_user as (
  select id from public.profiles where is_admin = true order by created_at asc limit 1
), bundled(title, artist, category, file_url, sort_order) as (
  values
    ('有爱就不怕', '庄心妍', '流行音乐', './assets/music/庄心妍 - 有爱就不怕(抖音热搜版) (1).mp3', 10),
    ('如果的事', '徐艺洋', '流行音乐', './assets/music/徐艺洋-如果的事 (1).mp3', 20),
    ('我们在怀念的演唱会', 'DJ小式', '流行音乐', './assets/music/M500000tP0kb0pjwGN (1).mp3', 30),
    ('去年夏天', '王大毛', '流行音乐', './assets/music/去年夏天、王大毛.mp3', 40),
    ('Rore Period', 'La Mer', '轻音乐', './assets/music/Rore Period、 La Mer..mp3', 50),
    ('七里香', '吉拉朵', '流行音乐', './assets/music/七里香 吉拉朵.mp3', 60),
    ('一个人走，风很冷', '未知歌手', '流行音乐', './assets/music/一个人走、风很冷.mp3', 70)
)
insert into public.music_tracks (user_id, title, artist, category, file_url, sort_order)
select admin_user.id, bundled.title, bundled.artist, bundled.category, bundled.file_url, bundled.sort_order
from admin_user cross join bundled
where not exists (
  select 1 from public.music_tracks existing
  where existing.user_id = admin_user.id
    and lower(trim(existing.title)) = lower(trim(bundled.title))
    and lower(trim(coalesce(existing.artist, ''))) = lower(trim(bundled.artist))
);
