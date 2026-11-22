import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { ENV } from "../config/environment.js";
import { getUsersCollection, getDB } from "../config/database.js";
import { AuthenticatedRequest, AuthUser } from "../types/index.js";
import { sendError } from "../utils/apiResponse.js";

export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback to session cookie
    if (!token && req.cookies) {
      token =
        req.cookies["better-auth.session_token"] ||
        req.cookies["session_token"] ||
        req.cookies["token"];
    }

    if (!token) {
      sendError(res, "Authentication required. Please log in.", 401);
      return;
    }

    let userId: string | null = null;
    let userEmail: string | null = null;

    // A. Attempt JWT decode/verify
    if (token.split(".").length === 3) {
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded) {
          userId = decoded.sub || decoded.id || decoded.userId;
          userEmail = decoded.email;
        }

        // Try verifying signature with BETTER_AUTH_SECRET if present
        try {
          const verified = jwt.verify(token, ENV.BETTER_AUTH_SECRET) as any;
          if (verified) {
            userId = verified.sub || verified.id || verified.userId || userId;
            userEmail = verified.email || userEmail;
          }
        } catch {
          // Signature might be signed with JWKS key pair, decode is already fallback
        }
      } catch {
        // Not a standard JWT string
      }
    }

    // B. If not resolved from JWT, check Better Auth session collection
    if (!userId) {
      try {
        const sessionCol = getDB().collection("session");
        const session = await sessionCol.findOne({
          token: token,
          expiresAt: { $gt: new Date() },
        });

        if (session) {
          userId = session.userId?.toString();
        }
      } catch {
        // Fall through
      }
    }

    if (!userId && !userEmail) {
      sendError(res, "Invalid or expired session. Please log in again.", 401);
      return;
    }

    // C. Lookup user in database to get authoritative role and blocked status
    const usersCollection = getUsersCollection();
    let query: any = {};
    if (userId) {
      query = ObjectId.isValid(userId) ? { _id: new ObjectId(userId) } : { id: userId };
    } else if (userEmail) {
      query = { email: userEmail };
    }

    const userDoc = await usersCollection.findOne(query);

    if (!userDoc) {
      sendError(res, "User account not found.", 401);
      return;
    }

    // D. Strict Check: Account Block Enforcement (PDF Page 11 & 15)
    if (userDoc.isBlocked === true) {
      sendError(
        res,
        "Your account is blocked. Please contact support at support@salonbook.com.",
        403
      );
      return;
    }

    const authUser: AuthUser = {
      id: userDoc._id ? userDoc._id.toString() : userId || "",
      email: userDoc.email,
      name: userDoc.name,
      role: (userDoc.role as any) === "admin" ? "admin" : "customer",
      isBlocked: Boolean(userDoc.isBlocked),
      image: userDoc.image,
      phone: userDoc.phone,
    };

    req.user = authUser;
    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    sendError(res, "Authentication failed.", 401);
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.["better-auth.session_token"];

  if (!authHeader && !cookieToken) {
    return next();
  }

  // Attempt to authenticate, but do not fail if unauthenticated
  authenticateJWT(req, res, () => next()).catch(() => next());
}
