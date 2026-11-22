async function testCustomerJourney() {
  console.log("=================================================");
  console.log("🚀 Testing Full Live Customer Journey (A to Z)");
  console.log("=================================================\n");

  const CLIENT_URL = "https://salonbook-client-henna.vercel.app";
  const SERVER_URL = "https://salonbook-server-five.vercel.app/api/v1";

  // Step 1: Customer visits the services catalog
  console.log("1. Visiting Services Catalog...");
  const sRes = await fetch(`${SERVER_URL}/services`);
  const sData = await sRes.json();
  if (!sData.success || !sData.data || sData.data.length === 0) {
    throw new Error("Failed to load services from backend!");
  }
  const selectedService = sData.data[0];
  console.log(`✅ Loaded ${sData.data.length} services!`);
  console.log(`   Selected: "${selectedService.serviceName}" ($${selectedService.price}) - ID: ${selectedService._id}`);

  // Step 2: Customer logs in
  console.log("\n2. Customer Signing In...");
  const loginRes = await fetch(`${CLIENT_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": CLIENT_URL,
    },
    body: JSON.stringify({
      email: "audit_test_1795363179485@example.com",
      password: "Password123",
    }),
  });
  const loginData = await loginRes.json();
  if (!loginData.user || !loginData.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }
  const sessionToken = loginData.token;
  const user = loginData.user;
  console.log(`✅ Logged in as: ${user.name} (${user.email})`);
  console.log(`   Session Token: ${sessionToken.slice(0, 10)}...`);

  // Step 3: Customer books an appointment
  console.log("\n3. Booking Appointment...");
  const tomorrow = new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];
  const bookRes = await fetch(`${SERVER_URL}/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      serviceId: selectedService._id,
      appointmentDate: tomorrow,
      timeSlot: "02:00 PM",
      message: "Looking forward to this luxury treatment!",
    }),
  });
  const bookData = await bookRes.json();
  if (!bookData.success || !bookData.data) {
    throw new Error(`Booking failed: ${JSON.stringify(bookData)}`);
  }
  const bookedAppointment = bookData.data;
  console.log(`✅ Appointment successfully booked!`);
  console.log(`   Appointment ID: ${bookedAppointment._id}`);
  console.log(`   Status: ${bookedAppointment.status} | Payment: ${bookedAppointment.paymentStatus}`);

  // Step 4: Customer views "My Appointments"
  console.log("\n4. Verifying Customer Appointments in Dashboard...");
  const myAppRes = await fetch(`${SERVER_URL}/appointments/my`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
    },
  });
  const myAppData = await myAppRes.json();
  if (!myAppData.success || !Array.isArray(myAppData.data)) {
    throw new Error(`Failed to retrieve customer appointments: ${JSON.stringify(myAppData)}`);
  }
  console.log(`✅ Customer Dashboard retrieved ${myAppData.data.length} appointment(s)!`);

  // Step 5: Customer cancels the pending appointment
  console.log("\n5. Customer Cancelling Pending Appointment...");
  const cancelRes = await fetch(`${SERVER_URL}/appointments/${bookedAppointment._id}/cancel`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${sessionToken}`,
    },
  });
  const cancelData = await cancelRes.json();
  if (!cancelData.success) {
    throw new Error(`Cancellation failed: ${JSON.stringify(cancelData)}`);
  }
  console.log(`✅ Appointment cancelled successfully: ${cancelData.message}`);

  console.log("\n=================================================");
  console.log("🎉 ALL CUSTOMER ACTIONS WORK FLAWLESSLY END-TO-END!");
  console.log("=================================================\n");
}

testCustomerJourney().catch(err => {
  console.error("❌ Customer Journey Error:", err);
  process.exit(1);
});
