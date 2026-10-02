-- 给文章表增加加密密码字段
-- 执行一次即可
ALTER TABLE posts ADD COLUMN IF NOT EXISTS access_password TEXT;

COMMENT ON COLUMN posts.access_password IS '文章阅读密码（4位数字，仅protected状态使用）';
