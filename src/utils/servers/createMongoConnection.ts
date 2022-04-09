import mongoose from "mongoose";

if (!process.env.DB_URI) throw new Error("DB_URI not set");
mongoose
  .connect(process.env.DB_URI!, {
    maxPoolSize: 100,
    minPoolSize: 50,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    throw err;
  });
