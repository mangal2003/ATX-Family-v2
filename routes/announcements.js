const express = require("express");
const router = express.Router();
const puppeteer = require("puppeteer");
const fs = require("fs");

let browserInstance = null;

/**
 * Launches Puppeteer, falling back to local Chrome or Edge if the cached binary is missing
 */
async function getBrowser() {
  if (!browserInstance) {
    // Check standard Windows executable paths
    const chromePath =
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const chromePathX86 =
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
    const edgePath =
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

    let executablePath = null;
    if (fs.existsSync(chromePath)) executablePath = chromePath;
    else if (fs.existsSync(chromePathX86)) executablePath = chromePathX86;
    else if (fs.existsSync(edgePath)) executablePath = edgePath;

    const launchOptions = {
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    browserInstance = await puppeteer.launch(launchOptions);
  }
  return browserInstance;
}

/**
 * Converts Discord custom emoji codes (<:name:id> / <a:name:id>) into actual CDN image tags
 */
function replaceDiscordEmojis(text = "") {
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
 * Renders HTML content into a PNG base64 image buffer
 */
async function generateAnnouncementImage(msg) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });
  const page = await browser.newPage();

  // Parse custom emojis and line breaks
  const formattedContent = replaceDiscordEmojis(msg.content)
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const avatarUrl = msg.author.avatar
    ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  const dateStr = new Date(msg.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // HTML Template simulating Discord Dark Theme
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          background-color: #313338;
          color: #dbdee1;
          font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 20px;
          width: 650px;
          box-sizing: border-box;
        }
        .message-box {
          display: flex;
          gap: 16px;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
        }
        .content {
          flex: 1;
        }
        .header {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 6px;
        }
        .username {
          color: #f2f3f5;
          font-weight: 600;
          font-size: 16px;
        }
        .timestamp {
          color: #949ba4;
          font-size: 12px;
        }
        .text-body {
          font-size: 15px;
          line-height: 1.375;
          word-break: break-word;
        }
        .discord-emoji {
          width: 22px;
          height: 22px;
          vertical-align: middle;
          object-fit: contain;
        }
      </style>
    </head>
    <body>
      <div id="capture-target" class="message-box">
        <img class="avatar" src="${avatarUrl}" />
        <div class="content">
          <div class="header">
            <span class="username">${msg.author.global_name || msg.author.username}</span>
            <span class="timestamp">${dateStr}</span>
          </div>
          <div class="text-body">${formattedContent}</div>
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlTemplate, { waitUntil: "networkidle0" });

  const element = await page.$("#capture-target");
  const imageBuffer = await element.screenshot({
    type: "png",
    omitBackground: true,
  });
  await page.close();

  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

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

    // Generate screenshot image for each message
    const announcementImages = await Promise.all(
      messages.map(async (msg) => {
        const imageBase64 = await generateAnnouncementImage(msg);
        return {
          id: msg.id,
          image: imageBase64,
          timestamp: msg.timestamp,
        };
      }),
    );

    return res.json({ success: true, announcements: announcementImages });
  } catch (err) {
    console.error("[ANNOUNCEMENT RENDER ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Could not generate announcement images.",
    });
  }
});

module.exports = router;
