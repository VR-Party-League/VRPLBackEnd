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
// import { Authenticate } from "./utils/authentication/jwt";

// Routes
import router from "./routes";

// Websocket stuff
import { createApolloServer } from "./utils/servers/createApolloServer";
import { ObjectId } from "mongoose";
import { AllOAuthScopes, OAuthClient } from "./db/models/OAuthModels";
import { Permissions } from "./utils/permissions";
import { authenticate } from "./routes/api/oauth2";
import { VrplTeam } from "./db/models/vrplTeam";
import { VrplTournament } from "./db/models/vrplTournaments";
import express, { NextFunction } from "express";
import { CustomError } from "./utils/errors";
import { captureException } from "@sentry/node";

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
      auth?: VrplAuth;
    }
  }
}

export interface VrplAuth {
  userId: ObjectId;
  playerId?: string;
  permissions: number;
  scope?: AllOAuthScopes[];
  getPlayer: () => Promise<VrplPlayer>;
  hasPerm: (perm: Permissions) => boolean;
  assurePerm: (perm: Permissions) => void;
  client?: Pick<
    OAuthClient,
    "clientId" | "clientName" | "verified" | "createdAt" | "userId"
  >;
}

export interface Context {
  auth?: VrplAuth;
  resolved: {
    player?: VrplPlayer | null;
    team?: VrplTeam | null;
    tournament?: VrplTournament | null;
  };
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

  // app.use(Authenticate);
  app.use(authenticate);

  apolloServer.applyMiddleware({ app, cors: corsOptions });

  app.use(router);

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  app.use(errorHandler);
  io.listen(server);
  server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
  // const httpServer = https.createServer({ key, cert }, app);
  // httpServer.listen(PORT, () => {
  //   console.log(`Server is listening on https://localhost:${PORT}`);
  // });
}

const errorHandler = (
  err: Error,
  req: express.Request,
  res: express.Response,
  next: NextFunction
) => {
  if (err instanceof CustomError)
    return res.status(err.code).send({ message: `${err}` });
  captureException(err);
  res.status(500).send({
    message: "Something went wrong",
  });
};

bootstrap();
