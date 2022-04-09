import express from "express";
import morgan from "morgan";

// @ts-ignore
morgan.token("body", (req, res) => JSON.stringify(req.body));

let time: undefined | number = undefined;
morgan.token("time", () => {
  if (!time) time = Date.now();
  return `${Date.now() - time}`;
});
const app = express();
// app.use(morgan("dev")); //":time :method :url :status :response-time ms - :body""
console.log("Created express app");

export default app;
