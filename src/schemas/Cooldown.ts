import { Field, ObjectType } from "type-graphql";
import Player from "./Player";
import Team from "./Team";

@ObjectType()
export class PlayerCooldown {
  @Field({ description: "The cooldown identifier", nullable: false })
  id!: string;
  @Field({ description: "The cooldown type", nullable: false })
  type!: string;
  @Field({
    description: "The id of the player that owns the cooldown",
    nullable: false,
  })
  playerId!: string;
  @Field((_type) => Player, {
    description: "The player that owns the cooldown",
    nullable: false,
  })
  player!: Player;
  @Field({
    description: "Explanation about what this cooldown effects",
    nullable: true,
  })
  explanation?: string;
  @Field({ description: "When the cooldown was created", nullable: false })
  createdAt!: Date;
  @Field({ description: "When the cooldown will expire", nullable: false })
  expiresAt!: Date;
}

@ObjectType()
export class TeamCooldown {
  @Field({ description: "The cooldown identifier" })
  id!: string;
  @Field({ description: "The cooldown type" })
  type!: string;
  @Field({
    description: "The id of the team that owns the cooldown",
    nullable: false,
  })
  teamId!: string;
  @Field({
    description: "The id of the tournament the team plays in",
    nullable: false,
  })
  tournamentId!: string;

  @Field((_type) => Team, {
    description: "The team that owns the cooldown",
    nullable: false,
  })
  team!: Team;
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
