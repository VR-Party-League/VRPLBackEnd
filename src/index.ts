import dotenv from "dotenv";

dotenv.config({});

import "reflect-metadata";
// MongoDb
import "./utils/servers/createMongoConnection";
import { VrplPlayer } from "./db/models/vrplPlayer";

// Graphql/Express
import server from "./utils/servers/httpServer";
import app from "./utils/servers/expresServer";
import io from "./utils/servers/socketIoServer";

//Sentry
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

// Other stuff

import { json, urlencoded } from "body-parser";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";

// Authentication
import { Authenticate } from "./utils/authentication/jwt";

// Routes
import router from "./routes";

// Websocket stuff
import { createApolloServer } from "./utils/servers/createApolloServer";

// import fs from "fs";
// import https from "https";
// const key = fs.readFileSync(
//   "/home/fish/code/cert/CA/localhost/localhost.decrypted.key"
// );
// const cert = fs.readFileSync("/home/fish/code/cert/CA/localhost/localhost.crt");

const PORT = process.env.PORT || 3001;
export const frontEndUrl = process.env.FRONT_END || "http://localhost:3000";
if (process.env.NODE_ENV === "production" && !process.env.FRONT_END)
  throw new Error("FRONT_END is not set");
export const frontEndDomain = new URL(frontEndUrl).hostname;

declare global {
  namespace Express {
    export interface Request {
      user: VrplPlayer | undefined;
    }
  }
}

export interface Context {
  user?: VrplPlayer;
}

async function bootstrap() {
  // Setup GraphQl
  const apolloServer = await createApolloServer();
  await apolloServer.start();

  // Setup sentry
  Sentry.init({
    environment: process.env.NODE_ENV || "dev",
    dsn: "https://9cbb37563c734339ab41f7c95c432abf@o501927.ingest.sentry.io/5932656",
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    beforeBreadcrumb(breadCrumb) {
      // Modify the event here
      // if (event.request?.method === "OPTIONS") return null;
      if (breadCrumb.message === "Authentication complete") return null;
      else if (breadCrumb.message === "Authenticating user") return null;
      // console.log("breadCrumb", breadCrumb);

      return breadCrumb;
    },
  });

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  app.set("trust proxy", 1);
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(cookieParser());
  const corsOptions: CorsOptions = {
    origin: frontEndUrl, // origin should be where the frontend code is hosted
    credentials: true,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "HEAD", "BREW"],
    maxAge: 3600,
  };
  app.use(cors(corsOptions));

  app.use(async function (req, res, next) {
    try {
      // req.headers["if-none-match"] = "no-match-for-this";
    } catch (err) {
      console.trace();
      console.error(err);
      Sentry.captureException(err);
    }
    next();
  });

  app.use(Authenticate);

  apolloServer.applyMiddleware({ app, cors: corsOptions });

  app.use(router);

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  io.listen(server);
  server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
  // const httpServer = https.createServer({ key, cert }, app);
  // httpServer.listen(PORT, () => {
  //   console.log(`Server is listening on https://localhost:${PORT}`);
  // });
}

bootstrap();
