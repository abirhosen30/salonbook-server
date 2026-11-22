const LOCAL_URL = "http://localhost:5000/api/v1";
const VERCEL_URL = "https://salonbook-server-five.vercel.app/api/v1";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  target: "LOCAL" | "VERCEL";
  details: string;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  target: "LOCAL" | "VERCEL",
  url: string,
  options: RequestInit,
  validator: (res: Response, data: any) => boolean,
  expectedSummary: string
) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    const passed = validator(res, data);
    results.push({
      name,
      status: passed ? "PASS" : "FAIL",
      target,
      details: passed ? expectedSummary : `Unexpected status ${res.status}: ${JSON.stringify(data).slice(0, 150)}`,
    });
  } catch (err: any) {
    results.push({
      name,
      status: "FAIL",
      target,
      details: `Network/Fetch error: ${err.message}`,
    });
  }
}

async function runAllTests() {
  console.log("=================================================");
  console.log("🔍 SalonBook A-to-Z End-to-End System Audit");
  console.log("=================================================\n");

  const targets: ("LOCAL" | "VERCEL")[] = ["LOCAL", "VERCEL"];

  for (const t of targets) {
    const baseUrl = t === "LOCAL" ? LOCAL_URL : VERCEL_URL;
    console.log(`--- Testing ${t} Backend (${baseUrl}) ---`);

    // 1. Health check
    await testEndpoint(
      "Health Check Endpoint",
      t,
      `${baseUrl}/health`,
      { method: "GET" },
      (res, data) => res.status === 200 && data.status === "healthy",
      "Returned 200 OK with healthy status"
    );

    // 2. Services list
    let firstServiceId = "";
    let sampleCategory = "";
    await testEndpoint(
      "Services List (Active Services)",
      t,
      `${baseUrl}/services`,
      { method: "GET" },
      (res, data) => {
        if (res.status === 200 && Array.isArray(data.data) && data.data.length > 0) {
          firstServiceId = data.data[0]._id;
          sampleCategory = data.data[0].category;
          return true;
        }
        return false;
      },
      "Returned active services array from MongoDB Atlas"
    );

    // 3. Search filter
    await testEndpoint(
      "Services Search Filter (?search=Hair)",
      t,
      `${baseUrl}/services?search=Hair`,
      { method: "GET" },
      (res, data) => res.status === 200 && Array.isArray(data.data) && data.data.length > 0,
      "Correctly filtered services by keyword"
    );

    // 4. Category filter
    const catToTest = sampleCategory || "Hair Styling";
    await testEndpoint(
      `Services Category Filter (?category=${catToTest})`,
      t,
      `${baseUrl}/services?category=${encodeURIComponent(catToTest)}`,
      { method: "GET" },
      (res, data) => res.status === 200 && Array.isArray(data.data) && data.data.length > 0,
      `Filtered services by active category (${catToTest})`
    );

    // 5. Price sorting ascending
    await testEndpoint(
      "Services Price Sorting (?sort=price-asc)",
      t,
      `${baseUrl}/services?sort=price-asc`,
      { method: "GET" },
      (res, data) => {
        if (res.status !== 200 || !Array.isArray(data.data) || data.data.length < 2) return false;
        return data.data[0].price <= data.data[1].price;
      },
      "Prices ordered in ascending sequence"
    );

    // 6. Price sorting descending
    await testEndpoint(
      "Services Price Sorting (?sort=price-desc)",
      t,
      `${baseUrl}/services?sort=price-desc`,
      { method: "GET" },
      (res, data) => {
        if (res.status !== 200 || !Array.isArray(data.data) || data.data.length < 2) return false;
        return data.data[0].price >= data.data[1].price;
      },
      "Prices ordered in descending sequence"
    );

    // 7. Service details by ID
    if (firstServiceId) {
      await testEndpoint(
        `Service Details by ID (${firstServiceId})`,
        t,
        `${baseUrl}/services/${firstServiceId}`,
        { method: "GET" },
        (res, data) => res.status === 200 && data.data && data.data._id === firstServiceId,
        "Retrieved complete service details record"
      );
    }

    // 8. Service details invalid ID -> 404
    await testEndpoint(
      "Service Details with Invalid ID (404 check)",
      t,
      `${baseUrl}/services/64f1a2b3c4d5e6f7a8b9c0d1`,
      { method: "GET" },
      (res) => res.status === 404,
      "Correctly returned 404 Not Found"
    );

    // 9. Unauthenticated appointment creation guard -> 401
    await testEndpoint(
      "Security Guard: Appointment Booking without Token",
      t,
      `${baseUrl}/appointments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: firstServiceId }),
      },
      (res) => res.status === 401,
      "Rejected with 401 Unauthorized"
    );

    // 10. Unauthenticated customer appointments guard -> 401
    await testEndpoint(
      "Security Guard: Customer Appointments without Token",
      t,
      `${baseUrl}/appointments/my`,
      { method: "GET" },
      (res) => res.status === 401,
      "Rejected with 401 Unauthorized"
    );

    // 11. Unauthenticated admin dashboard stats guard -> 401
    await testEndpoint(
      "Security Guard: Admin Stats without Admin Token",
      t,
      `${baseUrl}/admin/dashboard/stats`,
      { method: "GET" },
      (res) => res.status === 401,
      "Rejected with 401 Unauthorized"
    );

    // 12. Unauthenticated admin users list guard -> 401
    await testEndpoint(
      "Security Guard: Admin Users Management without Token",
      t,
      `${baseUrl}/admin/users`,
      { method: "GET" },
      (res) => res.status === 401,
      "Rejected with 401 Unauthorized"
    );

    // 13. Unauthenticated admin transactions guard -> 401
    await testEndpoint(
      "Security Guard: Admin Transactions Ledger without Token",
      t,
      `${baseUrl}/admin/transactions`,
      { method: "GET" },
      (res) => res.status === 401,
      "Rejected with 401 Unauthorized"
    );

    // 14. Stripe Webhook signature validation -> 400
    await testEndpoint(
      "Security Guard: Stripe Webhook without Signature Header",
      t,
      `${baseUrl}/payments/webhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      },
      (res) => res.status === 400,
      "Rejected with 400 Bad Request on missing signature"
    );

    // 15. Image Upload without file -> 400
    await testEndpoint(
      "Upload Guard: Image Upload Endpoint without File",
      t,
      `${baseUrl}/uploads/image`,
      { method: "POST" },
      (res) => res.status === 400,
      "Rejected with 400 Bad Request on missing file"
    );
  }

  // Print Summary Table
  console.log("\n=================================================");
  console.log("📊 AUDIT TEST RESULTS SUMMARY");
  console.log("=================================================");
  let passCount = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : "❌";
    if (r.status === "PASS") passCount++;
    console.log(`${icon} [${r.target.padEnd(6)}] ${r.name.padEnd(52)}: ${r.details}`);
  }

  console.log("\n=================================================");
  console.log(`TOTAL AUDIT CHECKS: ${results.length}`);
  console.log(`PASSED: ${passCount} / ${results.length} (${Math.round((passCount / results.length) * 100)}%)`);
  console.log("=================================================\n");
}

runAllTests();
