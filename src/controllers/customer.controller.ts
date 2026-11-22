import { Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getUsersCollection,
} from "../config/database.js";
import { AuthenticatedRequest } from "../types/index.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export async function getCustomerStats(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const appointmentsCollection = getAppointmentsCollection();

    const [total, pending, confirmed, cancelled] = await Promise.all([
      appointmentsCollection.countDocuments({ customerId: user.id }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "pending",
      }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "confirmed",
      }),
      appointmentsCollection.countDocuments({
        customerId: user.id,
        status: "cancelled",
      }),
    ]);

    sendSuccess(
      res,
      { total, pending, confirmed, cancelled },
      "Customer metrics retrieved successfully"
    );
  } catch (error: any) {
    console.error("getCustomerStats error:", error);
    sendError(res, "Failed to load customer stats", 500);
  }
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const { name, image, phone } = req.body;

    const updates: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        sendError(res, "Name cannot be empty", 400);
        return;
      }
      updates.name = name.trim();
    }

    if (image !== undefined) {
      updates.image = image.trim();
    }

    if (phone !== undefined) {
      updates.phone = phone.trim();
    }

    // Strict Rule from PDF Page 18:
    // "Users must not be able to change their own role or blocked status through profile updates."
    // Any role or isBlocked fields passed in the body are strictly discarded!

    const usersCollection = getUsersCollection();
    const query = ObjectId.isValid(user.id)
      ? { _id: new ObjectId(user.id) }
      : { id: user.id };

    await usersCollection.updateOne(query, { $set: updates });

    const updatedUser = await usersCollection.findOne(query);

    sendSuccess(
      res,
      {
        id: updatedUser?._id?.toString() || user.id,
        name: updatedUser?.name,
        email: updatedUser?.email,
        role: updatedUser?.role || "customer",
        image: updatedUser?.image,
        phone: updatedUser?.phone,
        isBlocked: Boolean(updatedUser?.isBlocked),
      },
      "Profile updated successfully"
    );
  } catch (error: any) {
    console.error("updateProfile error:", error);
    sendError(res, "Failed to update profile", 500);
  }
}

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const usersCollection = getUsersCollection();
    const query = ObjectId.isValid(user.id)
      ? { _id: new ObjectId(user.id) }
      : { id: user.id };

    const userDoc = await usersCollection.findOne(query);

    sendSuccess(
      res,
      {
        id: userDoc?._id?.toString() || user.id,
        name: userDoc?.name || user.name,
        email: userDoc?.email || user.email,
        role: userDoc?.role || user.role,
        image: userDoc?.image,
        phone: userDoc?.phone,
        isBlocked: Boolean(userDoc?.isBlocked),
      },
      "Profile retrieved successfully"
    );
  } catch (error: any) {
    console.error("getProfile error:", error);
    sendError(res, "Failed to retrieve profile", 500);
  }
}
