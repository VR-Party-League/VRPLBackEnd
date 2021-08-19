import dotenv from "dotenv";
dotenv.config({});

const PORT = process.env.PORT || 3001;
export const frontEndUrl = "https://vrplfrontend.herokuapp.com";

// Graphql/Express
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { buildSchema } from "type-graphql";
import { CustomError } from "./errors";
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

// Other stuff
import mongoose from "mongoose";
import { json, urlencoded } from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";

// Resolvers
import MatchResolver from "./resolvers/MatchResolver";
import TournamentResolver from "./resolvers/TournamentResolver";
import PlayerResolver from "./resolvers/PlayerResolver";
import TeamPlayerResolver from "./resolvers/TeamPlayerResolver";
import RuleResolver from "./resolvers/RuleResolver";
import GameResolver from "./resolvers/GameResolver";
import TeamResolver from "./resolvers/TeamResolver";

// Authentication
import { Authenticate } from "./authentication/jwt";
import { authChecker } from "./permissions";

// Routes
import router from "./routes";

async function bootstrap() {
  const schema = await buildSchema({
    resolvers: [
      TournamentResolver,
      TeamResolver,
      MatchResolver,
      PlayerResolver,
      TeamPlayerResolver,
      RuleResolver,
      GameResolver,
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

      console.log("Context:", context);
      return context;
    },
  });
  await server.start();

  const app = express();
  app.set("trust proxy", 1);
  //app.set("views", path.join(__dirname, "views"));
  //app.set("view engine", "ejs");

  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.use(cors());
  app.use(cookieParser());

  app.use(async function (req, res, next) {
    console.log("REQUEST!");
    //console.log(req.body);
    try {
      res.header("Access-Control-Allow-Origin", "*");
      req.headers["if-none-match"] = "no-match-for-this";
    } catch (err) {
      console.trace();
      console.log(err);
    }
    next();
  });
  app.use(Authenticate);
  app.use(router);

  server.applyMiddleware({ app });

  app.listen(PORT);
  console.log(`Server is running on http://localhost:${PORT}`);
}

mongoose.connect(process.env.DB_URI!, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

bootstrap();
