// 轻量、无依赖的固定窗口限流。按已认证 user_id 限制，匿名登录流程按 IP 限制。
const MAX_BUCKETS = 10_000;
const OVERFLOW_KEY = '__rate_limit_overflow__';

function rateLimit({ windowMs, max, name = '操作', key = (req) => req.vaultUserId || req.ip || req.socket?.remoteAddress || 'anonymous', skip = () => false }) {
  const buckets = new Map();
  let operations = 0;
  const sweep = (now) => {
    for (const [bucketKey, value] of buckets) if (now >= value.resetAt) buckets.delete(bucketKey);
  };
  return (req, res, next) => {
    if (skip(req)) return next();
    const now = Date.now();
    if (++operations % 128 === 0) sweep(now);
    let id = String(key(req));
    let current = buckets.get(id);
    // 登录接口按 IP 分桶，大量不同源地址会撑大 Map；到达上限后先清理过期项，
    // 仍满则降级为统一桶，保证内存有界（宁可共享限流，也不无限增长）。
    if (!current && buckets.size >= MAX_BUCKETS) {
      sweep(now);
      if (buckets.size >= MAX_BUCKETS) {
        id = OVERFLOW_KEY;
        current = buckets.get(id);
      }
    }
    const bucket = !current || now >= current.resetAt
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count++;
    buckets.set(id, bucket);
    if (bucket.count <= max) return next();
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({ error: `${name}过于频繁，请稍后再试` });
  };
}

module.exports = { rateLimit };
