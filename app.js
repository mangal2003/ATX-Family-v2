require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const connectDB = require("./config/db");
const cron = require("node-cron");
const webpush = require("web-push");
const http = require("http");
const { Server } = require("socket.io");

// Models & Services
const User = require("./models/User");
const SiteSetting = require("./models/SiteSetting");
const { checkAndEndAuctions } = require("./services/auctionService");
const initCronJobs = require("./config/cron");
const initWeeklyResetJob = require("./jobs/weeklyReset");

// Routers
const adminRoutes = require("./routes/admin");
const adminTeamRouter = require("./routes/adminTeam");
const winnerRoutes = require("./routes/winners");
const quizRoutes = require("./routes/quiz");
const xpRoutes = require("./routes/xp");
const auctionRoutes = require("./routes/auction");
const contactRoutes = require("./routes/contact");
const musicRouter = require("./routes/music");
const xplRouter = require("./routes/xpl"); // <--- XPL Router Included
const updateStreakOnVisit = require("./middleware/streak");

// Sockets
const initMusicSocket = require("./sockets/musicSocket");
const initXplAuctionSocket = require("./sockets/xplAuctionSocket"); // <--- XPL Socket Included

// Initialize Express & HTTP Server
const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Initialize Background Jobs
initWeeklyResetJob();

// Database Connection
connectDB();

// Passport Config
require("./config/passport")(passport);

// Service Worker Route
app.get("/sw.js", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "sw.js"));
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Template Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session Storage
app.use(
  session({
    secret: process.env.SESSION_SECRET || "atx_secret",
    resave: false,
    saveUninitialized: false,
    store: (MongoStore.default || MongoStore).create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 },
  }),
);

initCronJobs();

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(updateStreakOnVisit);

// Global Template Locals
app.use(async (req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.theme = req.session
    ? req.session.theme || "cyber-dark"
    : "cyber-dark";
  const currentUser = req.user || (req.session && req.session.user) || null;

  res.locals.user = currentUser;

  res.locals.isAdmin = req.isAuthenticated
    ? req.isAuthenticated() && currentUser?.role === "admin"
    : currentUser?.role === "admin";

  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");

  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = await SiteSetting.create({});
    }
    res.locals.siteSettings = settings;
  } catch (err) {
    res.locals.siteSettings = {
      totalPrizeSponsored: 0,
      discordServerLink: "",
    };
  }
  next();
});

// --- Web Push Notification Trigger (Every Even Hour IST at 00 mins) ---
cron.schedule(
  "0 0,2,4,6,8,10,12,14,16,18,20,22 * * *",
  async () => {
    console.log(
      "[CRON] Broadcasting Web Push for Quiz Activation (Even Hour IST)...",
    );

    try {
      const usersWithPush = await User.find({
        "pushSubscription.endpoint": { $exists: true, $ne: null, $ne: "" },
      });

      if (!usersWithPush || usersWithPush.length === 0) {
        console.log("[CRON] No active push subscribers found.");
        return;
      }

      const payload = JSON.stringify({
        title: "ATX Quiz is NOW LIVE!",
        body: "The quiz window is open for 30 minutes. Log in to rank up!",
        icon: "/images/atx-logo.png",
      });

      const notifications = usersWithPush.map((user) => {
        // Defensive check
        if (!user.pushSubscription || !user.pushSubscription.endpoint) {
          return User.findByIdAndUpdate(user._id, {
            $set: { pushSubscription: null },
          });
        }

        return webpush
          .sendNotification(user.pushSubscription, payload)
          .catch(async (err) => {
            // Remove invalid / expired subscriptions (410 Gone / 404 Not Found)
            if (err.statusCode === 410 || err.statusCode === 404) {
              await User.findByIdAndUpdate(user._id, {
                $set: { pushSubscription: null },
              });
            }
            console.error(`[PUSH ERROR] ${user.username}:`, err.message);
          });
      });

      await Promise.allSettled(notifications);
    } catch (err) {
      console.error(
        "[CRON ERROR] Failed to broadcast push notifications:",
        err,
      );
    }
  },
  {
    timezone: "Asia/Kolkata",
  },
);

// Check for ended auctions every 30 seconds
setInterval(() => {
  checkAndEndAuctions();
}, 30 * 1000);

// ======================
//    ROUTES MOUNTING
// ======================
app.use("/admin", adminRoutes);
app.use("/", require("./routes/index"));
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/legal"));
app.use("/", require("./routes/user"));
app.use("/", adminTeamRouter);
app.use("/features", require("./routes/features"));
app.use("/winners", winnerRoutes);
app.use("/quiz", quizRoutes);
app.use("/xp", xpRoutes);
app.use("/", contactRoutes);
app.use("/auction", auctionRoutes);
app.use("/music-room", musicRouter);
app.use("/xpl", xplRouter);
app.use("/", require("./routes/announcements"));

// --- 404 Catch-All Route ---
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Page Not Found | 404",
  });
});

// =========================================================
//       SOCKET NAMESPACES INITIALIZATION
// =========================================================
initMusicSocket(io);
initXplAuctionSocket(io);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
});
