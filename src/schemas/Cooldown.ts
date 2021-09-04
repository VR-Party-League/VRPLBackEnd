import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
export class PlayerCooldown {
  @Field({ description: "The cooldown identifier" })
  id!: string;
  @Field({ description: "The cooldown type" })
  type!: string;
  @Field({
    description: "Explanation about what this cooldown effects",
    nullable: true,
  })
  explanation?: string;
  @Field({ description: "When the cooldown was created" })
  createdAt!: Date;
  @Field({ description: "When the cooldown will expire" })
  expiresAt!: Date;
}
