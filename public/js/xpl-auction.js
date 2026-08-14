const socket = io();
let countdownInterval;

// 1. Join Room & Sync Persistent History
socket.emit("join-auction-room", { seasonNumber: ACTIVE_SEASON_NUM });

socket.on("sync-auction-state", (state) => {
  if (state.nominatedPlayer) {
    updateNominationBar(
      state.nominatedPlayer,
      state.currentBid,
      state.highestBidderTeam,
    );
  }
  if (state.bidHistory) {
    renderBidHistory(state.bidHistory);
  }
  if (state.status) {
    updateAuctionStatusBadge(state.status);
  }
  if (state.currentBid !== undefined) {
    updateQuickBidButtons(state.currentBid);
  }
});

// 2. Real-Time Countdown Listener
socket.on("auction-countdown-started", (data) => {
  let timeLeft = data.seconds;

  const container = document.getElementById("bid-stream-container");
  container.innerHTML = `
    <div class="stream-empty-state" style="color: var(--accent-cyan); padding: 2rem 0;">
      <h2>AUTOMATED AUCTION SESSION</h2>
      <p>Auction will automatically start in <strong id="live-timer" class="gold-text" style="font-size: 2rem;">${timeLeft}</strong> seconds.</p>
    </div>
  `;

  updateAuctionStatusBadge("STARTING");

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    const timerElem = document.getElementById("live-timer");
    if (timerElem) timerElem.innerText = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
});

// 3. New Player Auto-Nominated
socket.on("player-nominated", (data) => {
  clearInterval(countdownInterval);
  updateNominationBar(data.player, data.currentBid, null);
  updateQuickBidButtons(data.currentBid);
  updateAuctionStatusBadge("LIVE");
});

// 4. Handle Bids (Continuous Array)
socket.on("bid-updated", (data) => {
  const newBid = data.currentBid || data.amount;
  const currentBidElem = document.getElementById("current-bid-amount");
  if (currentBidElem) {
    currentBidElem.innerHTML = `<span class="metric-label cyan-text">Current Bid</span> ${(data.currentBid || data.amount).toLocaleString()} <i class="fa-solid fa-coins gold-text"></i>`;
  }
  updateQuickBidButtons(newBid);
  appendLogToStream(data);
  playBidSound();
});

// 5. End of Round (Sold / Unsold)
socket.on("auction-round-ended", (data) => {
  const statText = document.getElementById("spectator-stat-text");

  // Trigger Center Overlay Stamp/Gavel Animation
  triggerAuctionResultAnimation(data.status);

  if (data.status === "sold") {
    if (statText) {
      statText.innerText = `${data.player.platoId.toUpperCase()} SOLD TO ${data.team.teamTag} FOR ${data.amount} Coins!`;
    }

    const purseElem = document.getElementById(
      `team-purse-val-${data.team._id}`,
    );
    if (purseElem) {
      purseElem.innerText = data.newRemainingPurse.toLocaleString();
    }

    if (SOCKET_USER.userTeamId && SOCKET_USER.userTeamId === data.team._id) {
      const myPurseElem = document.getElementById("my-team-purse");
      if (myPurseElem) {
        myPurseElem.innerText = `${data.newRemainingPurse.toLocaleString()} Coins!`;
      }
    }
  } else {
    if (statText) {
      statText.innerText = `${data.player.platoId.toUpperCase()} WENT UNSOLD.`;
    }
  }

  updateAuctionStatusBadge("FETCHING NEXT...");

  const platoIdElem = document.getElementById("current-plato-id");
  if (platoIdElem) {
    platoIdElem.innerText = "Loading next player...";
  }
});

// 6. Real-Time Status Change Listener
socket.on("auction-status-changed", (data) => {
  updateAuctionStatusBadge(data.status);
});

// 7. Final Auction End
socket.on("auction-finished", () => {
  updateAuctionStatusBadge("COMPLETED");
});

// 8. System Log Listener (Prompts, Going once/twice, Sold/Unsold result cards)
socket.on("system-log-emitted", (log) => {
  appendLogToStream(log);
});

// 9. Lot Nomination Card Listener
socket.on("system-nomination-card", (cardData) => {
  appendLogToStream(cardData);
});

// 10. Error Listener
socket.on("auction-error", (err) => {
  alert(err.message);
});

/* =========================================================
   USER & COORDINATOR ACTION HANDLERS
   ========================================================= */

function startAuctionSession() {
  if (confirm("Are you sure you want to start the live XPL Auction session?")) {
    socket.emit("coordinator-start-auction", {
      seasonNumber: ACTIVE_SEASON_NUM,
    });
  }
}

function togglePauseAuction() {
  socket.emit("coordinator-toggle-pause", { seasonNumber: ACTIVE_SEASON_NUM });
}

function triggerAuctionBreak() {
  const mins = prompt("Enter break duration in minutes:", "5");
  if (mins && !isNaN(mins)) {
    socket.emit("coordinator-trigger-break", {
      seasonNumber: ACTIVE_SEASON_NUM,
      minutes: parseInt(mins),
    });
  }
}

function submitBidIncrement(increment) {
  if (!SOCKET_USER.userTeamId) return alert("Unauthorized team bidder.");

  const currentBidElem = document.getElementById("current-bid-amount");
  const currentBidText = currentBidElem ? currentBidElem.innerText : "0";
  const currentBid = parseInt(currentBidText.replace(/[^0-9]/g, "")) || 0;

  socket.emit("place-bid", {
    seasonNumber: ACTIVE_SEASON_NUM,
    teamId: SOCKET_USER.userTeamId,
    amount: currentBid + increment,
  });
}

function submitCustomBid() {
  if (!SOCKET_USER.userTeamId) return alert("Unauthorized team bidder.");

  const input = document.getElementById("custom-bid-input");
  const amount = parseInt(input.value);

  if (!amount || amount <= 0) return alert("Enter a valid custom bid amount!");
  if (amount % 50 !== 0) {
    return alert(
      "Custom bid amount must end in 50 or 00 (e.g. 150, 300, 1250).",
    );
  }

  socket.emit("place-bid", {
    seasonNumber: ACTIVE_SEASON_NUM,
    teamId: SOCKET_USER.userTeamId,
    amount: amount,
  });
  input.value = "";
}

/* =========================================================
   DOM & UI RENDERING HELPERS
   ========================================================= */

function updateAuctionStatusBadge(status) {
  const badge = document.getElementById("auction-status-badge");
  if (badge) {
    badge.innerText = status.toUpperCase();
  }
}

function updateNominationBar(player, currentBid, highestBidderTeam) {
  if (!player) return;
  const platoIdElem = document.getElementById("current-plato-id");
  const gamesElem = document.getElementById("current-pref-games");
  const basePriceElem = document.getElementById("current-base-price");
  const bidElem = document.getElementById("current-bid-amount");

  if (platoIdElem) platoIdElem.innerText = `${player.platoId.toUpperCase()}`;
  if (gamesElem)
    gamesElem.innerText = player.preferredGames || "No preferred games";
  if (basePriceElem) {
    basePriceElem.innerHTML = `<span class="metric-label">Base Price</span> ${(player.basePrice || 0).toLocaleString()} <i class="fa-solid fa-coins gold-text"></i>`;
  }
  if (bidElem) {
    bidElem.innerHTML = `<span class="metric-label cyan-text">Current Bid</span> ${currentBid.toLocaleString()} <i class="fa-solid fa-coins gold-text"></i>`;
  }
}

// Single Factory Function to Build Log Item DOM Nodes
function createLogRowElement(log) {
  const row = document.createElement("div");

  if (log.isResultCard) {
    // REDESIGNED FULL HEADER SOLD / UNSOLD CARD
    const isSold = log.logType === "sold";
    const statusClass = isSold ? "sold-card" : "unsold-card";
    const statusTitle = isSold ? "GAVEL DOWN! SOLD" : "ROUND ENDED! UNSOLD";

    row.className = `bid-stream-item result-card-item ${statusClass}`;
    row.innerHTML = `
      <div class="result-card-inner">
        <!-- 1. Full Banner Header -->
        <div class="result-card-header">
          <span>${statusTitle}</span>
          <span class="card-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>

        <!-- 2. Player Plato ID (Left) & Base Price (Right) -->
        <div class="result-card-row player-info-row">
          <span class="plato-id font-bold">${log.platoId ? log.platoId.toUpperCase() : ""}</span>
          <span class="base-price-tag">Base: ${(log.basePrice || 0).toLocaleString()} <i class="fa-solid fa-coins gold-text"></i></span>
        </div>

        <!-- 3. Team Name & Sold Amount / Unsold Notice -->
        <div class="result-card-row team-info-row">
          ${
            isSold
              ? `<span class="team-badge font-bold"><i class="fa-solid fa-shield-halved"></i> ${log.teamName} (${log.teamTag})</span>
                 <span class="sold-price-val font-bold">${(log.soldAmount || 0).toLocaleString()} <i class="fa-solid fa-coins gold-text"></i></span>`
              : `<span class="unsold-notice-val">No bids received during auction round.</span>`
          }
        </div>
      </div>
    `;
  } else if (log.isNominationCard) {
    // LOT NOMINATION CARD
    row.className = "bid-stream-item nomination-card-item";
    row.innerHTML = `
      <div class="nomination-card-inner">
        <div class="card-top-row">
          <span class="lot-badge">LOT #${log.lotNumber}</span>
          <span class="plato-id-title cyan-text">${log.platoId ? log.platoId.toUpperCase() : ""}</span>
          <span class="card-time text-muted">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="card-games-row">
          <i class="fa-solid fa-gamepad gold-text"></i> Preferred Games: <strong>${log.preferredGames}</strong>
        </div>
        <div class="card-bio-row text-muted">
          "${log.aboutPlayer}"
        </div>
        <div class="card-price-tagline">
          🔥 ${log.tagline} <span class="gold-text"><strong>${(log.basePrice || 0).toLocaleString()} <i class="fa-solid fa-coins gold-text"></i></strong></span>
        </div>
      </div>
    `;
  } else if (log.isSystem) {
    // REDESIGNED SYSTEM LOG ITEM (RESPONSIVE WRAPPING)
    let itemClass = "bid-stream-item system-log-card";
    let iconClass = "fa-solid fa-terminal";
    let badgeClass = "badge-system";
    let prefix = "SYSTEM";

    const msg = log.message || "";

    // Categorize log types by message triggers or logType
    if (msg.includes("GOING ONCE")) {
      itemClass += " going-once-card";
      iconClass = "fa-solid fa-hourglass-half";
      badgeClass = "badge-warning";
      prefix = "GOING ONCE";
    } else if (msg.includes("GOING TWICE")) {
      itemClass += " going-twice-card";
      iconClass = "fa-solid fa-bolt";
      badgeClass = "badge-danger";
      prefix = "GOING TWICE";
    } else if (msg.includes("PAUSED") || msg.includes("PAUSE")) {
      itemClass += " pause-log-card";
      iconClass = "fa-solid fa-circle-pause";
      badgeClass = "badge-pause";
      prefix = "PAUSE";
    } else if (msg.includes("RESUMED") || msg.includes("starting")) {
      itemClass += " resume-log-card";
      iconClass = "fa-solid fa-play";
      badgeClass = "badge-resume";
      prefix = "NOTICE";
    } else if (log.logType === "sold" || msg.includes("SOLD")) {
      itemClass += " sold-log-item";
      iconClass = "fa-solid fa-gavel";
      badgeClass = "badge-sold";
      prefix = "SOLD";
    } else if (log.logType === "unsold" || msg.includes("UNSOLD")) {
      itemClass += " unsold-log-item";
      iconClass = "fa-solid fa-ban";
      badgeClass = "badge-unsold";
      prefix = "UNSOLD";
    } else if (
      msg.includes("Clock ticking") ||
      msg.includes("Going quiet") ||
      msg.includes("Wake up")
    ) {
      itemClass += " prompt-log-card";
      iconClass = "fa-solid fa-bell";
      badgeClass = "badge-prompt";
      prefix = "PROMPT";
    }

    row.className = itemClass;
    row.innerHTML = `
      <div class="system-log-inner">
        <div class="system-log-header">
          <div class="system-log-tag-group">
            <span class="system-icon-wrapper"><i class="${iconClass}"></i></span>
            <span class="system-badge ${badgeClass}">${prefix}</span>
          </div>
          <span class="system-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="system-message-content">
          ${msg}
        </div>
      </div>
    `;
  } else {
    // REDESIGNED ELEGANT LIVE BID LOG CARD
    const teamLogoHtml = log.logoUrl
      ? `<img src="${log.logoUrl}" alt="${log.teamTag}" class="live-bid-team-logo" onerror="this.onerror=null; this.src='/images/default-team.png';">`
      : `<div class="live-bid-team-avatar"><i class="fa-solid fa-shield-halved"></i></div>`;

    const incrementBadge = log.increment
      ? `<span class="bid-increment-pill">+${log.increment.toLocaleString()}</span>`
      : ``;

    row.className = "bid-stream-item live-bid-card-item";
    row.innerHTML = `
      <div class="live-bid-card-inner">
        <div class="live-bid-left">
          ${teamLogoHtml}
          <div class="live-bid-team-info">
            <span class="live-bid-team-tag">${log.teamTag || "BID"}</span>
            <span class="live-bid-team-name">${log.teamName || "Team Bidder"}</span>
          </div>
        </div>

        <div class="live-bid-right">
          <div class="live-bid-price-col">
            ${incrementBadge}
            <span class="live-bid-total-amount">${(log.currentBid || log.amount).toLocaleString()} 
            <i class="fa-solid fa-coins gold-text"></i></span>
          </div>
          <span class="live-bid-timestamp">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    `;
  }

  return row;
}

// Live Appender: Always pushes the NEWEST log to the BOTTOM and auto-scrolls down
function appendLogToStream(log) {
  const container = document.getElementById("bid-stream-container");
  if (!container) return;

  const emptyState = container.querySelector(".stream-empty-state");
  if (emptyState) emptyState.remove();

  const row = createLogRowElement(log);
  container.appendChild(row);

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

// History Loader: Renders chronological history (oldest at top, newest at bottom)
function renderBidHistory(history) {
  const container = document.getElementById("bid-stream-container");
  if (!container || !history || history.length === 0) return;
  container.innerHTML = "";

  // Reverse MongoDB's unshifted history (newest-first) so it renders oldest-first
  const chronologicalHistory = [...history].reverse();

  chronologicalHistory.forEach((log) => {
    const row = createLogRowElement(log);
    container.appendChild(row);
  });

  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 100);
}

// Dynamic Quick Bid Buttons Helper
function updateQuickBidButtons(currentBid) {
  const btn100 = document.getElementById("btn-bid-100");
  const btn500 = document.getElementById("btn-bid-500");
  const btn1000 = document.getElementById("btn-bid-1000");

  if (!btn100 || !btn500 || !btn1000) return;

  const bidVal = parseInt(currentBid) || 0;

  // Reset visibility
  btn100.style.display = "none";
  btn500.style.display = "none";
  btn1000.style.display = "none";

  if (bidVal < 1000) {
    // Current bid < 1000 -> Show +100 only
    btn100.style.display = "inline-block";
  } else if (bidVal >= 1000 && bidVal < 5000) {
    // Current bid between 1000 and 4999 -> Show +500 only
    btn500.style.display = "inline-block";
  } else {
    // Current bid 5000 or more -> Show +1000 only
    btn1000.style.display = "inline-block";
  }
}
/* =========================================================
   ANIMATION & SOUND EFFECTS
   ========================================================= */

function triggerAuctionResultAnimation(type) {
  const overlay = document.getElementById("auction-impact-overlay");
  const stamp = document.getElementById("impact-stamp");
  const stampText = document.getElementById("stamp-text");

  if (!overlay || !stamp || !stampText) return;

  stamp.className =
    "impact-stamp " + (type === "sold" ? "sold-stamp" : "unsold-stamp");
  stampText.innerText = type === "sold" ? "SOLD" : "UNSOLD";

  overlay.classList.remove("hidden");

  playGavelSound();

  setTimeout(() => {
    playThudSound();
  }, 350);

  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.style.opacity = "1";
    }, 300);
  }, 1800);
}

function playBidSound() {
  try {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
    );
    audio.volume = 0.3;
    audio.play();
  } catch (e) {}
}

function playGavelSound() {
  try {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
    );
    audio.volume = 0.6;
    audio.play();
  } catch (e) {}
}

function playThudSound() {
  try {
    const audio = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
    );
    audio.volume = 0.8;
    audio.play();
  } catch (e) {}
}
