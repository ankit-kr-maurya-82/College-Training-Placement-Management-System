const windowMs = 15 * 60 * 1000;
const maxRequests = 5;
const attempts = new Map();

export function verificationResendRateLimit(req, res, next) {
    const key = `${req.ip || req.socket?.remoteAddress || "unknown"}:${req.baseUrl || "verification"}`;
    const now = Date.now();
    const recent = (attempts.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= maxRequests) return res.status(429).json({ message: "Too many requests. Please try again later." });
    recent.push(now);
    attempts.set(key, recent);
    if (attempts.size > 5000) {
        for (const [entry, times] of attempts) if (!times.some((time) => now - time < windowMs)) attempts.delete(entry);
    }
    return next();
}
