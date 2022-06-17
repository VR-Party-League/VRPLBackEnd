import { Field, ObjectType } from "type-graphql";

@ObjectType()
export default class SiteSettings {
  @Field({ description: "The setting's key" })
  key!: string;

  @Field({ description: "The settings value (as a string)" })
  value!: string;

  @Field({
    description:
      "The real type of the setting (everything is converted to string to transfer it over graphql). Think of this as 'string' 'number' etc.",
  })
  type!: string;

  @Field({
    description:
      "You need all of these perms to edit the setting (defaults to disallowing)",
    nullable: true,
  })
  editPerms: Number;

  @Field({
    description:
      "If anyone has one of the permissions in this bitfield they are able to view it (defaults to allowing)",
    nullable: true,
  })
  viewPerms: Number;
}
