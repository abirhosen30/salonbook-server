import express from "express";
import 'dotenv/config'
import cors from "cors";
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.MONGODB_URL);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const db = connectedClient.db("salonbook");
const usersCollection = db.collection("users");
const servicesCollection = db.collection("services");


app.get("/", (req, res) => {
  res.send("Welcome to the SalonBook API!");
});

app.get("/users", async (req, res) => {
  const users = await usersCollection.find({}).toArray();
  res.json(users);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});