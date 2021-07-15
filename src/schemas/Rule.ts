import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class Rule {
  @Field()
  title: string;
  @Field()
  description?: string;
  @Field()
  body: string;
}
