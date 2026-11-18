const MAX_EXTRACTED_TEXT = 100000;
const MIN_USEFUL_TEXT = 20;

function normalizeText(text) {
    return String(text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}

async function extractPdf(buffer) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result?.text || "";
}

async function extractDocx(buffer) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result?.value || "";
}

export async function extractResumeText(buffer, mimeType) {
    try {
        let rawText;
        if (mimeType === "application/pdf") {
            rawText = await extractPdf(buffer);
        } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            rawText = await extractDocx(buffer);
        } else {
            const error = new Error("Unsupported resume MIME type");
            error.code = "UNSUPPORTED_MIME_TYPE";
            throw error;
        }
        const text = normalizeText(rawText);
        if (!text) {
            const error = new Error("No usable text extracted");
            error.code = "EMPTY_TEXT";
            throw error;
        }
        if (text.length > MAX_EXTRACTED_TEXT) {
            const error = new Error("Extracted text exceeds limit");
            error.code = "TEXT_TOO_LARGE";
            throw error;
        }
        return { text, status: "SUCCESS" };
    } catch (error) {
        const code = error?.code || (mimeType === "application/pdf" ? "PDF_EXTRACTION_FAILED" : "DOCX_EXTRACTION_FAILED");
        return { text: "", status: code === "EMPTY_TEXT" ? "EMPTY" : "FAILED", errorCode: code };
    }
}
