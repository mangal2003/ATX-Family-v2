const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

router.post("/api/subscribe", ensureAuth, async (req, res) => {
  const subData = req.body; // Browser sends endpoint + keys
  try {
    await PushSubscription.findOneAndUpdate(
      { endpoint: subData.endpoint },
      {
        userId: req.user._id,
        keys: subData.keys,
        endpoint: subData.endpoint,
      },
      { upsert: true, new: true },
    );
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Subscription failed" });
  }
});
