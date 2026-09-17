-- 给文章评论表增加设备信息字段
-- 执行一次即可
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS device_info TEXT;

-- 给评论表添加注释
COMMENT ON COLUMN post_comments.device_info IS '评论者设备信息（JSON：设备类型、操作系统、浏览器、IP省份）';
