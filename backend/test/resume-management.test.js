import assert from "node:assert/strict";
import test from "node:test";
import { detectResumeMime, validateResume } from "../src/middlewares/resume-upload.middleware.js";
import { setResumeStorageOperationsForTests, uploadResume, deleteResume } from "../src/services/resume-storage.service.js";

const pdf = Buffer.from("%PDF-1.4\n%EOF\n");
const docx = Buffer.from("PK\x03\x04word/document.xml[Content_Types].xml");

test("resume signature detection identifies PDF and DOCX", () => {
    assert.equal(detectResumeMime(pdf), "application/pdf");
    assert.equal(detectResumeMime(docx), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(validateResume({ buffer: pdf, mimetype: "application/pdf" }), null);
});

test("resume storage uploads and cleans up through injected operations", async () => {
    const deleted = [];
    setResumeStorageOperationsForTests({
        upload: async (buffer, options) => ({ secure_url: "https://res.cloudinary.com/demo/resume.pdf", public_id: "college-placement/resumes/new", options }),
        destroy: async (id) => deleted.push(id),
    });
    const uploaded = await uploadResume(pdf);
    assert.equal(uploaded.publicId, "college-placement/resumes/new");
    await deleteResume(uploaded.publicId);
    assert.deepEqual(deleted, [uploaded.publicId]);
    setResumeStorageOperationsForTests(null);
});
