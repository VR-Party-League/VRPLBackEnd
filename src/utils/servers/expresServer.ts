import express from "express";
import morgan from "morgan";

// morgan.token(
//   "body",
//   (
//     req,
//     res // @ts-ignore
//   ) => (typeof req?.body === "string" ? req.body : JSON.stringify(req.body))
// );

const app = express();
// const originalSend = app.response.send;
//
// //@ts-ignore
// app.response.send = function sendOverWrite(body) {
//   console.log("BODY", body);
//   originalSend.call(this, body);
//   //@ts-ignore
//   this.__custombody__ = body;
// };
//
// morgan.token("res-body", (_req, res) =>
//   //@ts-ignore
//   JSON.stringify(res.__custombody__)
// );
//
// app.use(morgan("dev")); //":time :method :url :status :response-time ms - :body""
// app.use(morgan(":method :url :status :response-time ms - :body\n:res-body"));
console.log("Created express app");

export default app;
