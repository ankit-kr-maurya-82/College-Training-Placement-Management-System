import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
    const authorization = req.get("authorization") ?? "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "Authentication is not configured" });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

export default authenticateToken;
