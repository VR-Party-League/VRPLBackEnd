import User, { VrplPlayer } from "../db/models/vrplPlayer";
import passport from "passport";
import passportDiscord from "passport-discord";
import { getPlayerFromId, storePlayer } from "../db/player";
import { v4 as uuidv4 } from "uuid";

const DiscordStrategy = passportDiscord.Strategy;

passport.serializeUser((user: any, done) => {
  console.log(user);
  try {
    User.updateOne({ id: user.id }, user, { upsert: true }).then(() => {
      console.log("Serialized: " + user.id);
      done(undefined, user.id!);
    });
  } catch (err) {
    console.log(err);
    done(err, null);
  }
  //done(null, user.DiscordID!);
});

passport.deserializeUser(async (id: string, done) => {
  console.log("De-Serialized: " + id);
  try {
    const user = await getPlayerFromId(id);
    done(null, user);
  } catch (err) {
    console.log(err);
    done(err, null);
  }
});
const strategy = new DiscordStrategy(
  {
    clientID: process.env.CLIENT_ID!,
    clientSecret: process.env.CLIENT_SECRET!,
    callbackURL:
      process.env.NODE_ENV === "production"
        ? "http://vrplfront.fishman.live/api/auth/discord"
        : "http://localhost:3000/api/auth/discord",
    scope: ["identify"],
  },
  function (
    _accessToken: string,
    _refreshToken: string,
    profile: passportDiscord.Profile,
    done
  ) {
    const data: VrplPlayer = {
      id: uuidv4(),
      discordId: profile.id,
      discordTag: `${profile.username}#${profile.discriminator}`,
      discordAvatar: profile.avatar,
      permissions: 0,
    };
    console.log("HEY");

    User.updateOne({ discordId: data.discordId }, data, {
      upsert: true,
    }).then(() => {
      try {
        console.log("Used strategy");

        storePlayer(data);
        done(undefined, data);
      } catch (err) {
        console.trace();
        console.error(err);
        done(err, undefined);
      }
    });
  }
);
passport.use(strategy);
