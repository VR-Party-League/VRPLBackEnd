import { buildSchema } from "type-graphql";
import TournamentResolver from "../../resolvers/TournamentResolver";
import TeamResolver from "../../resolvers/TeamResolver";
import MatchResolver from "../../resolvers/MatchResolver";
import PlayerResolver from "../../resolvers/PlayerResolver";
import TeamPlayerResolver from "../../resolvers/TeamPlayerResolver";
import GameResolver from "../../resolvers/GameResolver";
import BadgeResolver from "../../resolvers/BadgeResolver";
import { PlayerCooldownResolver } from "../../resolvers/CooldownResolver";
import SiteSettingsResolver from "../../resolvers/SiteSettingsResolver";
import MessageButtonResolver from "../../resolvers/MessageButtonResolver";
import MessageResolver from "../../resolvers/MessageResolver";
import { authChecker } from "../permissions";
import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import { CustomError } from "../errors";
import { Context } from "../../index";

export async function createApolloServer() {
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
      SiteSettingsResolver,
      MessageButtonResolver,
      MessageResolver,
    ],
    emitSchemaFile: true,
    dateScalarMode: "timestamp",
    authChecker: authChecker,
  });

  const apolloServer = new ApolloServer({
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
  return apolloServer;
}
