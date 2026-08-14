const play = require("play-dl");
const fetch = require("isomorphic-unfetch");
const { getDetails, getTracks } = require("spotify-url-info")(fetch);

/**
 * Helper to extract YouTube Video ID from links
 */
function extractVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Keywords indicating movie, TV show, or drama episode content
 */
const MOVIE_DISQUALIFIERS = [
  "full movie",
  "full film",
  "web series",
  "episode",
  "season 1",
  "season 2",
  "season 3",
  "season 4",
  "box office",
  "theatrical release",
  "hd movie",
  "bollywood movie",
  "hollywood movie",
  "dubbed movie",
];

function isMovieOrSeries(title = "", description = "") {
  const combinedText = `${title} ${description}`.toLowerCase();
  return MOVIE_DISQUALIFIERS.some((keyword) => combinedText.includes(keyword));
}

/**
 * Resolves a YouTube music query safely, avoiding movies/dramas
 */
async function searchYouTubeMusicTrack(queryText) {
  const searchInput = `${queryText} audio`;

  let searchResults = [];
  try {
    searchResults = await play.search(searchInput, {
      limit: 8,
      source: { youtube: "video" },
    });
  } catch (err) {
    console.error("[YOUTUBE SEARCH ERROR]", err.message);
    throw new Error(
      `Could not find a playable match for "${queryText}". Please check spelling or use a direct YouTube link!`,
    );
  }

  if (!searchResults || searchResults.length === 0) {
    throw new Error(`No music match found on YouTube for "${queryText}".`);
  }

  // Safe property checks using optional chaining (?.)
  const validVideo = searchResults.find((item) => {
    if (!item) return false;
    const isVideo =
      (item.type === "video" || item.id || item.url) && !item?.browseId;
    const isMovie = isMovieOrSeries(item.title || "", item.description || "");
    return isVideo && !isMovie;
  });

  const target = validVideo || searchResults.find((i) => i) || searchResults[0];

  if (!target) {
    throw new Error(`Unable to load video details for "${queryText}".`);
  }

  const videoId = target.id || extractVideoId(target.url);

  if (!videoId) {
    throw new Error(`Invalid video stream for "${queryText}".`);
  }

  return {
    title: target.title || queryText,
    videoId,
    thumbnail:
      target.thumbnails?.[0]?.url ||
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: target.durationInSec || 0,
  };
}

/**
 * Resolves raw input into track metadata.
 * Returns a single track object OR an array of tracks (for Spotify Playlists/Albums).
 */
async function resolveTrackInput(input) {
  try {
    if (!input || typeof input !== "string") {
      throw new Error(
        "Please provide a song name, YouTube link, or Spotify link.",
      );
    }

    const cleanInput = input.trim();

    // 1. SPOTIFY LINK HANDLING
    if (cleanInput.includes("spotify.com")) {
      try {
        if (cleanInput.includes("/track/")) {
          // Single Spotify Track
          const details = await getDetails(cleanInput);
          const trackData = details.preview;
          const trackName = trackData.title;
          const artistName = trackData.artist;

          const queryText = `${trackName} ${artistName}`;
          const ytTrack = await searchYouTubeMusicTrack(queryText);

          return {
            title: `${trackName} - ${artistName}`,
            videoId: ytTrack.videoId,
            thumbnail: trackData.image || ytTrack.thumbnail,
            duration: ytTrack.duration,
          };
        } else if (
          cleanInput.includes("/playlist/") ||
          cleanInput.includes("/album/")
        ) {
          // Spotify Playlist / Album
          const tracks = await getTracks(cleanInput);

          if (!tracks || tracks.length === 0) {
            throw new Error("This Spotify link contains no playable tracks.");
          }

          const trackList = tracks;
          const resolvedTracks = [];

          for (const item of trackList) {
            try {
              if (!item) continue;
              const trackName = item.name;
              const artistName = item.artists?.[0]?.name || "";
              const queryText = `${trackName} ${artistName}`;

              const ytTrack = await searchYouTubeMusicTrack(queryText);

              resolvedTracks.push({
                title: `${trackName} - ${artistName}`,
                videoId: ytTrack.videoId,
                thumbnail: item.album?.images?.[0]?.url || ytTrack.thumbnail,
                duration: ytTrack.duration,
              });
            } catch (err) {
              console.warn(`[PLAYLIST TRACK SKIP] Failed for track`);
            }
          }

          if (resolvedTracks.length === 0) {
            throw new Error(
              "Could not resolve tracks from this Spotify playlist.",
            );
          }

          return resolvedTracks;
        } else {
          throw new Error("Unsupported Spotify link format.");
        }
      } catch (spErr) {
        console.error("[SPOTIFY RESOLVE ERROR]", spErr.message);
        throw new Error(
          "Couldn't process that Spotify link. Please try searching by song name or direct YouTube link!",
        );
      }
    }

    // 2. DIRECT YOUTUBE LINK
    const directId = extractVideoId(cleanInput);
    if (directId) {
      let title, videoId, thumbnail, duration;

      try {
        const info = await play.video_info(cleanInput);
        const details = info.video_details;

        if (isMovieOrSeries(details.title, details.description)) {
          throw new Error(
            "Movies or TV episodes are not permitted in the music room.",
          );
        }

        title = details.title || "Unknown Track";
        videoId = details.id || directId;
        thumbnail = details.thumbnails?.[0]?.url || "";
        duration = details.durationInSec || 0;
      } catch (ytErr) {
        if (ytErr.message.includes("Movies")) throw ytErr;
        title = "YouTube Audio Track";
        videoId = directId;
        thumbnail = `https://img.youtube.com/vi/${directId}/hqdefault.jpg`;
        duration = 0;
      }

      return { title, videoId, thumbnail, duration };
    }

    // 3. PLAIN TEXT SEARCH QUERY
    return await searchYouTubeMusicTrack(cleanInput);
  } catch (err) {
    console.error("[MUSIC EXTRACTOR LOG]", err.stack || err.message);

    // Sanitize any unhandled TypeError/ReferenceError into a clean user prompt
    if (
      err.message.includes("browseId") ||
      err.message.includes("undefined") ||
      err.message.includes("TypeError") ||
      err.message.includes("expiry") ||
      err.message.includes("reading '")
    ) {
      throw new Error(
        `Could not resolve song details for "${input}". Please try adding the artist name or using a direct YouTube link!`,
      );
    }

    throw err;
  }
}

module.exports = { resolveTrackInput };
