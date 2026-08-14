const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/auth/google/callback",
        proxy: true,
      },

      async (accessToken, refreshToken, profile, done) => {
        const googlePhoto =
          profile.photos && profile.photos[0] ? profile.photos[0].value : "";

        try {
          let user = await User.findOne({ googleId: profile.id });

          if (user) {
            // ONLY update avatar if the user hasn't set a custom Cloudinary image
            if (
              !user.isCustomAvatar &&
              googlePhoto &&
              user.avatar !== googlePhoto
            ) {
              user.avatar = googlePhoto;
              await user.save();
            }
            return done(null, user);
          }

          // Handle new account creation
          user = await User.create({
            googleId: profile.id,
            username: profile.displayName,
            email:
              profile.emails && profile.emails[0]
                ? profile.emails[0].value
                : "",
            avatar: googlePhoto,
            isCustomAvatar: false,
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
