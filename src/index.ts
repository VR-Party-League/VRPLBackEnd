import dotenv from "dotenv";
dotenv.config({});

import "./utils/storage/player";

import "reflect-metadata";

const PORT = process.env.PORT || 3001;
export const frontEndUrl =
  process.env.NODE_ENV === "production"
    ? "https://vrpl-frontend.vercel.app"
    : "http://localhost:3000";
export const frontEndDomain =
  process.env.NODE_ENV === "production"
    ? "vrpl-frontend.vercel.app"
    : "localhost";

// Graphql/Express
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { buildSchema } from "type-graphql";
import { CustomError } from "./utils/errors";
import { VrplPlayer } from "./db/models/vrplPlayer";
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

// Sentry
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

// Other stuff
import mongoose from "mongoose";
import { json, urlencoded } from "body-parser";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";

// Resolvers
import MatchResolver from "./resolvers/MatchResolver";
import TournamentResolver from "./resolvers/TournamentResolver";
import PlayerResolver from "./resolvers/PlayerResolver";
import TeamPlayerResolver from "./resolvers/TeamPlayerResolver";
import GameResolver from "./resolvers/GameResolver";
import TeamResolver from "./resolvers/TeamResolver";

// Authentication
import { Authenticate } from "./utils/authentication/jwt";
import { authChecker } from "./utils/permissions";

// Routes
import router from "./routes";
import BadgeResolver from "./resolvers/BadgeResolver";
import { PlayerCooldownResolver } from "./resolvers/CooldownResolver";

async function bootstrap() {
  // Setup GraphQl
  const schema = await buildSchema({
    resolvers: [
      TournamentResolver,
      TeamResolver,
      MatchResolver,
      PlayerResolver,
      TeamPlayerResolver,
      GameResolver,
      BadgeResolver,
      PlayerCooldownResolver,
    ],
    emitSchemaFile: true,
    dateScalarMode: "timestamp",
    authChecker: authChecker,
  });

  const server = new ApolloServer({
    schema: schema,
    introspection: true,
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground(),
      // process.env.NODE_ENV === "production"
      //   ? ApolloServerPluginLandingPageDisabled()
      //   : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    formatError(err) {
      if (err.originalError instanceof CustomError) {
        const error: CustomError = err.originalError;
        return {
          message: error.message,
          code: error.code || 501, // <--
          locations: err.locations,
          path: err.path,
        };
      }
      return {
        message: err.message,
        code: 501, // <--
        locations: err.locations,
        path: err.path,
      };
    },
    context: ({ req, res }) => {
      const context: Context = {
        user: req.user,
      };
      return context;
    },
  });
  await server.start();

  const app = express();

  // Setup sentry
  Sentry.init({
    environment: process.env.NODE_ENV || "Dev",
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
    tracesSampleRate: 1.0,
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
  };
  app.use(cors(corsOptions));

  app.use(async function (req, res, next) {
    try {
      req.headers["if-none-match"] = "no-match-for-this";
    } catch (err) {
      console.trace();
      console.error(err);
      Sentry.captureException(err);
    }
    next();
  });
  app.use(Authenticate);
  server.applyMiddleware({ app, cors: corsOptions });

  app.use(router);

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler());

  app.listen(PORT);
  console.log(`Server is running on http://localhost:${PORT}`);
}

mongoose.connect(process.env.DB_URI!, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});
bootstrap();
