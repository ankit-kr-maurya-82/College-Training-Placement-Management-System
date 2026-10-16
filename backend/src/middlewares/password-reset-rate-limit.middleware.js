const windowMs = 15 * 60 * 1000;
const maxRequests = 5;
const attempts = new Map();

export function passwordResetRateLimit(req, res, next) {
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.params.accountType}:${req.path}`;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxRequests) return res.status(429).json({ message: "Too many password reset attempts. Please try again later." });
    recent.push(now);
    attempts.set(key, recent);
    if (attempts.size > 5000) {
        for (const [entry, times] of attempts) if (!times.some((time) => now - time < windowMs)) attempts.delete(entry);
    }
    return next();
}
