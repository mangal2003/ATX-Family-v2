document.addEventListener("DOMContentLoaded", () => {
  // 1. DYNAMIC COUNTDOWN & AUTO-HIDE LOGIC
  const countdownEl = document.getElementById("eventCountdown");
  const eventSection = document.getElementById("hourlyEventSection");

  function updateEventTimer() {
    const now = new Date();
    const currentMins = now.getUTCMinutes();
    const currentSecs = now.getUTCSeconds();

    const eventType = eventSection
      ? eventSection.getAttribute("data-event-type")
      : null;

    // Condition A: Flash Giveaway expires after the first 10 minutes (00:00 to 09:59)
    if (eventType === "GIVEAWAY") {
      if (currentMins >= 10) {
        if (eventSection) eventSection.style.display = "none";
        return;
      } else {
        const giveawayMinsLeft = 9 - currentMins;
        const giveawaySecsLeft = 59 - currentSecs;
        if (countdownEl) {
          countdownEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Closes in: ${String(
            giveawayMinsLeft,
          ).padStart(2, "0")}:${String(giveawaySecsLeft).padStart(2, "0")}`;
        }
      }
    }
    // Condition B: Cipher Gauntlet runs until the end of the hour (MM:59:59)
    else {
      const minsRemaining = 59 - currentMins;
      const secsRemaining = 59 - currentSecs;

      if (minsRemaining === 0 && secsRemaining === 0) {
        if (eventSection) eventSection.style.display = "none";
        setTimeout(() => window.location.reload(), 1200);
        return;
      }

      if (countdownEl) {
        countdownEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> Reset in: ${String(
          minsRemaining,
        ).padStart(2, "0")}:${String(secsRemaining).padStart(2, "0")}`;
      }
    }
  }

  setInterval(updateEventTimer, 1000);
  updateEventTimer();

  // 2. FLASH GIVEAWAY CLAIM
  const claimGiveawayBtn = document.getElementById("claimGiveawayBtn");
  if (claimGiveawayBtn) {
    claimGiveawayBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/vault/claim-giveaway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (window.showFlash) window.showFlash(data.message, "success");
          const epEl = document.getElementById("liveUserEp");
          if (epEl) epEl.textContent = `${data.newBalance.toLocaleString()} EP`;
          claimGiveawayBtn.disabled = true;
          claimGiveawayBtn.className = "hotstar-btn disabled-btn w-full";
          claimGiveawayBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> CLAIMED`;
        } else {
          if (window.showFlash) window.showFlash(data.message, "error");
        }
      } catch (err) {
        if (window.showFlash)
          window.showFlash("Communication failure with vault.", "error");
      }
    });
  }

  // 3. CIPHER MODAL CONTROLLER
  const cipherModal = document.getElementById("cipherModal");
  const openCipherBtn = document.getElementById("openCipherModalBtn");
  const closeCipherBtn = document.getElementById("closeCipherBtn");
  const cipherForm = document.getElementById("cipherForm");

  if (openCipherBtn && cipherModal) {
    openCipherBtn.addEventListener("click", () => {
      cipherModal.classList.add("active");
      const input = document.getElementById("cipherGuess");
      if (input) setTimeout(() => input.focus(), 100);
    });
  }

  if (closeCipherBtn && cipherModal) {
    closeCipherBtn.addEventListener("click", () => {
      cipherModal.classList.remove("active");
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === cipherModal) {
      cipherModal.classList.remove("active");
    }
  });

  if (cipherForm) {
    cipherForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const guessInput = document.getElementById("cipherGuess");
      const guess = guessInput.value.trim();
      try {
        const res = await fetch("/vault/submit-cipher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guess }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (window.showFlash) window.showFlash(data.message, "success");
          const epEl = document.getElementById("liveUserEp");
          if (epEl) epEl.textContent = `${data.newBalance.toLocaleString()} EP`;
          cipherModal.classList.remove("active");
          if (openCipherBtn) {
            openCipherBtn.disabled = true;
            openCipherBtn.className = "hotstar-btn disabled-btn w-full";
            openCipherBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> CIPHER SOLVED`;
          }
        } else {
          if (window.showFlash) window.showFlash(data.message, "error");
        }
      } catch (err) {
        if (window.showFlash) window.showFlash("Decryption error.", "error");
      }
    });
  }

  // 4. ANIMATED CYBER TERMINAL EMULATOR
  const terminalForm = document.getElementById("terminalForm");
  const terminalInput = document.getElementById("terminalInput");
  const terminalOutput = document.getElementById("terminalOutput");
  const quickChips = document.querySelectorAll(".term-chip");

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function runGameAnimation(cmd) {
    const animEl = document.createElement("p");
    animEl.className = "term-anim-line gold-text";
    terminalOutput.appendChild(animEl);

    const scrollToBottom = () => {
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };

    if (cmd === "roulette") {
      const colors = [
        "[ 🔴 RED ]",
        "[ ⚫ BLACK ]",
        "[ 🟡 GOLD ]",
        "[ 🔵 CYAN ]",
      ];
      for (let i = 0; i < 7; i++) {
        animEl.textContent = `🎡 Spinning roulette wheel... ${colors[i % colors.length]}`;
        scrollToBottom();
        await delay(450);
      }
      animEl.textContent = "🎡 Decelerating wheel bearing... Locked in!";
      await delay(450);
    } else if (cmd === "coinflip" || cmd === "cf") {
      const frames = ["🪙 /", "🪙 —", "🪙 \\", "🪙 |"];
      for (let i = 0; i < 8; i++) {
        animEl.textContent = `🪙 Flipping coin in the air... ${frames[i % frames.length]}`;
        scrollToBottom();
        await delay(200);
      }
      animEl.textContent = "🪙 Catching and revealing coin...";
      await delay(450);
    } else if (cmd === "dice") {
      const diceFaces = [
        "🎲 [ 1 & 3 ]",
        "🎲 [ 4 & 2 ]",
        "🎲 [ 6 & 5 ]",
        "🎲 [ 3 & 4 ]",
        "🎲 [ 5 & 5 ]",
      ];
      for (let i = 0; i < 5; i++) {
        animEl.textContent = `🎲 Casting quantum dice... ${diceFaces[i % diceFaces.length]}`;
        scrollToBottom();
        await delay(450);
      }
      animEl.textContent = "🎲 Dice settled on the table!";
      await delay(450);
    } else if (cmd === "slots" || cmd === "slot") {
      const symbols = ["💎", "⚡", "🪙", "💀", "👑"];
      for (let i = 0; i < 8; i++) {
        const s1 = symbols[Math.floor(Math.random() * symbols.length)];
        const s2 = symbols[Math.floor(Math.random() * symbols.length)];
        const s3 = symbols[Math.floor(Math.random() * symbols.length)];
        animEl.textContent = `🎰 Spinning [ ${s1} | ${s2} | ${s3} ]`;
        scrollToBottom();
        await delay(750);
      }
      animEl.textContent = "🎰 Reels stopping into place...";
      await delay(450);
    } else if (cmd === "blackjack" || cmd === "bj" || cmd === "21") {
      animEl.textContent = "🃏 Dealing cards from the cyber deck...";
      scrollToBottom();
      await delay(450);
      animEl.textContent = "🃏 Dealer checking hole card...";
      scrollToBottom();
      await delay(450);
    } else {
      const spinners = ["[ ■□□□ ]", "[ ■■□□ ]", "[ ■■■□ ]", "[ ■■■■ ]"];
      for (let i = 0; i < spinners.length; i++) {
        animEl.textContent = `⚡ Executing... ${spinners[i]}`;
        scrollToBottom();
        await delay(200);
      }
    }

    animEl.remove();
  }

  async function executeTerminalCommand(rawCmd) {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    const baseCmd = cmd.split(/\s+/)[0].toLowerCase();

    const userLine = document.createElement("p");
    userLine.className = "term-echo";
    userLine.textContent = `> ${cmd}`;
    terminalOutput.appendChild(userLine);
    terminalInput.value = "";
    terminalOutput.scrollTop = terminalOutput.scrollHeight;

    if (baseCmd === "clear") {
      terminalOutput.innerHTML = "";
      return;
    }

    try {
      terminalInput.disabled = true;

      const apiPromise = fetch("/vault/terminal-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });

      const [res] = await Promise.all([apiPromise, runGameAnimation(baseCmd)]);
      const data = await res.json();

      const responseLine = document.createElement("pre");
      responseLine.className = "term-response";
      responseLine.textContent = data.output;
      terminalOutput.appendChild(responseLine);

      if (data.newBalance !== undefined) {
        const epEl = document.getElementById("liveUserEp");
        if (epEl) epEl.textContent = `${data.newBalance.toLocaleString()} EP`;
      }
    } catch (err) {
      const errorLine = document.createElement("p");
      errorLine.className = "danger-text";
      errorLine.textContent = "EXECUTION FAILURE: Vault handshake timeout.";
      terminalOutput.appendChild(errorLine);
    } finally {
      terminalInput.disabled = false;
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
  }

  if (terminalForm) {
    terminalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      executeTerminalCommand(terminalInput.value);
    });
  }

  quickChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const cmd = chip.getAttribute("data-cmd");
      if (cmd) executeTerminalCommand(cmd);
    });
  });
  // 5. PROTOCOL GUIDE SLIDER CONTROLLER
  const slides = document.querySelectorAll(".guide-slide");
  const dots = document.querySelectorAll(".dot-indicator");
  const prevBtn = document.querySelector(".prev-slide");
  const nextBtn = document.querySelector(".next-slide");
  const sliderTrack = document.querySelector(".guide-carousel-track");
  let currentSlide = 0;
  let autoSlideInterval = null;

  function showSlide(index) {
    if (!slides.length) return;

    if (index >= slides.length) currentSlide = 0;
    else if (index < 0) currentSlide = slides.length - 1;
    else currentSlide = index;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === currentSlide);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentSlide);
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    autoSlideInterval = setInterval(() => {
      showSlide(currentSlide + 1);
    }, 5000); // Rotates every 5 seconds
  }

  function stopAutoSlide() {
    if (autoSlideInterval) clearInterval(autoSlideInterval);
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener("click", () => {
      stopAutoSlide();
      showSlide(currentSlide - 1);
      startAutoSlide();
    });

    nextBtn.addEventListener("click", () => {
      stopAutoSlide();
      showSlide(currentSlide + 1);
      startAutoSlide();
    });
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      stopAutoSlide();
      showSlide(i);
      startAutoSlide();
    });
  });

  // Touch Swipe Support for Mobile
  if (sliderTrack) {
    let touchStartX = 0;
    let touchEndX = 0;

    sliderTrack.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoSlide();
      },
      { passive: true },
    );

    sliderTrack.addEventListener(
      "touchend",
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 45) {
          showSlide(currentSlide + 1); // Swiped Left
        } else if (touchEndX - touchStartX > 45) {
          showSlide(currentSlide - 1); // Swiped Right
        }
        startAutoSlide();
      },
      { passive: true },
    );
  }

  startAutoSlide();
  // SPONSOR SMARTLINK CLAIM ENGINE
  const sponsorBtn = document.getElementById("sponsorSmartlinkBtn");
  if (sponsorBtn) {
    const sponsorBtn = document.getElementById("sponsorSmartlinkBtn");
    if (sponsorBtn) {
      sponsorBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        const smartlinkUrl = sponsorBtn.getAttribute("data-link");
        if (
          smartlinkUrl &&
          !smartlinkUrl.includes(
            "https://www.effectivecpmnetwork.com/k1j016f20?key=15e55458273fd559135fec0d68541581",
          )
        ) {
          window.open(smartlinkUrl, "_blank", "noopener,noreferrer");
        }

        try {
          const res = await fetch("/vault/claim-sponsor-ep", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json();

          if (res.ok && data.success) {
            if (window.showFlash) window.showFlash(data.message, "success");
            const epEl = document.getElementById("liveUserEp");
            if (epEl)
              epEl.textContent = `${data.newBalance.toLocaleString()} EP`;

            sponsorBtn.disabled = true;
            sponsorBtn.className = "hotstar-btn disabled-btn";
            sponsorBtn.innerHTML = `<i class="fa-solid fa-check"></i> CLAIMED (+200 EP)`;
          } else {
            if (window.showFlash) window.showFlash(data.message, "error");
          }
        } catch (err) {
          if (window.showFlash)
            window.showFlash("Failed to connect to vault ledger.", "error");
        }
      });
    }
  }
});
