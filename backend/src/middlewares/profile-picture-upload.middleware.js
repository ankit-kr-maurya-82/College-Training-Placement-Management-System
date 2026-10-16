import multer from "multer";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const defaultMaxBytes = 2 * 1024 * 1024;
const absoluteMaxBytes = 10 * 1024 * 1024;

export function getProfilePictureMaxBytes() {
    const configured = Number(process.env.PROFILE_PICTURE_MAX_BYTES);
    if (!Number.isSafeInteger(configured) || configured < 1) return defaultMaxBytes;
    return Math.min(configured, absoluteMaxBytes);
}

export function detectImageMime(buffer) {
    if (!Buffer.isBuffer(buffer)) return null;
    if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer.lastIndexOf(Buffer.from([0xff, 0xd9])) === buffer.length - 2) return "image/jpeg";
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngEnd = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    if (buffer.length >= 33 && buffer.subarray(0, 8).equals(pngSignature)
        && buffer.readUInt32BE(8) === 13 && buffer.toString("ascii", 12, 16) === "IHDR"
        && buffer.lastIndexOf(pngEnd) === buffer.length - pngEnd.length) return "image/png";
    if (buffer.length >= 16 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
        const declaredLength = buffer.readUInt32LE(4) + 8;
        const chunk = buffer.toString("ascii", 12, 16);
        if (declaredLength === buffer.length && ["VP8 ", "VP8L", "VP8X"].includes(chunk)) return "image/webp";
    }
    return null;
}

export function validateProfilePicture(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) return { message: "A profilePicture image file is required" };
    if (!supportedTypes.has(file.mimetype)) return { status: 415, message: "Only JPEG, PNG, or WebP images are supported" };
    if (file.buffer.length > getProfilePictureMaxBytes()) return { status: 413, message: "Profile picture exceeds the upload size limit" };
    if (detectImageMime(file.buffer) !== file.mimetype) return { status: 400, message: "The uploaded file is not a valid image of the declared type" };
    return null;
}

export function receiveProfilePicture(req, res, next) {
    const parser = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: getProfilePictureMaxBytes(), files: 1, fields: 10 },
        fileFilter(_req, file, callback) {
            if (!supportedTypes.has(file.mimetype)) return callback(Object.assign(new Error("Unsupported image type"), { code: "UNSUPPORTED_IMAGE_TYPE" }));
            return callback(null, true);
        },
    }).single("profilePicture");
    parser(req, res, (error) => {
        if (error) {
            if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Profile picture exceeds the upload size limit" });
            if (error.code === "UNSUPPORTED_IMAGE_TYPE") return res.status(415).json({ message: "Only JPEG, PNG, or WebP images are supported" });
            if (error.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ message: "Use the profilePicture field for one image" });
            return res.status(400).json({ message: "Invalid profile picture upload" });
        }
        const validation = validateProfilePicture(req.file);
        if (validation) return res.status(validation.status || 400).json({ message: validation.message });
        return next();
    });
}
