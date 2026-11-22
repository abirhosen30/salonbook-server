import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getServicesCollection } from "../config/database.js";
import { ServiceDocument } from "../types/index.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";

export async function getServices(req: Request, res: Response): Promise<void> {
  try {
    const servicesCollection = getServicesCollection();
    const { status, category, search, sort, limit } = req.query;

    const query: any = {};

    // 1. Status Filter (default active for public browsing unless admin requests all)
    if (status && status !== "all") {
      query.status = status;
    } else if (!status) {
      query.status = "active";
    }

    // 2. Category Filter
    if (category && category !== "All") {
      query.category = category;
    }

    // 3. Search by Service Name (Challenge Requirement 1)
    if (search && typeof search === "string" && search.trim() !== "") {
      query.serviceName = { $regex: search.trim(), $options: "i" };
    }

    // 4. Sorting by Price or Date (Challenge Requirement 3)
    let sortOptions: any = { createdAt: -1 };
    if (sort === "price-asc" || sort === "asc" || sort === "price_asc") {
      sortOptions = { price: 1 };
    } else if (sort === "price-desc" || sort === "desc" || sort === "price_desc") {
      sortOptions = { price: -1 };
    }

    let cursor = servicesCollection.find(query).sort(sortOptions);

    if (limit) {
      cursor = cursor.limit(parseInt(limit as string, 10));
    }

    const services = await cursor.toArray();

    // Transform _id to string for clean JSON serialization
    const formatted = services.map((s) => ({
      ...s,
      _id: s._id?.toString(),
    }));

    sendSuccess(res, formatted, "Services retrieved successfully");
  } catch (error: any) {
    console.error("getServices error:", error);
    sendError(res, "Failed to retrieve services", 500);
  }
}

export async function getServiceById(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      sendError(res, "Service ID is required", 400);
      return;
    }

    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const service = await servicesCollection.findOne(query);

    if (!service) {
      sendError(res, "Service not found", 404);
      return;
    }

    sendSuccess(
      res,
      { ...service, _id: service._id?.toString() },
      "Service details retrieved"
    );
  } catch (error: any) {
    console.error("getServiceById error:", error);
    sendError(res, "Failed to retrieve service details", 500);
  }
}

export async function createService(req: Request, res: Response): Promise<void> {
  try {
    const { serviceName, category, description, price, duration, image, status } =
      req.body;

    if (!serviceName || !category || !description || price === undefined || !duration) {
      sendError(
        res,
        "Missing required service fields: serviceName, category, description, price, duration",
        400
      );
      return;
    }

    const numPrice = Number(price);
    const numDuration = Number(duration);

    if (isNaN(numPrice) || numPrice <= 0) {
      sendError(res, "Price must be a positive number greater than 0", 400);
      return;
    }

    if (isNaN(numDuration) || numDuration <= 0) {
      sendError(res, "Duration must be a positive number of minutes", 400);
      return;
    }

    if (!image) {
      sendError(res, "Service image is required", 400);
      return;
    }

    const newService: ServiceDocument = {
      serviceName: serviceName.trim(),
      category: category.trim(),
      description: description.trim(),
      price: numPrice,
      duration: numDuration,
      image: image.trim(),
      status: status === "inactive" ? "inactive" : "active", // default active
      createdAt: new Date().toISOString(),
    };

    const servicesCollection = getServicesCollection();
    const result = await servicesCollection.insertOne(newService as any);

    sendSuccess(
      res,
      { ...newService, _id: result.insertedId.toString() },
      "Service created successfully",
      201
    );
  } catch (error: any) {
    console.error("createService error:", error);
    sendError(res, "Failed to create service", 500);
  }
}

export async function updateService(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { serviceName, category, description, price, duration, image, status } =
      req.body;

    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const existing = await servicesCollection.findOne(query);
    if (!existing) {
      sendError(res, "Service not found", 404);
      return;
    }

    const updates: Partial<ServiceDocument> = {
      updatedAt: new Date().toISOString(),
    };

    if (serviceName !== undefined) updates.serviceName = serviceName.trim();
    if (category !== undefined) updates.category = category.trim();
    if (description !== undefined) updates.description = description.trim();
    if (image !== undefined) updates.image = image.trim();
    if (status !== undefined) updates.status = status;

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        sendError(res, "Price must be a positive number", 400);
        return;
      }
      updates.price = numPrice;
    }

    if (duration !== undefined) {
      const numDuration = Number(duration);
      if (isNaN(numDuration) || numDuration <= 0) {
        sendError(res, "Duration must be a positive number", 400);
        return;
      }
      updates.duration = numDuration;
    }

    await servicesCollection.updateOne(query, { $set: updates });

    const updated = await servicesCollection.findOne(query);

    sendSuccess(
      res,
      { ...updated, _id: updated?._id?.toString() },
      "Service updated successfully"
    );
  } catch (error: any) {
    console.error("updateService error:", error);
    sendError(res, "Failed to update service", 500);
  }
}

export async function deleteService(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const servicesCollection = getServicesCollection();
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };

    const result = await servicesCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      sendError(res, "Service not found", 404);
      return;
    }

    sendSuccess(res, { deletedId: id }, "Service deleted successfully");
  } catch (error: any) {
    console.error("deleteService error:", error);
    sendError(res, "Failed to delete service", 500);
  }
}
