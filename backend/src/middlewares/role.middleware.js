export function authorizeRoles(...roles) {
    const allowed = new Set(roles.map((role) => String(role).toUpperCase()));
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: "Authentication required" });
        const role = String(req.user.role ?? "").toUpperCase();
        if (!allowed.has(role)) return res.status(403).json({ message: "Insufficient permissions" });
        return next();
    };
}

export default authorizeRoles;
