import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export default class Badge {
  @Field((_type) => Int, { description: "The bit that represents the badge" })
  bit!: number;

  @Field((_type) => Int, { description: "The position of the set bit" })
  bitPosition!: number;

  @Field({ description: "The badge name" })
  name!: string;

  @Field({ description: "The badge icon" })
  icon!: string;

  @Field({ description: "The badge description" })
  description!: string;

  @Field({ description: "The date time when the badge was created" })
  createdAt!: Date;
}
