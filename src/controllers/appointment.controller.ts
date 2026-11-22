import { Response } from "express";
import { ObjectId } from "mongodb";
import {
  getAppointmentsCollection,
  getServicesCollection,
} from "../config/database.js";
import { AuthenticatedRequest, AppointmentDocument } from "../types/index.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export async function createAppointment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    // Rule: Admins cannot submit customer appointment requests (PDF Page 9)
    if (user.role === "admin") {
      sendError(
        res,
        "Admins cannot submit appointment requests. Please use a customer account.",
        403
      );
      return;
    }

    const { serviceId, appointmentDate, timeSlot, message } = req.body;

    if (!serviceId || !appointmentDate || !timeSlot) {
      sendError(
        res,
        "Missing required booking fields: serviceId, appointmentDate, timeSlot",
        400
      );
      return;
    }

    // 1. Validate service exists & is active (PDF Page 17)
    const servicesCollection = getServicesCollection();
    const serviceQuery = ObjectId.isValid(serviceId)
      ? { _id: new ObjectId(serviceId) }
      : { _id: serviceId as any };

    const service = await servicesCollection.findOne(serviceQuery);
    if (!service) {
      sendError(res, "Selected salon service not found", 404);
      return;
    }

    if (service.status !== "active") {
      sendError(
        res,
        "This service is currently inactive and unavailable for booking.",
        400
      );
      return;
    }

    // 2. Validate date is not in the past
    const todayStr = new Date().toISOString().split("T")[0];
    if (appointmentDate < todayStr) {
      sendError(res, "Cannot book an appointment for a past date.", 400);
      return;
    }

    // 3. Prevent duplicate active appointments for same date and timeSlot (PDF Page 17)
    const appointmentsCollection = getAppointmentsCollection();
    const existingSlot = await appointmentsCollection.findOne({
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
      status: { $ne: "cancelled" },
    });

    if (existingSlot) {
      sendError(
        res,
        "This appointment slot is already booked. Please select another time or date.",
        409
      );
      return;
    }

    const newAppointment: AppointmentDocument = {
      serviceId: service._id ? service._id.toString() : serviceId,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      serviceName: service.serviceName,
      serviceImage: service.image,
      category: service.category,
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
      message: message ? message.trim() : "",
      servicePrice: service.price, // Authoritative server-side price
      status: "pending", // Default: Pending
      paymentStatus: "unpaid", // Default: Unpaid
      createdAt: new Date().toISOString(),
    };

    const result = await appointmentsCollection.insertOne(newAppointment as any);

    sendSuccess(
      res,
      { ...newAppointment, _id: result.insertedId.toString() },
      "Appointment request submitted successfully.",
      201
    );
  } catch (error: any) {
    console.error("createAppointment error:", error);
    sendError(res, "Failed to submit appointment request.", 500);
  }
}

export async function getMyAppointments(
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
    const appointments = await appointmentsCollection
      .find({ customerId: user.id })
      .sort({ createdAt: -1 })
      .toArray();

    const formatted = appointments.map((a) => ({
      ...a,
      _id: a._id?.toString(),
    }));

    sendSuccess(res, formatted, "Customer appointments retrieved successfully.");
  } catch (error: any) {
    console.error("getMyAppointments error:", error);
    sendError(res, "Failed to retrieve your appointments.", 500);
  }
}

export async function cancelAppointment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const id = req.params.id as string;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const appointment = await appointmentsCollection.findOne(query);

    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }

    // Rules from PDF Page 12 & 17:
    // "Customers can only view and manage their own appointments"
    if (user.role !== "admin" && appointment.customerId !== user.id) {
      sendError(res, "Forbidden: You can only cancel your own appointments.", 403);
      return;
    }

    // "A customer can cancel only their own pending appointment requests"
    // "Customers cannot cancel an already confirmed or cancelled appointment"
    if (user.role !== "admin") {
      if (appointment.status === "confirmed") {
        sendError(
          res,
          "Confirmed appointments cannot be cancelled by the customer. Please contact salon staff.",
          400
        );
        return;
      }

      if (appointment.status === "cancelled") {
        sendError(res, "Appointment is already cancelled.", 400);
        return;
      }
    }

    await appointmentsCollection.updateOne(query, {
      $set: {
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      },
    });

    sendSuccess(res, { id, status: "cancelled" }, "Appointment cancelled successfully.");
  } catch (error: any) {
    console.error("cancelAppointment error:", error);
    sendError(res, "Failed to cancel appointment.", 500);
  }
}

export async function getAppointmentById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const user = req.user;
    const id = req.params.id as string;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    const appointmentsCollection = getAppointmentsCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const appointment = await appointmentsCollection.findOne(query);

    if (!appointment) {
      sendError(res, "Appointment not found", 404);
      return;
    }

    if (user.role !== "admin" && appointment.customerId !== user.id) {
      sendError(res, "Forbidden: Access denied to this appointment", 403);
      return;
    }

    sendSuccess(
      res,
      { ...appointment, _id: appointment._id?.toString() },
      "Appointment details retrieved"
    );
  } catch (error: any) {
    console.error("getAppointmentById error:", error);
    sendError(res, "Failed to retrieve appointment", 500);
  }
}
