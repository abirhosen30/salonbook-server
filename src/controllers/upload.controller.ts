import { Request, Response } from "express";
import { uploadToImgBB } from "../services/imgbb.service.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { ENV } from "../config/environment.js";

export async function uploadImageHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.file) {
      sendError(res, "No image file provided. Please attach an image.", 400);
      return;
    }

    // If IMGBB_API_KEY is configured, upload to ImgBB
    if (ENV.IMGBB_API_KEY) {
      const result = await uploadToImgBB(
        req.file.buffer,
        req.file.originalname || "salonbook-upload"
      );

      sendSuccess(
        res,
        {
          url: result.url,
          displayUrl: result.displayUrl,
        },
        "Image uploaded to ImgBB successfully"
      );
      return;
    }

    // In local development if API key is not configured yet:
    // Generate a permanent data URI or deterministic high quality image URL
    console.warn(
      "⚠️ IMGBB_API_KEY not set in environment. Returning data URL for local development."
    );
    const mime = req.file.mimetype;
    const base64 = req.file.buffer.toString("base64");
    const dataUri = `data:${mime};base64,${base64}`;

    sendSuccess(
      res,
      {
        url: dataUri,
        displayUrl: dataUri,
      },
      "Image uploaded (local data URI fallback)"
    );
  } catch (error: any) {
    console.error("uploadImageHandler error:", error);
    sendError(res, error.message || "Failed to process image upload", 500);
  }
}
