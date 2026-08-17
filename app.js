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
const PushSubscription = require("./models/PushSubscription");
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

webpush.setVapidDetails(
  "mailto:mangalthemars@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// Route 1: Serve Public Key to Frontend
app.get("/api/push/public-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Route 2: Save Subscription into MongoDB
app.post("/api/subscribe", async (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint || !sub.keys) {
      return res.status(400).json({ error: "Invalid subscription payload." });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        userId: req.user ? req.user._id : null,
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      },
      { upsert: true, new: true },
    );

    console.log(
      "[PUSH] Subscription saved to DB:",
      sub.endpoint.slice(0, 35) + "...",
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("[PUSH DB ERROR]:", err);
    res.status(500).json({ error: "Database save failure" });
  }
});

// Broadcast Quiz Alert (Runs every hour, triggers on even hours IST)
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    // Convert to IST (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const hours = istDate.getUTCHours();

    // Check if it's an even hour (e.g., 10 AM, 12 PM, 2 PM, 4 PM, etc.)
    if (hours % 2 !== 0) {
      return;
    }

    console.log(
      `[CRON] Broadcasting Web Push for Quiz Activation (${hours}:00 IST)...`,
    );

    const subscribers = await PushSubscription.find({});
    if (!subscribers || subscribers.length === 0) {
      console.log("[CRON] No active push subscribers found in database.");
      return;
    }

    const payload = JSON.stringify({
      title: "🧠 ATX Quiz Arena is LIVE!",
      body: "The 30-minute competition window is now open. Jump in and earn quiz points!",
      url: "/quiz",
    });

    const sendPromises = subscribers.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth,
            },
          },
          payload,
        );
      } catch (err) {
        // HTTP 410 (Gone) or 404 indicates the subscription expired or was revoked by the user
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[CRON] Purging expired push token: ${sub._id}`);
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.error(`[CRON] Push error for ${sub._id}:`, err.message);
        }
      }
    });

    await Promise.allSettled(sendPromises);
    console.log(
      `[CRON] Successfully dispatched alerts to ${subscribers.length} device(s).`,
    );
  } catch (err) {
    console.error("[CRON PUSH BROADCAST ERROR]:", err);
  }
});

const DROP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Scan every 2 minutes for ready EP drops
cron.schedule("*/2 * * * *", async () => {
  try {
    const oneHourAgo = new Date(Date.now() - DROP_INTERVAL_MS);

    // Find users whose cooldown finished and who haven't received an alert yet
    const eligibleUsers = await User.find({
      lastXpClaim: { $lte: oneHourAgo, $ne: null },
      epNotificationSent: { $ne: true },
    }).select("_id username");

    if (!eligibleUsers.length) return;

    const payload = JSON.stringify({
      title: "⚡ EP Drop Ready!",
      body: "Your hourly +100 EP reward is ready to collect. Jump in now!",
      url: "/",
    });

    for (const user of eligibleUsers) {
      const subscriptions = await PushSubscription.find({ userId: user._id });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
              },
            },
            payload,
          );
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        }
      }

      // Mark notification as dispatched for this claim window
      user.epNotificationSent = true;
      await user.save();
    }
  } catch (err) {
    console.error("[CRON EP NOTIFICATION ERROR]:", err);
  }
});

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
app.use("/vault", require("./routes/vault"));

app.get("/api/debug-subs", async (req, res) => {
  const count = await PushSubscription.countDocuments();
  const subs = await PushSubscription.find().select("userId endpoint");
  res.json({ count, subs });
});

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
