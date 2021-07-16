import dotenv from "dotenv";
dotenv.config({});

import { ApolloServer } from "apollo-server-express";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import TeamResolver from "./resolvers/TeamResolver";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from "apollo-server-core";

const PORT = process.env.PORT || 3001;

import mongoose from "mongoose";
import { CustomError } from "./errors";
import { VrplPlayer } from "./db/models/vrplPlayer";
import express from "express";
import passport from "passport";
import { json, urlencoded } from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { getPlayerFromId } from "./db/player";
import connectMongodbSession from "connect-mongodb-session";
import path from "path";
import { getUserFromKey, newApiToken } from "./db/apiKeys";
import MatchResolver from "./resolvers/MatchResolver";
import TournamentResolver from "./resolvers/TournamentResolver";
import PlayerResolver from "./resolvers/PlayerResolver";

import { authChecker } from "./permissions";
import TeamPlayerResolver from "./resolvers/TeamPlayerResolver";
import RuleResolver from "./resolvers/RuleResolver";

declare global {
  namespace Express {
    interface User extends VrplPlayer {}
  }
}

async function bootstrap() {
  const MongoDBStore = connectMongodbSession(session);
  const store = new MongoDBStore({
    uri: process.env.DB_URI!,
    collection: "sessions",
  });

  const schema = await buildSchema({
    resolvers: [
      TournamentResolver,
      TeamResolver,
      MatchResolver,
      PlayerResolver,
      TeamPlayerResolver,
      RuleResolver,
    ],
    emitSchemaFile: true,
    dateScalarMode: "timestamp",
    authChecker: authChecker,
  });

  const server = new ApolloServer({
    schema: schema,
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
    formatError(err) {
      if (err.originalError) {
        const anyError: any = err.originalError;
        const error: CustomError = anyError;
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
      console.log(req.sessionID);
      const context = {
        user: req.user,
      };
      console.log(context);
      return context;
    },
  });
  await server.start();

  require("./strategies/discord");
  const app = express();
  app.set("trust proxy", 1);
  //app.set("views", path.join(__dirname, "views"));
  //app.set("view engine", "ejs");

  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(cors());
  app.use(cookieParser());
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      cookie: {
        maxAge: (1000 * 60 * 60 * 24 * 365) / 4, // 3 months
        //secure: app.get("env") === "production",
      },
      saveUninitialized: true,
      store: store,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(async function (req, res, next) {
    console.log("REQUEST!");
    //console.log(req.body);
    console.log(1, req.sessionID);

    try {
      res.header("Access-Control-Allow-Origin", "*");
      req.headers["if-none-match"] = "no-match-for-this";
    } catch (err) {
      console.trace();
      console.log(err);
    }
    try {
      if (req.headers["authorization"]) {
        if (req.headers["authorization"].length > 7) {
          const token = req.headers["authorization"].substr("Token".length);
          console.log(token);
          const ApiToken = await getUserFromKey(token.trim());
          console.log(ApiToken);
          if (ApiToken?.playerId) {
            req.user = (await getPlayerFromId(ApiToken?.playerId)) || undefined;
          }
        }
      }
    } catch (err) {
      console.trace();
      console.log(err);
    }
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

  server.applyMiddleware({ app });

  app.get("/api/auth/discord", passport.authenticate("discord"), (req, res) => {
    res.redirect(`http://vrplfront.fishman.live`);
  });

  app.get("/api/auth/token", async (req, res) => {
    if (!req.user) return res.status(401).send({ msg: "Unauthorized" });
    const user = req.user;
    const apiKey = await newApiToken(user);
    res.status(201).send(apiKey);
  });

  app.get("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.redirect("http://vrplfront.fishman.live");
    });
  });

  app.get("/api/auth", (req, res) => {
    if (req.user) {
      res.send(req.user);
    } else {
      res.status(401).send({ msg: "Unauthorized" });
    }
  });
  app.listen(PORT);
  console.log(`Server is running on http://localhost:${PORT}`);
}

mongoose.connect(process.env.DB_URI!, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

bootstrap();
