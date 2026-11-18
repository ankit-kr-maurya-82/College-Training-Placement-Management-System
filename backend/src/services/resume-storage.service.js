let testOperations = null;

const folder = "college-placement/resumes";
const downloadExpirySeconds = 300;

export function getResumeDownloadExpirySeconds() {
    return downloadExpirySeconds;
}

export function setResumeStorageOperationsForTests(operations) {
    testOperations = operations;
}

export async function uploadResume(buffer) {
    if (testOperations) {
        const result = await testOperations.upload(buffer, { folder, resource_type: "raw", type: "private" });
        if (!result?.secure_url || !result?.public_id) throw new Error("Invalid resume upload result");
        return { url: result.secure_url, publicId: result.public_id };
    }
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        const error = new Error("Cloudinary is not configured");
        error.code = "CLOUDINARY_NOT_CONFIGURED";
        throw error;
    }
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder, resource_type: "raw", type: "private", unique_filename: true, overwrite: false },
                (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
            );
        stream.end(buffer);
    });
    if (!result?.secure_url || !result?.public_id) throw new Error("Cloudinary returned an invalid resume result");
    return { url: result.secure_url, publicId: result.public_id };
}

export async function getSignedResumeUrl(publicId) {
    if (!publicId) return null;
    if (testOperations?.sign) return testOperations.sign(publicId, downloadExpirySeconds);
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        const error = new Error("Cloudinary is not configured");
        error.code = "CLOUDINARY_NOT_CONFIGURED";
        throw error;
    }
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    const expiresAt = Math.floor(Date.now() / 1000) + downloadExpirySeconds;
    return cloudinary.utils.private_download_url(publicId, "raw", { expires_at: expiresAt, resource_type: "raw" });
}
export async function downloadResumeBuffer(publicId) {
    const url = await getSignedResumeUrl(publicId);
    const response = await fetch(url);
    if (!response.ok) throw new Error("Resume download failed");
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
export async function deleteResume(publicId) {
    if (!publicId) return;
    if (testOperations) return testOperations.destroy(publicId, { resource_type: "raw", invalidate: true });
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return;
    const { v2: cloudinary } = await import("cloudinary");
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    return cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
}
