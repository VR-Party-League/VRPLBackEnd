import MessageButton from "../schemas/MessageButton";
import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { vrplMessageButton } from "../db/models/vrplMessages";
import { Permissions } from "../utils/permissions";

@Resolver((_of) => MessageButton)
export default class {
  @Authorized([Permissions.Admin])
  @FieldResolver()
  action(@Root() messageButton: vrplMessageButton) {
    return JSON.stringify(messageButton.action);
  }
}
