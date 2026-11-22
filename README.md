# SalonBook — Dedicated Backend Server API

Dedicated Express.js and TypeScript REST API server for the **SalonBook** Salon Appointment Booking Platform.

## 📌 Project Overview
The SalonBook server is a secure, role-based backend providing persistent database management, JWT/session authentication, appointment lifecycle management, verified Stripe payment processing, and ImgBB image hosting integration.

## 🚀 Important Features
- **TypeScript & Express.js**: Modular architecture separating routes, controllers, services, middleware, and models.
- **Persistent MongoDB**: Collections for users (Better Auth), services, appointments, and transactions with automated index management.
- **JWT & Role-Based Authorization**: Route guards for customer and administrator privileges, with strict account suspension (blocked status) enforcement.
- **Service Catalog Management**: Filtering by category, full-text / regex search by service name, sorting by price, and admin CRUD operations.
- **Appointment Lifecycle**: Conflict-free booking engine preventing double-booking and past-date requests, customer cancellation rules, and admin approval workflows.
- **Verified Stripe Checkout**: Authoritative server-side price calculation and raw webhook event verification updating payment records idempotently.
- **ImgBB Image Uploads**: Multipart image uploading with MIME validation and file size restrictions.
- **Security Hardening**: Helmet security headers, CORS origin whitelisting, rate limiting, and safe error handling.

## 🛠️ Technology Stack
- **Runtime**: Node.js v24+
- **Framework**: Express.js v5
- **Language**: TypeScript
- **Database**: MongoDB (Atlas)
- **Payment Processing**: Stripe Node.js SDK
- **Image Hosting**: ImgBB REST API
- **Testing**: Node.js Native Test Runner with Supertest

## 📦 Installation Instructions

1. Navigate to the server directory:
```bash
cd salonbook-server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (see `.env.example`).

4. Build TypeScript:
```bash
npm run build
```

## ⚙️ How to Run Locally

### Development Mode (with hot-reload):
```bash
npm run dev
```

### Production Build & Run:
```bash
npm run build
npm start
```

### Run Automated Tests:
```bash
npm test
```

## 🔐 Required Environment Variables
Configure the following in your `.env` file (do not commit secrets to Git):
- `PORT` — Port number for Express server (default `5000`)
- `NODE_ENV` — `development` or `production`
- `CLIENT_ORIGIN` — Frontend client URL (e.g., `http://localhost:3000`)
- `MONGODB_URL` — MongoDB connection URI
- `BETTER_AUTH_SECRET` — Shared secret for authentication token verification
- `BETTER_AUTH_URL` — Frontend auth base URL
- `STRIPE_SECRET_KEY` — Stripe secret API key (`sk_test_...`)
- `STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (`pk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — Stripe signing secret for webhook verification (`whsec_...`)
- `IMGBB_API_KEY` — ImgBB API key for image hosting

## 🔗 Repository & Deployment Links
- **Server Repository**: https://github.com/abirhosen30/salonbook-server
- **Client Repository**: https://github.com/abirhosen30/salonbook-client
- **Live API Endpoint**: https://salonbook-server.vercel.app (or custom deployment domain)
