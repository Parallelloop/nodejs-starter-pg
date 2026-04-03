import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';

// Configure Stealth Plugin — deletions are REQUIRED for Google Meet
const stealth = StealthPlugin();
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteer.use(stealth);

// Stores active bot metadata
export const activeBotSessions = new Map();

/**
 * Launch the Kore Note Taker bot as a guest
 */
export const launchBot = async (meetingUrl, sessionId) => {
  try {
    console.log(`[MeetBot] Starting guest session ${sessionId} for ${meetingUrl}`);

    const browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-gpu',
        '--window-size=1280,720',
        '--window-position=-2400,-2400',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });

    // Get actual browser version and set matching user agent
    const version = await browser.version();
    const chromeVersion = version.match(/Chrome\/(\d+)/)?.[1] || '131';
    console.log(`[MeetBot] Browser version: ${version} (Chrome ${chromeVersion})`);

    const pages = await browser.pages();
    const page = pages[0];

    // Set user agent matching the REAL Chromium version
    await page.setUserAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`);

    // Remove webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    // Grant permissions for mic and camera
    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);

    // Store in global activity map
    activeBotSessions.set(sessionId, {
      browser,
      page,
      meetingUrl,
      sessionId,
      captions: [],
      isRunning: true,
      hasJoined: false
    });

    // Run the full join flow
    await joinMeeting(page, meetingUrl, sessionId);
  } catch (err) {
    console.error(`[MeetBot] Error launching bot:`, err.message);
    await onMeetingEnd(sessionId);
  }
};

/**
 * Full join flow with state machine
 */
async function joinMeeting(page, meetingUrl, sessionId) {
  const MAX_ATTEMPTS = 10;
  const botName = process.env.BOT_NAME || "KORE Notetaker";
  let hasClickedJoin = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[MeetBot] Join attempt ${attempt}/${MAX_ATTEMPTS} for ${sessionId}`);

    try {
      // Only navigate if we haven't clicked join yet, or if we were blocked
      if (!hasClickedJoin) {
        await page.goto(meetingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(3000);
      }

      // Dismiss banners
      await dismissBanners(page);

      // Check page state
      const state = await getPageState(page);
      console.log(`[MeetBot] Page state: ${state}`);

      if (state === 'JOINED') {
        console.log(`[MeetBot] In meeting!`);
        await onJoinSuccess(page, sessionId);
        return;
      }

      if (state === 'BLOCKED') {
        console.log(`[MeetBot] Blocked on attempt ${attempt}. Waiting 8s...`);
        hasClickedJoin = false; // Need to re-navigate
        await sleep(8000);
        continue;
      }

      if (state === 'ASKING') {
        // Already asking to be let in — just wait, do NOT reload
        console.log(`[MeetBot] Waiting for host to admit us...`);
        const result = await waitForPostClickState(page, 120000);
        if (result === 'JOINED') {
          console.log(`[MeetBot] Admitted! Joined meeting for session ${sessionId}!`);
          await onJoinSuccess(page, sessionId);
          return;
        }
        hasClickedJoin = false;
        continue;
      }

      // state === 'LOBBY' or 'UNKNOWN' — try to join

      // Fill in bot name
      await fillBotName(page, botName);

      // Mute mic and camera
      await muteMicAndCamera(page);

      // Click "Join now"
      const clickResult = await clickJoinButton(page);
      console.log(`[MeetBot] Click result: ${clickResult}`);
      hasClickedJoin = true;

      // Wait for post-click state (up to 2 min for host to admit)
      const postClickState = await waitForPostClickState(page, 120000);

      if (postClickState === 'JOINED') {
        console.log(`[MeetBot] Successfully joined meeting for session ${sessionId}!`);
        await onJoinSuccess(page, sessionId);
        return;
      }

      if (postClickState === 'BLOCKED') {
        console.log(`[MeetBot] Blocked after clicking join. Will retry...`);
        hasClickedJoin = false;
        await sleep(3000);
        continue;
      }

      console.log(`[MeetBot] Timed out waiting for admission on attempt ${attempt}.`);
      hasClickedJoin = false;

    } catch (err) {
      console.error(`[MeetBot] Attempt ${attempt} error:`, err.message);
      hasClickedJoin = false;
      await sleep(3000);
    }
  }

  console.error(`[MeetBot] All ${MAX_ATTEMPTS} join attempts failed for ${sessionId}. Giving up.`);
  await onMeetingEnd(sessionId);
}

/**
 * Detect the current state of the Google Meet page
 */
async function getPageState(page) {
  try {
    return await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      if (document.querySelector('[aria-label="Leave call"]')) return 'JOINED';
      if (bodyText.includes("You can't join this video call")) return 'BLOCKED';
      if (bodyText.includes("Asking to be let in") || bodyText.includes("asking to be let in") ||
          bodyText.includes("waiting to be let in")) return 'ASKING';
      const hasNameInput = !!document.querySelector('input[aria-label="Your name"]') ||
                           !!document.querySelector('input[placeholder="Your name"]');
      const hasJoinBtn = Array.from(document.querySelectorAll('button')).some(btn => {
        const t = (btn.innerText || "").toLowerCase();
        return t.includes("join now") || t.includes("ask to join");
      });
      if (hasNameInput || hasJoinBtn) return 'LOBBY';
      return 'UNKNOWN';
    });
  } catch (e) {
    return 'UNKNOWN';
  }
}

/**
 * After clicking join, poll page state without navigation.
 * Returns: 'JOINED', 'BLOCKED', or 'TIMEOUT'
 */
async function waitForPostClickState(page, timeoutMs) {
  const start = Date.now();
  let lastState = '';

  while (Date.now() - start < timeoutMs) {
    try {
      const state = await getPageState(page);

      if (state !== lastState) {
        console.log(`[MeetBot] Post-click state: ${state}`);
        lastState = state;
      }

      if (state === 'JOINED') return 'JOINED';
      if (state === 'BLOCKED') return 'BLOCKED';
    } catch (e) { }

    await sleep(2000);
  }

  return 'TIMEOUT';
}

/**
 * Dismiss browser warnings and popups
 */
async function dismissBanners(page) {
  try {
    const dismissBtn = await page.$('button[aria-label="Dismiss"]');
    if (dismissBtn) {
      await dismissBtn.click();
      await sleep(500);
    }

    const gotItBtns = await page.$x('//button[contains(., "Got it")]');
    if (gotItBtns.length > 0) {
      await gotItBtns[0].click();
      await sleep(500);
    }
  } catch (e) { }
}

/**
 * Fill the bot name in the guest name input
 */
async function fillBotName(page, botName) {
  const nameSelectors = [
    'input[aria-label="Your name"]',
    'input[placeholder="Your name"]',
    'input[type="text"]'
  ];

  for (const sel of nameSelectors) {
    try {
      const input = await page.waitForSelector(sel, { timeout: 5000, visible: true });
      if (!input) continue;

      await page.click(sel, { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type(sel, botName, { delay: 30 });
      console.log(`[MeetBot] Typed "${botName}" into ${sel}`);
      await sleep(500);
      return;
    } catch (e) { }
  }
}

/**
 * Mute mic and camera
 */
async function muteMicAndCamera(page) {
  try {
    const micBtn = await page.$('button[aria-label*="Turn off microphone"]');
    if (micBtn) await micBtn.click().catch(() => { });
    const camBtn = await page.$('button[aria-label*="Turn off camera"]');
    if (camBtn) await camBtn.click().catch(() => { });
  } catch (e) { }
}

/**
 * Click the Join button — 4 strategies + Enter fallback
 */
async function clickJoinButton(page) {
  await sleep(1000);

  // Strategy 1: Exact span class used by Google for "Join now"
  try {
    const clicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span.UywwFc-vQzf8d'));
      for (const span of spans) {
        const txt = (span.textContent || "").trim().toLowerCase();
        if (txt === "join now" || txt === "ask to join") {
          const btn = span.closest('button');
          if (btn) { btn.click(); return txt; }
        }
      }
      return null;
    });
    if (clicked) return `span_class:${clicked}`;
  } catch (e) { }

  // Strategy 2: XPath
  for (const text of ["Join now", "Ask to join"]) {
    try {
      const buttons = await page.$x(`//button[contains(., "${text}")]`);
      if (buttons.length > 0) { await buttons[0].click(); return `xpath:${text}`; }
    } catch (e) { }
  }

  // Strategy 3: Generic button scan
  try {
    const clicked = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      for (const btn of allButtons) {
        const text = (btn.innerText || btn.textContent || "").toLowerCase().trim();
        if ((text.includes("join now") || text === "join" || text.includes("ask to join")) && !text.includes("other")) {
          btn.click(); return text;
        }
      }
      return null;
    });
    if (clicked) return `generic:${clicked}`;
  } catch (e) { }

  // Strategy 4: Enter key fallback
  console.log(`[MeetBot] Pressing Enter as join fallback...`);
  await page.keyboard.press('Tab');
  await sleep(200);
  await page.keyboard.press('Enter');
  return 'enter_fallback';
}

/**
 * Called once the bot has successfully joined
 */
async function onJoinSuccess(page, sessionId) {
  const current = activeBotSessions.get(sessionId);
  if (!current) return;

  current.hasJoined = true;

  // Enable captions
  await enableCaptions(page);

  // Start the MutationObserver-based caption scraper (Recall.ai approach)
  await startMutationObserverScraper(page, sessionId);

  // Start end watcher
  watchForMeetingEnd(sessionId);
}

/**
 * Enable Google Meet's native captions via keyboard shortcut + button click fallback
 */
async function enableCaptions(page) {
  try {
    console.log(`[MeetBot] Enabling captions...`);

    // Dismiss any overlays first
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await sleep(300);
    }

    // Method 1: Press 'c' shortcut (toggles captions in Google Meet)
    await page.keyboard.press('c');
    await sleep(2000);

    // Check if captions container appeared
    let captionsOn = await page.evaluate(() => {
      return !!document.querySelector('[aria-live="polite"]') ||
             !!document.querySelector('[jsname="dsyhDe"]');
    });

    if (!captionsOn) {
      // Method 2: Click "Turn on captions" button
      try {
        const ccBtns = await page.$x('//button[contains(@aria-label, "captions")]');
        if (ccBtns.length > 0) {
          await ccBtns[0].click();
          await sleep(1000);
        }
      } catch (e) { }
    }

    console.log(`[MeetBot] Captions enabled.`);
  } catch (err) {
    console.error(`[MeetBot] Error enabling captions:`, err.message);
  }
}

/**
 * MutationObserver-based caption scraper (Recall.ai approach)
 * Instead of polling the DOM, we inject a MutationObserver that
 * watches for caption updates and calls back to Node.js in real time.
 */
async function startMutationObserverScraper(page, sessionId) {
  const current = activeBotSessions.get(sessionId);
  if (!current) return;

  // Expose a callback function that the browser-side observer will call
  try {
    await page.exposeFunction('onCaptionReceived', async (speaker, text) => {
      const session = activeBotSessions.get(sessionId);
      if (!session || !session.isRunning) return;

      const trimmedText = (text || "").trim();
      if (!trimmedText) return;

      // Skip system messages
      const lower = trimmedText.toLowerCase();
      if (/you left the meeting|return to home screen|leave call|feedback|audio and video|learn more/.test(lower)) return;

      const trimmedSpeaker = (speaker || "Unknown").trim();

      // Deduplicate: only add if different from last caption
      const last = session.captions[session.captions.length - 1];
      if (last && last.speaker === trimmedSpeaker && last.text === trimmedText) return;

      // Update or append
      if (last && last.speaker === trimmedSpeaker && trimmedText.startsWith(last.text)) {
        // Same speaker, text is growing — update the last entry
        last.text = trimmedText;
      } else {
        session.captions.push({ speaker: trimmedSpeaker, text: trimmedText });
      }

      console.log(`[Caption] ${trimmedSpeaker}: ${trimmedText}`);

      // Send live update
      try {
        await axios.post(process.env.APP_WEBHOOK_URL, {
          sessionId,
          isLive: true,
          captions: [{ speaker: trimmedSpeaker, text: trimmedText }]
        });
      } catch (e) { }
    });
  } catch (e) {
    // exposeFunction may fail if already exposed from a previous navigation
    console.log(`[MeetBot] Caption callback already exposed or error: ${e.message}`);
  }

  // Wait for the caption region to appear
  try {
    await page.waitForSelector('[aria-live]', { timeout: 10000 });
    console.log(`[MeetBot] Caption region detected.`);
  } catch (e) {
    console.log(`[MeetBot] No [aria-live] region found. Captions may not be active.`);
  }

  // Inject the MutationObserver into the page
  await page.evaluate(() => {
    // Known selectors for speaker name badges
    const speakerSelectors = '.NWpY1d, .zs7s8d, .xoMHSc';
    let lastSpeaker = 'Unknown';

    // Extract speaker name from a caption element
    const getSpeaker = (node) => {
      const badge = node.querySelector(speakerSelectors);
      const speaker = badge ? badge.textContent.trim() : null;
      return speaker || lastSpeaker;
    };

    // Extract caption text (remove speaker badge text)
    const getText = (node) => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll(speakerSelectors).forEach(el => el.remove());
      return (clone.textContent || "").trim();
    };

    // Send caption to Node.js
    const sendCaption = (node) => {
      if (!(node instanceof HTMLElement)) return;
      const text = getText(node);
      const speaker = getSpeaker(node);
      if (text && text.toLowerCase() !== speaker.toLowerCase()) {
        lastSpeaker = speaker;
        window.onCaptionReceived(speaker, text);
      }
    };

    // Watch entire body for caption DOM changes
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        // New caption elements added
        m.addedNodes.forEach(n => {
          if (n instanceof HTMLElement) sendCaption(n);
        });
        // Text content changed in existing captions
        if (m.type === 'characterData' && m.target && m.target.parentElement) {
          sendCaption(m.target.parentElement);
        }
      }
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });

    console.log('[MeetBot] MutationObserver caption scraper installed.');
  });

  console.log(`[MeetBot] MutationObserver caption scraper active for session ${sessionId}.`);
}

/**
 * Monitor for meeting end (only after joined)
 */
function watchForMeetingEnd(sessionId) {
  const session = activeBotSessions.get(sessionId);
  if (!session) return;

  session.endWatcherInterval = setInterval(async () => {
    const current = activeBotSessions.get(sessionId);
    if (!current || !current.isRunning || !current.hasJoined) return;

    try {
      const ended = await current.page.evaluate(() => {
        const bodyText = document.body.innerText || "";
        return bodyText.includes('You left the meeting') || bodyText.includes('The meeting has ended');
      });
      if (ended) await onMeetingEnd(sessionId);
    } catch (e) { }
  }, 5000);
}

/**
 * Handle session termination and data persistence
 */
export async function onMeetingEnd(sessionId) {
  const session = activeBotSessions.get(sessionId);
  if (!session) return;

  session.isRunning = false;
  if (session.scraperInterval) clearInterval(session.scraperInterval);
  if (session.endWatcherInterval) clearInterval(session.endWatcherInterval);

  try {
    const conversation = session.captions.map(c => `${c.speaker}: ${c.text}`).join('\n');
    console.log(`[MeetBot] Meeting ended for ${sessionId}. ${session.captions.length} captions captured.`);
    console.log(`[MeetBot] Conversation preview: ${conversation.substring(0, 200)}`);

    await axios.post(process.env.APP_WEBHOOK_URL, {
      sessionId,
      isLive: false,
      conversation,
      endedAt: new Date().toISOString()
    }).catch(err => console.error(`[MeetBot] Webhook failed:`, err.message));

    if (session.browser) {
      await session.browser.close();
    }
    activeBotSessions.delete(sessionId);
  } catch (err) {
    console.error(`[MeetBot] Cleanup error:`, err.message);
  }
}

/**
 * Programmatic leave
 */
export async function leaveBot(sessionId) {
  const session = activeBotSessions.get(sessionId);
  if (!session || !session.page) return;
  try {
    await session.page.evaluate(() => {
      const leaveBtn = document.querySelector('[aria-label="Leave call"]');
      if (leaveBtn) leaveBtn.click();
    });
    await sleep(1000);
    await onMeetingEnd(sessionId);
  } catch (e) {
    await onMeetingEnd(sessionId);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
