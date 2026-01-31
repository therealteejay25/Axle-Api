import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "./logger";

// Configure Cloudinary
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
    });
    logger.info("Cloudinary configured");
} else {
    logger.warn("Cloudinary credentials missing");
}

export const getUploadSignature = () => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        {
            timestamp,
            folder: "avatars",
        },
        env.CLOUDINARY_API_SECRET!
    );

    return {
        signature,
        timestamp,
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
    };
};

export default cloudinary;
