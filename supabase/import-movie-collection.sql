-- 电影集合批量导入。
-- 在 Supabase SQL Editor 中完整执行一次。
-- 脚本会自动找到 is_admin=true 的管理员，不会要求手动填写 UUID。
-- 同标题已有记录时只补齐封面、评分和日期，不会重复创建；已有观后感不会覆盖。

do $$
declare
  v_admin_id uuid;
  v_item jsonb;
  v_item_id uuid;
begin
  select id into v_admin_id
  from public.profiles
  where is_admin = true
  order by created_at asc
  limit 1;

  if v_admin_id is null then
    raise exception '没有找到管理员 profile，请先确认管理员账号已经完成登录并创建 profile。';
  end if;

  for v_item in
    select value from jsonb_array_elements($data$
    [
      {"title":"捕风追影","people":"成龙","cover_url":"https://image.tmdb.org/t/p/w500/cHKo3m8N1fwvEy2ZEr0xGmmMODV.jpg","watched_year":2026,"watched_month":5,"watched_day":29,"review":"看完之后，会感觉世界如此之大，人外有人，像豺狼的那部电影一样，外面的贩毒、以及各种系统，仿佛还有更厉害的大佬，就像有厉害的警察，也会有厉害的大佬集团一样，以及很多大佬都是在二三十岁学了很多很多东西，后来才能积淀出来的，只能说这些看起来都很有意思，但如果让自己去过这样的生活，你会去过吗，每天确实会心惊胆战一样，你觉得安稳的生活好呢还是每天都刺激生活好呢。"},
      {"title":"垫底辣妹","cover_url":"https://image.tmdb.org/t/p/w500/m53V2l1A5imyTvXDlxltc49hZfU.jpg","watched_year":2025,"review":"这部电影让我懂得了，坚持以恒，一定可以的，累了就休息放松一下，让学习变得有乐趣，不要把目标想的难以实现，即便是清华北大，你也是可以的，成功的路上总会有一些帮助你的人，那便是你一路来帮你铺路的，如果没有人愿意相信你，你也一定要相信自己，一定不要放弃，还有不要把自己的目标降低，否则会一次次的降低，要相信自己可以的，就像你去年玩了一年认为自己400都是几乎不可能的概率，可是你真的成功了，真的成功了，你一定要相信自己的努力付出。"},
      {"title":"贴身保镖","cover_url":"https://image.tmdb.org/t/p/w500/cnlHZutHbHFtHYarTes08pD5IKG.jpg","watched_year":2025,"review":"看完整部剧，才发现整部剧最大的阴谋就是开头那个绑炸弹女的，那个男的根本不是她丈夫，一切都是为了那个生意，然后去杀死内政大权，整部剧都在以高层为主，揭露了剧中的种种形象人格，我觉得男主他才是被骗的人哈哈，开局就被那个女生给骗了，因为那个女生是一个柔弱女子，然后忽悠到最终，全部人都被那个女生骗了，还把男主害惨了，都不愿意救他哈哈哈，身上还被绑着炸弹，没人相信他，这揭露了美国警察局的某种状况。"},
      {"title":"豺狼的日子I","cover_url":"https://image.tmdb.org/t/p/w500/vThgcb3JOj99yETg8WChuci4LV2.jpg","review":"这个电影看完之后，感觉直接清醒出了资本的力量，以及背后的故事，既写出了豺狼的感情无奈，又写出了资本的力量，果然验证了那个跨越阶层是不可能的，背后资本们还有自己的暗网，雇佣一切力量杀死触碰资本的蛋糕的人，只能说太震惊了。"},
      {"title":"风雨哈佛路","cover_url":"https://image.tmdb.org/t/p/w500/oI6BivZQsKj5uZLsudJOke8rc1S.jpg","watched_year":2025,"review":"感觉莉丝特别坚强，父母完全不顾家庭，吸毒泛滥，莉丝在面对种种困难并没有选择放弃摆烂，而是去解决问题，全班的人都嘲讽她不洗澡浑身都是味道，她在如此破烂不堪的环境下生活下来，为了自己以后能有一个家庭，不用带着行李奔波，毅然选择了读书改变命运，最终考上了哈佛大学。"},
      {"title":"鬼上车","cover_url":"https://image.tmdb.org/t/p/w500/2sOEJzhPzjTkZSlPbGxOJ7xgIyS.jpg","watched_year":2026,"review":"有一点惊悚，写的是古老的传说秘符，在半夜的公路上停车会被恶灵盯上，直到被恶灵杀掉为结束，最后男女主靠教堂制服了恶灵结束了故事。"},
      {"title":"八佰","cover_url":"https://image.tmdb.org/t/p/w500/gWKYKGDLEMCSAyjQ1e0rpBSoRMD.jpg","watched_year":2022},
      {"title":"银河补习班","cover_url":"https://image.tmdb.org/t/p/w500/iGBUeEFacHLZiAtTxvnH6mgLpsS.jpg","watched_year":2020},
      {"title":"孤注一掷","cover_url":"https://image.tmdb.org/t/p/w500/3GPgQAzJRmbsrd3UvnkBJikefzp.jpg","watched_year":2024},
      {"title":"第二十条","cover_url":"https://image.tmdb.org/t/p/w500/atUfcWtxyILttah3ItN329ouAU.jpg","watched_year":2024},
      {"title":"湄公河行动","cover_url":"https://image.tmdb.org/t/p/w500/wghFabaZgRorsMQWuPtKUlzq4W1.jpg","watched_year":2024},
      {"title":"长津湖","cover_url":"https://image.tmdb.org/t/p/w500/iXvAlIo4DPLBiraC2KLu4977Wo2.jpg","watched_year":2021},
      {"title":"血战钢锯岭","cover_url":"https://image.tmdb.org/t/p/w500/fnOMP6mjmOmZwmlC1n0K7ivrzt1.jpg","watched_year":2024},
      {"title":"唐人街探案","cover_url":"https://image.tmdb.org/t/p/w500/sYmdUFpcpRqlmeETqhcMrYJbjbN.jpg","watched_year":2020},
      {"title":"唐人街探案2","cover_url":"https://image.tmdb.org/t/p/w500/p88dG7zfvne14Fn2UHFa2lqijyE.jpg","watched_year":2022},
      {"title":"消失的她","cover_url":"https://image.tmdb.org/t/p/w500/oJ0X8ULclI1fQUXj14VcUFCjvXo.jpg","watched_year":2023},
      {"title":"飞驰人生","cover_url":"https://image.tmdb.org/t/p/w500/kBKD2ZbtwNkNGWJiUj9ojKNytm7.jpg","watched_year":2021},
      {"title":"一点就到家","cover_url":"https://image.tmdb.org/t/p/w500/gDzNg9oNJoX7P4i5GjgLIOrrwzw.jpg","watched_year":2023},
      {"title":"忠犬八公的故事 美版","cover_url":"https://image.tmdb.org/t/p/w500/3g5oG4bQCC4sk9DkVQACK89fa7Y.jpg","watched_year":2024},
      {"title":"当幸福来敲门","cover_url":"https://image.tmdb.org/t/p/w500/lBYOKAMcxIvuk9s9hMuecB9dPBV.jpg","watched_year":2022},
      {"title":"绿皮书","cover_url":"https://image.tmdb.org/t/p/w500/9JQmPWE8ZCGx6D3Z2ZIy1MU6ZSU.jpg","watched_year":2022},
      {"title":"楚门的世界","cover_url":"https://image.tmdb.org/t/p/w500/vuza0WqY239yBXOadKlGwJsZJFE.jpg","watched_year":2023},
      {"title":"流浪地球2","cover_url":"https://image.tmdb.org/t/p/w500/hEA7bpWw5IRKOW2MVjvx46SWevU.jpg","watched_year":2020},
      {"title":"千与千寻","cover_url":"https://image.tmdb.org/t/p/w500/uvjE8iVZZ2EbQrP4gIQNHivaTjn.jpg","watched_year":2017},
      {"title":"肖申克的救赎","cover_url":"https://image.tmdb.org/t/p/w500/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg","watched_year":2023}
    ]$data$::jsonb)
  loop
    select id into v_item_id
    from public.media_items
    where user_id = v_admin_id and title = v_item->>'title'
    limit 1;

    if v_item_id is null then
      insert into public.media_items (
        user_id, title, description, cover_url, rating, media_type, people,
        watched_year, watched_month, watched_day
      ) values (
        v_admin_id, v_item->>'title', '', v_item->>'cover_url', 7, '电影',
        coalesce(v_item->>'people', ''),
        nullif(v_item->>'watched_year', '')::integer,
        nullif(v_item->>'watched_month', '')::integer,
        nullif(v_item->>'watched_day', '')::integer
      ) returning id into v_item_id;
    else
      update public.media_items
      set cover_url = coalesce(nullif(cover_url, ''), v_item->>'cover_url'),
          rating = case when rating = 0 then 7 else rating end,
          watched_year = coalesce(watched_year, nullif(v_item->>'watched_year', '')::integer),
          watched_month = coalesce(watched_month, nullif(v_item->>'watched_month', '')::integer),
          watched_day = coalesce(watched_day, nullif(v_item->>'watched_day', '')::integer),
          updated_at = now()
      where id = v_item_id;
    end if;

    if coalesce(v_item->>'review', '') <> '' then
      insert into public.media_reviews (user_id, media_item_id, review_title, review)
      values (v_admin_id, v_item_id, '观后感', v_item->>'review')
      on conflict (media_item_id) do nothing;
    end if;
  end loop;
end $$;
