import multer from "multer";

const supportedTypes = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const maxBytes = 5 * 1024 * 1024;

export function getResumeMaxBytes() {
    return maxBytes;
}

export function detectResumeMime(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
    if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
        const hasWordDocument = buffer.toString("latin1").includes("word/document.xml");
        const hasContentTypes = buffer.toString("latin1").includes("[Content_Types].xml");
        if (hasWordDocument && hasContentTypes) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
    }
    return null;
}

export function validateResume(file) {
    if (!file || !Buffer.isBuffer(file.buffer)) return { message: "A resume file is required" };
    if (!supportedTypes.has(file.mimetype)) return { status: 415, message: "Only PDF or DOCX resumes are supported" };
    if (file.buffer.length > maxBytes) return { status: 413, message: "Resume exceeds the 5 MB size limit" };
    if (detectResumeMime(file.buffer) !== file.mimetype) return { status: 400, message: "The uploaded file is not a valid resume of the declared type" };
    return null;
}

export function receiveResume(req, res, next) {
    const parser = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: maxBytes, files: 1, fields: 10 },
        fileFilter(_req, file, callback) {
            if (!supportedTypes.has(file.mimetype)) return callback(Object.assign(new Error("Unsupported resume type"), { code: "UNSUPPORTED_RESUME_TYPE" }));
            return callback(null, true);
        },
    }).single("resume");
    parser(req, res, (error) => {
        if (error) {
            if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Resume exceeds the 5 MB size limit" });
            if (error.code === "UNSUPPORTED_RESUME_TYPE") return res.status(415).json({ message: "Only PDF or DOCX resumes are supported" });
            if (error.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ message: "Use the resume field for one file" });
            return res.status(400).json({ message: "Invalid resume upload" });
        }
        const validation = validateResume(req.file);
        if (validation) return res.status(validation.status || 400).json({ message: validation.message });
        return next();
    });
}
