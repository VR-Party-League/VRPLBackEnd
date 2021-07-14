import dotenv from "dotenv";
dotenv.config({});

import { ApolloServer } from "apollo-server";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import ProjectResolver from "./resolvers/TeamResolver";
import TaskResolver from "./resolvers/TaskResolver";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from "apollo-server-core";
const PORT = process.env.PORT || 4000;
import mongoose from "mongoose";

async function bootstrap() {
  const schema = await buildSchema({
    resolvers: [ProjectResolver, TaskResolver],
    emitSchemaFile: true,
  });

  const server = new ApolloServer({
    schema: schema,
    plugins: [
      process.env.NODE_ENV === "production"
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
    ],
  });
  const { url } = await server.listen(PORT);
  console.log(`Server is running on ${url}`);
}

mongoose.connect(process.env.DB_URI!, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

bootstrap();
