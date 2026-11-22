import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getServicesCollection,
  getUsersCollection,
  getTransactionsCollection,
} from "../config/database.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  try {
    const usersCollection = getUsersCollection();
    const servicesCollection = getServicesCollection();
    const appointmentsCollection = getAppointmentsCollection();
    const transactionsCollection = getTransactionsCollection();

    const [
      totalRegisteredCustomers,
      totalActiveServices,
      totalAppointmentRequests,
      pendingAppointments,
      confirmedAppointments,
      cancelledAppointments,
      paidTransactions,
    ] = await Promise.all([
      usersCollection.countDocuments({ role: "customer" }),
      servicesCollection.countDocuments({ status: "active" }),
      appointmentsCollection.countDocuments({}),
      appointmentsCollection.countDocuments({ status: "pending" }),
      appointmentsCollection.countDocuments({ status: "confirmed" }),
      appointmentsCollection.countDocuments({ status: "cancelled" }),
      transactionsCollection.find({ status: "paid" }).toArray(),
    ]);

    const totalRevenue = paidTransactions.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );

    sendSuccess(
      res,
      {
        totalRegisteredCustomers,
        totalActiveServices,
        totalAppointmentRequests,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        totalSuccessfulPayments: paidTransactions.length,
        totalRevenue,
      },
      "Admin stats retrieved successfully"
    );
  } catch (error: any) {
    console.error("getAdminStats error:", error);
    sendError(res, "Failed to calculate admin metrics", 500);
  }
}

export async function getAllAppointments(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const appointmentsCollection = getAppointmentsCollection();
    const { status, date } = req.query;

    const query: any = {};
    if (status && status !== "all") {
      query.status = status;
    }
    if (date) {
      query.appointmentDate = date;
    }

    const appointments = await appointmentsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const formatted = appointments.map((a) => ({
      ...a,
      _id: a._id?.toString(),
    }));

    sendSuccess(res, formatted, "All appointments retrieved successfully");
  } catch (error: any) {
    console.error("getAllAppointments error:", error);
    sendError(res, "Failed to retrieve appointments", 500);
  }
}

export async function updateAppointmentStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !["pending", "confirmed", "cancelled"].includes(status)) {
      sendError(
        res,
        "Valid status is required: 'pending', 'confirmed', or 'cancelled'",
        400
      );
      return;
    }

    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const appointment = await appointmentsCollection.findOne(query);
    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }

    // Strict Rule from PDF Page 15:
    // "Rules: Only pending appointments can be confirmed."
    if (status === "confirmed" && appointment.status !== "pending") {
      sendError(
        res,
        `Only pending appointments can be confirmed. Current status is ${appointment.status}.`,
        400
      );
      return;
    }

    await appointmentsCollection.updateOne(query, {
      $set: {
        status,
        updatedAt: new Date().toISOString(),
      },
    });

    const updated = await appointmentsCollection.findOne(query);

    sendSuccess(
      res,
      { ...updated, _id: updated?._id?.toString() },
      `Appointment status updated to ${status}`
    );
  } catch (error: any) {
    console.error("updateAppointmentStatus error:", error);
    sendError(res, "Failed to update appointment status", 500);
  }
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const usersCollection = getUsersCollection();
    const users = await usersCollection.find({}).sort({ createdAt: -1 }).toArray();

    const formatted = users.map((u) => ({
      id: u._id?.toString() || (u as any).id,
      name: u.name,
      email: u.email,
      role: u.role || "customer",
      isBlocked: Boolean(u.isBlocked),
      image: u.image,
      phone: u.phone,
      createdAt: u.createdAt,
    }));

    sendSuccess(res, formatted, "Users list retrieved successfully");
  } catch (error: any) {
    console.error("getUsers error:", error);
    sendError(res, "Failed to retrieve users", 500);
  }
}

export async function toggleUserBlockStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = req.params.id as string;
    const { isBlocked } = req.body;

    if (isBlocked === undefined) {
      sendError(res, "isBlocked boolean field is required", 400);
      return;
    }

    const usersCollection = getUsersCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id: id };

    const user = await usersCollection.findOne(query);
    if (!user) {
      sendError(res, "User not found", 404);
      return;
    }

    // Prevent blocking admin accounts
    if (user.role === "admin") {
      sendError(res, "Cannot block an administrator account.", 400);
      return;
    }

    await usersCollection.updateOne(query, {
      $set: {
        isBlocked: Boolean(isBlocked),
        updatedAt: new Date(),
      },
    });

    sendSuccess(
      res,
      { id, isBlocked: Boolean(isBlocked) },
      `User ${isBlocked ? "blocked" : "unblocked"} successfully`
    );
  } catch (error: any) {
    console.error("toggleUserBlockStatus error:", error);
    sendError(res, "Failed to update user block status", 500);
  }
}

export async function getTransactions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const transactionsCollection = getTransactionsCollection();
    const transactions = await transactionsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const formatted = transactions.map((t) => ({
      ...t,
      _id: t._id?.toString(),
    }));

    sendSuccess(res, formatted, "Transactions retrieved successfully");
  } catch (error: any) {
    console.error("getTransactions error:", error);
    sendError(res, "Failed to retrieve transactions", 500);
  }
}
