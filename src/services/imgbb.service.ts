import FormData from "form-data";
import { ENV } from "../config/environment.js";

export interface ImgBBUploadResult {
  url: string;
  displayUrl: string;
  deleteUrl?: string;
}

export async function uploadToImgBB(
  fileBuffer: Buffer,
  fileName: string
): Promise<ImgBBUploadResult> {
  if (!ENV.IMGBB_API_KEY) {
    // If no API key configured in dev environment, use a deterministic unsplash fallback or throw error
    console.warn("⚠️ IMGBB_API_KEY is not configured in environment.");
    throw new Error(
      "ImgBB API key is not configured on the server. Please set IMGBB_API_KEY in server environment."
    );
  }

  const form = new FormData();
  form.append("image", fileBuffer.toString("base64"));
  form.append("name", fileName);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${ENV.IMGBB_API_KEY}`,
    {
      method: "POST",
      body: form as any,
      headers: form.getHeaders(),
    }
  );

  const result: any = await response.json();

  if (!response.ok || !result.success) {
    const errorMsg =
      result?.error?.message || "Failed to upload image to ImgBB service.";
    throw new Error(errorMsg);
  }

  return {
    url: result.data.url,
    displayUrl: result.data.display_url || result.data.url,
    deleteUrl: result.data.delete_url,
  };
}
