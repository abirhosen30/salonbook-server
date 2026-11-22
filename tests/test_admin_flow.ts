import { MongoClient } from "mongodb";

const MONGODB_URL = "mongodb://salonbook:XAFbgCavL2A3tJjJ@ac-2lk2kv1-shard-00-00.ryputl3.mongodb.net:27017,ac-2lk2kv1-shard-00-01.ryputl3.mongodb.net:27017,ac-2lk2kv1-shard-00-02.ryputl3.mongodb.net:27017/?ssl=true&replicaSet=atlas-tu51qr-shard-0&authSource=admin";
const SERVER_URL = "https://salonbook-server-five.vercel.app/api/v1";

async function testAdminFlow() {
  console.log("=================================================");
  console.log("🛠️ Testing Full Admin Service Management (A to Z)");
  console.log("=================================================\n");

  const client = new MongoClient(MONGODB_URL);
  await client.connect();
  const db = client.db("salonbook");

  // Find or promote an admin user for testing
  let adminUser = await db.collection("user").findOne({ role: "admin" });
  if (!adminUser) {
    console.log("Setting test user to admin...");
    await db.collection("user").updateOne(
      { email: "audit_test_1795363179485@example.com" },
      { $set: { role: "admin" } }
    );
    adminUser = await db.collection("user").findOne({ email: "audit_test_1795363179485@example.com" });
  }
  console.log(`✅ Admin identified: ${adminUser.name} (${adminUser.email})`);

  // Create an active session token for admin
  const token = "admin_test_session_" + Date.now();
  await db.collection("session").insertOne({
    token: token,
    userId: adminUser._id.toString(),
    expiresAt: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`✅ Admin session generated: ${token.slice(0, 15)}...`);

  // Step 1: Admin Adds a New Service
  console.log("\n1. Admin Adding New Salon Service...");
  const createRes = await fetch(`${SERVER_URL}/services`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      serviceName: "24K Gold Luxury Facial Glow",
      category: "Facial & Skincare",
      description: "Infused with pure 24-karat gold flakes and botanical collagen to restore elasticity and radiance.",
      price: 180,
      duration: 75,
      image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&auto=format&fit=crop&q=80",
      status: "active",
    }),
  });
  const createData = await createRes.json();
  if (!createData.success || !createData.data) {
    throw new Error(`Failed to create service: ${JSON.stringify(createData)}`);
  }
  const createdId = createData.data._id;
  console.log(`✅ Service created successfully!`);
  console.log(`   ID: ${createdId} | Name: "${createData.data.serviceName}" ($${createData.data.price})`);

  // Step 2: Admin Updates the Service
  console.log("\n2. Admin Updating Service Price...");
  const updateRes = await fetch(`${SERVER_URL}/services/${createdId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      price: 195,
      description: "Updated description: Signature 24K gold facial with extended neck and shoulder massage.",
    }),
  });
  const updateData = await updateRes.json();
  if (!updateData.success || updateData.data.price !== 195) {
    throw new Error(`Failed to update service: ${JSON.stringify(updateData)}`);
  }
  console.log(`✅ Service updated! New Price: $${updateData.data.price}`);

  // Step 3: Admin Deletes the Service
  console.log("\n3. Admin Deleting the Service...");
  const deleteRes = await fetch(`${SERVER_URL}/services/${createdId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const deleteData = await deleteRes.json();
  if (!deleteData.success) {
    throw new Error(`Failed to delete service: ${JSON.stringify(deleteData)}`);
  }
  console.log(`✅ Service deleted cleanly!`);

  // Reset user role back to customer
  await db.collection("user").updateOne(
    { email: "audit_test_1795363179485@example.com" },
    { $set: { role: "customer" } }
  );

  await client.close();
  console.log("\n=================================================");
  console.log("🎉 ALL ADMIN ACTIONS (ADD/EDIT/DELETE) WORK FLAWLESSLY!");
  console.log("=================================================\n");
}

testAdminFlow().catch(err => {
  console.error("❌ Admin Flow Error:", err);
  process.exit(1);
});
