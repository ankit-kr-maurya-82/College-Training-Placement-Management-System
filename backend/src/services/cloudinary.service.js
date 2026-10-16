import { v2 as cloudinary } from "cloudinary";

const folder = "college-placement/profile-pictures";
let testOperations = null;

function configuredClient() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        const error = new Error("Cloudinary is not configured");
        error.code = "CLOUDINARY_NOT_CONFIGURED";
        throw error;
    }
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
    return cloudinary;
}

export function setCloudinaryOperationsForTests(operations) { testOperations = operations; }

export async function uploadProfilePicture(buffer) {
    let result;
    if (testOperations) {
        result = await testOperations.upload(buffer, { folder, resource_type: "image", allowed_formats: ["jpg", "png", "webp"] });
    } else {
        const client = configuredClient();
        result = await new Promise((resolve, reject) => {
            const stream = client.uploader.upload_stream(
                { folder, resource_type: "image", allowed_formats: ["jpg", "png", "webp"], unique_filename: true, overwrite: false },
                (error, uploaded) => error ? reject(error) : resolve(uploaded),
            );
            stream.end(buffer);
        });
    }
    let parsedUrl;
    try { parsedUrl = new URL(result?.secure_url); } catch { parsedUrl = null; }
    if (!parsedUrl || parsedUrl.protocol !== "https:" || typeof result?.public_id !== "string" || !result.public_id) {
        throw new Error("Cloudinary returned an invalid image result");
    }
    return { url: parsedUrl.toString(), publicId: result.public_id };
}

export async function deleteProfilePicture(publicId) {
    if (!publicId) return;
    if (testOperations) return testOperations.destroy(publicId, { resource_type: "image", invalidate: true });
    return configuredClient().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}
