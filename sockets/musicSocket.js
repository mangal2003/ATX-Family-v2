const MusicRoom = require("../models/MusicQueue");
const { resolveTrackInput } = require("../utils/musicExtractor");

let syncInterval = null;

function initMusicSocket(io) {
  const musicNamespace = io.of("/music-lounge");

  // --- GLOBAL HEARTBEAT INTERVAL (2.5s SYNC FOR BACKGROUND PLAYBACK) ---
  if (!syncInterval) {
    syncInterval = setInterval(async () => {
      try {
        const room = await MusicRoom.findOne({ roomId: "global_lounge" });
        if (room && room.currentTrack && room.trackStartedAt) {
          const elapsedSeconds = Math.max(
            0,
            (Date.now() - new Date(room.trackStartedAt).getTime()) / 1000,
          );

          if (
            room.currentTrack.duration > 0 &&
            elapsedSeconds >= room.currentTrack.duration + 2
          ) {
            await executeSkip(room, musicNamespace, "Track finished");
          } else {
            // Emits heartbeat to ensure audio state persists across page navigation/background tabs
            musicNamespace.emit("heartbeat_sync", {
              elapsedSeconds,
              trackId: room.currentTrack.streamUrl,
            });
          }
        }
      } catch (err) {
        console.error("[HEARTBEAT ERROR]", err);
      }
    }, 2500);
  }

  // --- SOCKET CONNECTION HANDLER ---
  musicNamespace.on("connection", async (socket) => {
    const sendRoomState = async () => {
      let room = await MusicRoom.findOne({ roomId: "global_lounge" });
      if (!room) {
        room = await MusicRoom.create({ roomId: "global_lounge", queue: [] });
      }

      let currentOffsetSeconds = 0;
      if (room.currentTrack && room.trackStartedAt) {
        currentOffsetSeconds = Math.max(
          0,
          (Date.now() - new Date(room.trackStartedAt).getTime()) / 1000,
        );
      }

      socket.emit("room_state_sync", {
        currentTrack: room.currentTrack,
        offsetSeconds: currentOffsetSeconds,
        queue: room.queue || [],
      });
    };

    try {
      await sendRoomState();
    } catch (err) {
      console.error("[MUSIC SOCKET INIT ERROR]", err);
    }

    socket.on("request_fresh_sync", async () => {
      await sendRoomState();
    });

    // --- COMMAND & CHAT PROCESSING ---
    socket.on("process_command", async (data) => {
      try {
        const { command, user } = data;

        // 1. Enforce Authentication
        if (!user || !user.username) {
          return socket.emit("chat_sys_message", {
            text: `<div class="system-log" style="color: var(--accent-danger, #ff4655);">[ERROR] You must be logged in to chat or use music commands.</div>`,
          });
        }

        const input = (command || "").trim();
        if (!input) return;

        const username = user.username;
        const isAdmin = !!user.isAdmin;

        // 2. Handle Music Commands starting with m!
        if (input.startsWith("m!")) {
          const args = input.slice(2).trim().split(/ +/);
          const action = args.shift().toLowerCase();
          const query = args.join(" ");

          // --- COMMAND: m!help ---
          if (action === "help") {
            const helpText = `
              <div class="help-console-box" style="background: var(--bg-card, rgba(0,0,0,0.3)); border: 1px solid var(--border-color, rgba(0,243,255,0.3)); padding: 0.85rem; border-radius: 8px; font-family: 'Share Tech Mono', monospace;">
                <strong class="help-title" style="color: var(--accent-gold, #ffd700); display: block; margin-bottom: 0.5rem;">
                  <i class="fa-solid fa-terminal"></i> ATX MUSIC ROOM COMMANDS
                </strong>
                <ul class="help-cmd-list" style="list-style: none; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: var(--text-main, #e2e8f0);">
                  <li><code style="color: var(--accent-cyan, #00f3ff);">m!play &lt;song/link&gt;</code> <span style="color: var(--text-muted, #94a3b8);">— Play or queue a song or Spotify playlist.</span></li>
                  <li><code style="color: var(--accent-cyan, #00f3ff);">m!queue</code> <span style="color: var(--text-muted, #94a3b8);">— Display upcoming queued tracks.</span></li>
                  <li><code style="color: var(--accent-cyan, #00f3ff);">m!skip</code> <span style="color: var(--text-muted, #94a3b8);">— Skip current track.</span></li>
                  <li><code style="color: var(--accent-cyan, #00f3ff);">m!quit</code> / <code style="color: var(--accent-cyan, #00f3ff);">m!clear</code> <span style="color: var(--text-muted, #94a3b8);">— Exit music room, stop playback, and clear the entire queue.</span></li>
                  <li><code style="color: var(--accent-cyan, #00f3ff);">m!yes / m!no</code> <span style="color: var(--text-muted, #94a3b8);">— Respond to skip vote requests.</span></li>
                </ul>
              </div>
            `;
            return socket.emit("chat_sys_message", { text: helpText });
          }

          // --- COMMAND: m!queue ---
          else if (action === "queue") {
            const updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });
            if (
              !updatedRoom ||
              !updatedRoom.queue ||
              updatedRoom.queue.length === 0
            ) {
              return socket.emit("chat_sys_message", {
                text: `<div class="help-console-box" style="background: var(--bg-card, rgba(0,0,0,0.3)); border: 1px solid var(--border-color, rgba(0,243,255,0.3)); padding: 0.85rem; border-radius: 8px;">
                        <strong class="help-title" style="color: var(--accent-cyan, #00f3ff);"><i class="fa-solid fa-list-ol"></i> PLAYLIST QUEUE</strong>
                        <div style="color: var(--text-muted, #94a3b8); margin-top: 0.35rem; font-size: 0.85rem;">The queue is currently empty. Use <code style="color: var(--accent-gold, #ffd700);">m!play &lt;song&gt;</code> to add tracks!</div>
                       </div>`,
              });
            }

            const queueItems = updatedRoom.queue
              .map(
                (s, i) =>
                  `<li style="padding: 0.2rem 0; border-bottom: 1px dashed var(--border-color, rgba(255,255,255,0.1));">
                    <code style="color: var(--accent-gold, #ffd700);">${i + 1}. ${s.title}</code> 
                    <span style="color: var(--text-muted, #94a3b8); font-size: 0.78rem;">(Req by @${s.requestedBy})</span>
                   </li>`,
              )
              .join("");

            const queueText = `
              <div class="help-console-box" style="background: var(--bg-card, rgba(0,0,0,0.3)); border: 1px solid var(--border-color, rgba(0,243,255,0.3)); padding: 0.85rem; border-radius: 8px; font-family: 'Share Tech Mono', monospace;">
                <strong class="help-title" style="color: var(--accent-cyan, #00f3ff);">
                  <i class="fa-solid fa-list-ol"></i> UPCOMING SONGS QUEUE (${updatedRoom.queue.length})
                </strong>
                <ul style="list-style: none; padding-left: 0; margin: 0.5rem 0 0; font-size: 0.85rem;">
                  ${queueItems}
                </ul>
              </div>
            `;
            return socket.emit("chat_sys_message", { text: queueText });
          }

          // --- COMMAND: m!play ---
          else if (action === "play") {
            if (!query) {
              return socket.emit("chat_sys_message", {
                text: '<span style="color: var(--accent-danger, #ff4655);">[SYSTEM] Usage: m!play &lt;link/song name&gt;</span>',
              });
            }

            socket.emit("chat_sys_message", {
              text: `<span style="color: var(--accent-cyan, #00f3ff);">[SYSTEM] Resolving track(s)...</span>`,
            });

            const resolvedData = await resolveTrackInput(query);
            const tracksToAdd = Array.isArray(resolvedData)
              ? resolvedData
              : [resolvedData];

            let updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });
            if (!updatedRoom) {
              updatedRoom = new MusicRoom({
                roomId: "global_lounge",
                queue: [],
              });
            }

            let addedCount = 0;

            for (const trackDetails of tracksToAdd) {
              const newSong = {
                title: trackDetails.title,
                url: `https://www.youtube.com/watch?v=${trackDetails.videoId}`,
                streamUrl: trackDetails.videoId,
                thumbnail: trackDetails.thumbnail,
                duration: trackDetails.duration,
                requestedBy: username,
                requestedByAvatar: user && user.avatar ? user.avatar : "",
              };

              if (
                !updatedRoom.currentTrack ||
                !updatedRoom.currentTrack.title
              ) {
                updatedRoom.currentTrack = newSong;
                updatedRoom.trackStartedAt = new Date();
                updatedRoom.pendingSkip = null;

                musicNamespace.emit("play_next_track", {
                  track: newSong,
                  offsetSeconds: 0,
                });
                musicNamespace.emit("chat_sys_message", {
                  text: `<span style="color: var(--accent-gold, #ffd700);">🎶 Now Playing: <strong>${newSong.title}</strong> (Req by @${newSong.requestedBy})</span>`,
                });
              } else {
                updatedRoom.queue.push(newSong);
              }
              addedCount++;
            }

            await updatedRoom.save();

            if (addedCount > 1) {
              musicNamespace.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-neon, #39ff14);">📌 Queued <strong>${addedCount} tracks</strong> from Spotify playlist!</span>`,
              });
            } else if (addedCount === 1 && updatedRoom.queue.length > 0) {
              const lastQueued =
                updatedRoom.queue[updatedRoom.queue.length - 1];
              musicNamespace.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-neon, #39ff14);">📌 Queued #${updatedRoom.queue.length}: <strong>${lastQueued.title}</strong></span>`,
              });
            }
            return;
          }

          // --- COMMAND: m!quit / m!clear ---
          else if (action === "quit" || action === "clear") {
            const updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });

            const hasCurrentTrack =
              updatedRoom &&
              updatedRoom.currentTrack &&
              updatedRoom.currentTrack.title;
            const hasQueue =
              updatedRoom && updatedRoom.queue && updatedRoom.queue.length > 0;

            if (!updatedRoom || (!hasCurrentTrack && !hasQueue)) {
              return socket.emit("chat_sys_message", {
                text: '<span style="color: var(--text-muted, #94a3b8);">[SYSTEM] Music lounge is already inactive and queue is empty.</span>',
              });
            }

            const trackRequester =
              updatedRoom.currentTrack?.requestedBy ||
              updatedRoom.queue?.[0]?.requestedBy;

            if (trackRequester && username !== trackRequester && !isAdmin) {
              return socket.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-danger, #ff4655);">❌ Only track requester @${trackRequester} or an Admin can quit and clear the music lounge!</span>`,
              });
            }

            // Wipe out current track and queue completely
            updatedRoom.currentTrack = null;
            updatedRoom.trackStartedAt = null;
            updatedRoom.pendingSkip = null;
            updatedRoom.queue = [];
            await updatedRoom.save();

            musicNamespace.emit("stop_playback");
            return musicNamespace.emit("chat_sys_message", {
              text: `<span style="color: var(--accent-danger, #ff4655);">🛑 @${username} cleared the music room and stopped playback.</span>`,
            });
          }

          // --- COMMAND: m!skip ---
          else if (action === "skip") {
            const updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });

            if (!updatedRoom || !updatedRoom.currentTrack) {
              return socket.emit("chat_sys_message", {
                text: '<span style="color: var(--text-muted, #94a3b8);">[SYSTEM] No track is currently playing.</span>',
              });
            }

            const trackRequester = updatedRoom.currentTrack.requestedBy;

            if (username === trackRequester || isAdmin) {
              return await executeSkip(
                updatedRoom,
                musicNamespace,
                `${username === trackRequester ? "Requester" : "Admin"} @${username}`,
              );
            }

            if (
              updatedRoom.pendingSkip &&
              updatedRoom.pendingSkip.status === "pending"
            ) {
              return socket.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-gold, #ffd700);">⚠️ A skip request is already pending for @${trackRequester}.</span>`,
              });
            }

            updatedRoom.pendingSkip = {
              requestedBy: username,
              status: "pending",
            };
            await updatedRoom.save();

            return musicNamespace.emit("chat_sys_message", {
              text: `<span style="color: var(--accent-gold, #ffd700);">❓ <strong>@${username}</strong> requested to skip. <strong>@${trackRequester}</strong>, reply <code style="color: var(--accent-cyan, #00f3ff);">m!yes</code> or <code style="color: var(--accent-danger, #ff4655);">m!no</code>.</span>`,
            });
          }

          // --- COMMAND: m!yes ---
          else if (action === "yes") {
            const updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });

            if (
              !updatedRoom ||
              !updatedRoom.currentTrack ||
              !updatedRoom.pendingSkip ||
              updatedRoom.pendingSkip.status !== "pending"
            ) {
              return socket.emit("chat_sys_message", {
                text: '<span style="color: var(--text-muted, #94a3b8);">[SYSTEM] No active skip request to approve.</span>',
              });
            }

            const trackRequester = updatedRoom.currentTrack.requestedBy;
            if (username !== trackRequester && !isAdmin) {
              return socket.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-danger, #ff4655);">❌ Only @${trackRequester} can approve this skip request!</span>`,
              });
            }

            return await executeSkip(
              updatedRoom,
              musicNamespace,
              `Approved by @${username}`,
            );
          }

          // --- COMMAND: m!no ---
          else if (action === "no") {
            const updatedRoom = await MusicRoom.findOne({
              roomId: "global_lounge",
            });

            if (
              !updatedRoom ||
              !updatedRoom.pendingSkip ||
              updatedRoom.pendingSkip.status !== "pending"
            ) {
              return socket.emit("chat_sys_message", {
                text: '<span style="color: var(--text-muted, #94a3b8);">[SYSTEM] No active skip request to decline.</span>',
              });
            }

            const trackRequester = updatedRoom.currentTrack.requestedBy;
            if (username !== trackRequester && !isAdmin) {
              return socket.emit("chat_sys_message", {
                text: `<span style="color: var(--accent-danger, #ff4655);">❌ Only @${trackRequester} can decline this skip request!</span>`,
              });
            }

            updatedRoom.pendingSkip = null;
            await updatedRoom.save();

            return musicNamespace.emit("chat_sys_message", {
              text: `<span style="color: var(--accent-danger, #ff4655);">🛑 @${username} declined the skip request. The song continues!</span>`,
            });
          }
        }

        // 3. Public Chat Fallback
        const safeUsername = username
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const safeMessage = input.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        musicNamespace.emit("chat_sys_message", {
          text: `<div style="margin: 0.25rem 0;"><strong style="color: var(--accent-cyan, #00f3ff);">@${safeUsername}:</strong> <span style="color: var(--text-main, #e2e8f0);">${safeMessage}</span></div>`,
        });
      } catch (err) {
        console.error("[SOCKET PLAY ERROR]", err);

        const userFriendlyMessage =
          err.message.includes("Cannot read") ||
          err.message.includes("undefined")
            ? "Could not find a playable track for that request. Please try using artist name + song name!"
            : err.message;

        socket.emit("chat_sys_message", {
          text: `<span style="color: var(--accent-danger, #ff4655);">[SYSTEM NOTICE] ${userFriendlyMessage}</span>`,
        });
      }
    });

    // --- TRACK ENDED EVENT ---
    socket.on("track_ended", async () => {
      try {
        const room = await MusicRoom.findOne({ roomId: "global_lounge" });
        if (room) {
          await executeSkip(room, musicNamespace, "Track finished");
        }
      } catch (err) {
        console.error("[TRACK ENDED ERROR]", err);
      }
    });
  });
}

// --- HELPER FUNCTION: EXECUTE SKIP ---
async function executeSkip(room, namespace, reason) {
  room.pendingSkip = null;

  if (room.queue && room.queue.length > 0) {
    const nextTrack = room.queue.shift();
    room.currentTrack = nextTrack;
    room.trackStartedAt = new Date();
    await room.save();

    namespace.emit("play_next_track", { track: nextTrack, offsetSeconds: 0 });
    namespace.emit("chat_sys_message", {
      text: `<span style="color: var(--accent-cyan, #00f3ff);">⏭️ Track skipped (${reason}). Now Playing: <strong>${nextTrack.title}</strong></span>`,
    });
  } else {
    room.currentTrack = null;
    room.trackStartedAt = null;
    await room.save();

    namespace.emit("stop_playback");
    namespace.emit("chat_sys_message", {
      text: `<span style="color: var(--text-muted, #94a3b8);">⏹️ Playback stopped (${reason}). Queue is empty.</span>`,
    });
  }
}

module.exports = initMusicSocket;
