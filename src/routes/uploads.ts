import { Router } from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { logger } from "../services/logger";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "axle-uploads";

// Multer configuration for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// POST /api/uploads/image
router.post("/image", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { agentId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }

    // Generate unique file ID and key
    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname) || ".jpg";
    const s3Key = `uploads/${agentId}/${fileId}${fileExtension}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        agentId: agentId,
        uploadedBy: req.user.id,
      },
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${s3Key}`;

    logger.info("Image uploaded successfully", {
      fileId,
      agentId,
      userId: req.user.id,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });

    res.json({
      fileId,
      url,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      filename: file.originalname,
    });
  } catch (error: any) {
    logger.error("Image upload failed:", error);
    
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ error: "Only image files are allowed" });
    }
    
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 20MB limit" });
    }

    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;