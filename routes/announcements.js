const express = require("express");
const router = express.Router();
const puppeteer = require("puppeteer");

/**
 * Converts Discord custom emoji codes (<:name:id> / <a:name:id>) into actual CDN image tags
 */
function replaceDiscordEmojis(text = "") {
  if (!text) return "";
  return text
    .replace(
      /<a:([a-zA-Z0-9_]+):(\d+)>/g,
      '<img class="discord-emoji" src="https://cdn.discordapp.com/emojis/$2.gif?size=64&quality=lossless" alt="$1">',
    )
    .replace(
      /<:([a-zA-Z0-9_]+):(\d+)>/g,
      '<img class="discord-emoji" src="https://cdn.discordapp.com/emojis/$2.png?size=64&quality=lossless" alt="$1">',
    );
}

/**
 * Helper: Converts Discord message object (content + embeds) into stylized HTML card
 */
function buildDiscordAnnouncementHtml(msg) {
  const content = replaceDiscordEmojis(msg.content || "");
  const firstEmbed = msg.embeds && msg.embeds.length > 0 ? msg.embeds[0] : null;

  const embedTitle = firstEmbed
    ? replaceDiscordEmojis(firstEmbed.title || "")
    : "";
  const embedDesc = firstEmbed
    ? replaceDiscordEmojis(firstEmbed.description || "").replace(/\n/g, "<br/>")
    : "";
  const embedImage = firstEmbed?.image?.url || "";
  const embedColor = firstEmbed?.color
    ? `#${firstEmbed.color.toString(16).padStart(6, "0")}`
    : "#00f3ff";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 800px;
          background: #0f111a;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          padding: 24px;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .discord-card {
          width: 100%;
          background: #181b26;
          border-radius: 12px;
          border: 1px solid #2d3748;
          border-left: 6px solid ${embedColor};
          padding: 20px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #2d3748;
        }
        .author-name {
          font-weight: 700;
          color: #ffffff;
          font-size: 1.1rem;
        }
        .tag-bot {
          background: #5865f2;
          color: #fff;
          font-size: 0.65rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          margin-left: 6px;
        }
        .msg-content {
          font-size: 0.95rem;
          line-height: 1.5;
          margin-bottom: 14px;
          color: #cbd5e1;
        }
        .embed-box {
          background: #11141d;
          border-radius: 8px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .embed-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 8px;
        }
        .embed-desc {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #94a3b8;
        }
        .embed-image {
          margin-top: 12px;
          max-width: 100%;
          border-radius: 8px;
          display: block;
        }
        .discord-emoji {
          width: 20px;
          height: 20px;
          vertical-align: -3px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="discord-card">
        <div class="header">
          <img class="avatar" src="https://cdn.discordapp.com/avatars/${msg.author?.id}/${msg.author?.avatar}.png" onerror="this.src='https://atx-family.onrender.com/images/atx.webp';" />
          <div>
            <span class="author-name">${msg.author?.username || "ATX System"}</span>
            ${msg.author?.bot ? '<span class="tag-bot">BOT</span>' : ""}
          </div>
        </div>

        ${content ? `<div class="msg-content">${content}</div>` : ""}

        ${
          firstEmbed
            ? `
          <div class="embed-box">
            ${embedTitle ? `<div class="embed-title">${embedTitle}</div>` : ""}
            ${embedDesc ? `<div class="embed-desc">${embedDesc}</div>` : ""}
            ${embedImage ? `<img class="embed-image" src="${embedImage}" />` : ""}
          </div>
        `
            : ""
        }
      </div>
    </body>
    </html>
  `;
}

/**
 * Renders an HTML string into a Base64 PNG string
 */
async function generateAnnouncementImage(htmlContent) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1.5 });

    // Set valid HTML content
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Return as base64 string
    const imageBuffer = await page.screenshot({
      type: "png",
      encoding: "base64",
    });

    return `data:image/png;base64,${imageBuffer}`;
  } catch (err) {
    console.error("[ANNOUNCEMENT RENDER ERROR]", err.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// GET /api/announcements
router.get("/api/announcements", async (req, res) => {
  try {
    const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!channelId || !botToken) {
      return res
        .status(500)
        .json({ success: false, message: "Missing Discord configuration." });
    }

    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=3`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );

    if (!response.ok) throw new Error(`Discord API Status ${response.status}`);

    const messages = await response.json();
    const announcementImages = [];

    // Process sequentially to save memory on Render
    for (const msg of messages) {
      const html = buildDiscordAnnouncementHtml(msg);
      const base64Image = await generateAnnouncementImage(html);

      if (base64Image) {
        announcementImages.push({
          id: msg.id,
          image: base64Image,
          timestamp: msg.timestamp,
        });
      }
    }

    return res.json({ success: true, announcements: announcementImages });
  } catch (err) {
    console.error("[ANNOUNCEMENT API ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Could not generate announcement images.",
    });
  }
});

module.exports = router;
