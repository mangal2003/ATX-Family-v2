// Connect to the music lounge socket
const socket = io("/music-lounge");
let player;

// YouTube IFrame API Ready Callback
function onYouTubeIframeAPIReady() {
  player = new YT.Player("youtube-player", {
    height: "0",
    width: "0",
    playerVars: {
      autoplay: 1,
      controls: 0,
    },
    events: {
      onStateChange: onPlayerStateChange,
    },
  });
}

// Track end event handler
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    socket.emit("track_ended");
  }
}

// ---------------------------------------------------------
// SOCKET LISTENERS (Pause & Resume Handlers)
// ---------------------------------------------------------
socket.on("pause_playback", () => {
  if (player && typeof player.pauseVideo === "function") {
    player.pauseVideo();
  }
});

socket.on("resume_playback", () => {
  if (player && typeof player.playVideo === "function") {
    player.playVideo();
  }
});

socket.on("stop_playback", () => {
  if (player && typeof player.stopVideo === "function") {
    player.stopVideo();
  }
});

// Sync new track playback
socket.on("play_next_track", (data) => {
  if (player && typeof player.loadVideoById === "function") {
    player.loadVideoById({
      videoId: data.track.streamUrl,
      startSeconds: data.offsetSeconds || 0,
    });
  }
});
