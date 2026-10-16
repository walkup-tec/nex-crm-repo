export const NEX_DEPLOY_WATCH_STYLE = `
#nex-deploy-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(1,3,23,.92);backdrop-filter:blur(6px)}
#nex-deploy-overlay[hidden]{display:none!important}
.nex-deploy-overlay-card{max-width:22rem;width:100%;padding:28px 24px 24px;border-radius:18px;border:1px solid rgba(111,2,253,.35);background:linear-gradient(165deg,#160b2e 0%,#0c0618 100%);color:#f8fafc;text-align:center;box-shadow:0 24px 48px rgba(0,0,0,.45);font-family:Manrope,system-ui,sans-serif;transition:border-color .35s ease,box-shadow .35s ease}
.nex-deploy-overlay-card.is-stabilizing{border-color:rgba(0,234,253,.45);box-shadow:0 24px 48px rgba(0,0,0,.45),0 0 32px rgba(111,2,253,.18)}
.nex-deploy-visual{margin-bottom:18px}
.nex-deploy-spinner{width:56px;height:56px;margin:0 auto 16px;border-radius:50%;border:2px solid rgba(111,2,253,.2);border-top-color:#00eafd;animation:nex-deploy-orbit 1.2s linear infinite}
.nex-deploy-progress-track{height:4px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;margin:0 auto;max-width:180px}
.nex-deploy-progress-bar{height:100%;width:42%;border-radius:inherit;background:linear-gradient(90deg,#6f02fd,#00eafd,#6f02fd);background-size:200% 100%;animation:nex-deploy-progress-slide 1.35s ease-in-out infinite}
.nex-deploy-overlay-card.is-stabilizing .nex-deploy-progress-bar{width:100%;animation:nex-deploy-progress-fill .9s ease-out forwards}
.nex-deploy-overlay-card.is-complete .nex-deploy-spinner{border-top-color:#00eafd;animation:none}
.nex-deploy-title{margin:0 0 12px;font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#00eafd}
.nex-deploy-overlay-card p{margin:0 0 10px;color:#cbd5e1;line-height:1.55;font-size:.92rem}
.nex-deploy-overlay-accent{margin-bottom:0!important;color:#c4b5fd!important;font-size:.88rem}
@keyframes nex-deploy-orbit{to{transform:rotate(360deg)}}
@keyframes nex-deploy-progress-slide{0%{transform:translateX(-120%);background-position:0% 50%}100%{transform:translateX(280%);background-position:100% 50%}}
@keyframes nex-deploy-progress-fill{from{transform:translateX(-8%)}to{transform:translateX(0)}}
`;

export const NEX_DEPLOY_WATCH_SCRIPT = `
(function () {
  var POLL_MS = 2000;
  var DEPLOY_WATCH_MS = 8000;
  var STABLE_PROBES_REQUIRED = 3;
  var STABLE_COMPLETE_MS = 500;
  var FORCE_COMPLETE_MS = 90000;
  var pollTimer = null;
  var pollStartedAt = 0;
  var deployRecoveryActive = false;
  var stableProbeStreak = 0;
  var sawDeploySignal = false;
  var baselineDeployMarker = "";
  var baselineServerBootId = "";

  function isProductionDeployHost() {
    var host = String(window.location.hostname || "").toLowerCase();
    if (!host || host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
    if (/^(192\\.168\\.|10\\.|172\\.(1[6-9]|2[0-9]|3[0-1])\\.)/.test(host)) return false;
    return host === "app.nexmeta.com.br" || host.endsWith(".nexmeta.com.br");
  }

  function isGatewayStatus(status) {
    return status === 502 || status === 503 || status === 504;
  }

  function isDeployShutdownSignal(payload) {
    return Boolean(payload && payload.shuttingDown === true);
  }

  function ensureOverlay() {
    var existing = document.getElementById("nex-deploy-overlay");
    if (existing) return existing;
    if (!document.body) return null;
    var el = document.createElement("div");
    el.id = "nex-deploy-overlay";
    el.setAttribute("hidden", "");
    el.innerHTML =
      '<div class="nex-deploy-overlay-card" role="status" aria-live="polite" aria-busy="true">' +
      '<div class="nex-deploy-visual" aria-hidden="true">' +
      '<div class="nex-deploy-spinner"></div>' +
      '<div class="nex-deploy-progress-track"><div class="nex-deploy-progress-bar"></div></div>' +
      "</div>" +
      '<h1 class="nex-deploy-title">ATUALIZANDO O SISTEMA</h1>' +
      '<p id="nex-deploy-overlay-message">Estamos aplicando melhorias para oferecer uma experiência cada vez melhor.</p>' +
      '<p class="nex-deploy-overlay-accent">Em poucos segundos sua tela será atualizada automaticamente e você poderá continuar normalmente.</p>' +
      "</div>";
    document.body.appendChild(el);
    return el;
  }

  function setOverlayPhase(phase) {
    var card = document.querySelector("#nex-deploy-overlay .nex-deploy-overlay-card");
    if (!card) return;
    card.classList.remove("is-stabilizing", "is-complete");
    if (phase === "stabilizing") card.classList.add("is-stabilizing");
    if (phase === "complete") card.classList.add("is-complete");
  }

  function showDeployOverlay(message, phase) {
    if (!isProductionDeployHost()) return;
    var el = ensureOverlay();
    if (!el) return;
    var msgEl = document.getElementById("nex-deploy-overlay-message");
    if (msgEl) msgEl.textContent = message || "Estamos aplicando melhorias para oferecer uma experiência cada vez melhor.";
    setOverlayPhase(phase || "deploying");
    el.removeAttribute("hidden");
  }

  function rememberDeployBaseline(probe) {
    if (!probe) return;
    if (probe.deployMarker) baselineDeployMarker = String(probe.deployMarker);
    if (probe.serverBootId) baselineServerBootId = String(probe.serverBootId);
  }

  function hasDeployMarkerDrift(probe) {
    if (!probe || !probe.stable) return false;
    var nextMarker = String(probe.deployMarker || "");
    return Boolean(baselineDeployMarker && nextMarker && nextMarker !== baselineDeployMarker);
  }

  function hasDeployVersionDrift(probe) {
    if (hasDeployMarkerDrift(probe)) return true;
    if (!sawDeploySignal || !probe || !probe.stable) return false;
    var nextBootId = String(probe.serverBootId || "");
    return Boolean(baselineServerBootId && nextBootId && nextBootId !== baselineServerBootId);
  }

  async function probeHealthDetailed() {
    try {
      var response = await fetch("/health", { cache: "no-store", credentials: "same-origin" });
      var data = null;
      try { data = await response.json(); } catch (error) { data = null; }
      if (isDeployShutdownSignal(data)) return { stable: false, deploySignal: true, reason: "shutdown" };
      if (isGatewayStatus(response.status)) return { stable: false, deploySignal: false, reason: "gateway" };
      if (!response.ok || !data || data.ok !== true) return { stable: false, deploySignal: false, reason: "unhealthy" };
      try {
        var readyRes = await fetch("/ready", { cache: "no-store", credentials: "same-origin" });
        var readyData = null;
        try { readyData = await readyRes.json(); } catch (error) { readyData = null; }
        if (readyData && readyData.shuttingDown === true) return { stable: false, deploySignal: true, reason: "shutdown" };
        if (!readyRes.ok || !readyData || readyData.ready !== true) return { stable: false, deploySignal: false, reason: "not_ready" };
      } catch (error) {
        return { stable: false, deploySignal: false, reason: "ready_unreachable" };
      }
      return {
        stable: true,
        deploySignal: false,
        reason: "ok",
        deployMarker: String(data.deployMarker || ""),
        serverBootId: String(data.serverBootId || ""),
      };
    } catch (error) {
      return { stable: false, deploySignal: false, reason: "network" };
    }
  }

  function completeDeployRecovery() {
    setOverlayPhase("complete");
    window.setTimeout(function () { window.location.reload(); }, STABLE_COMPLETE_MS);
  }

  function shouldCompleteDeployAfterStableProbe(probe) {
    if (!probe || !probe.stable || !sawDeploySignal) return false;
    if (hasDeployVersionDrift(probe)) return true;
    return pollStartedAt > 0;
  }

  async function pollUntilReady(force) {
    if (!isProductionDeployHost()) return;
    if (force) deployRecoveryActive = true;
    if (!deployRecoveryActive) return;
    if (!force && pollTimer) return;
    if (!pollStartedAt || force) {
      pollStartedAt = Date.now();
      stableProbeStreak = 0;
    }
    showDeployOverlay();
    var probe = await probeHealthDetailed();
    if (probe.deploySignal) sawDeploySignal = true;
    if (probe.stable && shouldCompleteDeployAfterStableProbe(probe)) {
      stableProbeStreak += 1;
      setOverlayPhase("stabilizing");
      if (stableProbeStreak >= STABLE_PROBES_REQUIRED || Date.now() - pollStartedAt >= FORCE_COMPLETE_MS) {
        completeDeployRecovery();
        return;
      }
    } else {
      stableProbeStreak = 0;
      setOverlayPhase(probe.deploySignal ? "deploying" : "waiting");
      if (pollStartedAt && Date.now() - pollStartedAt >= 120000) {
        showDeployOverlay("A atualização está demorando mais que o usual. Continuamos verificando automaticamente — aguarde nesta tela.", "long_wait");
      }
    }
    pollTimer = setTimeout(function () {
      pollTimer = null;
      void pollUntilReady(false);
    }, POLL_MS);
  }

  function startDeployRecovery(force, reason) {
    if (!isProductionDeployHost()) return;
    var allowed = force === true || reason === "shutdown" || reason === "marker_drift" || sawDeploySignal === true;
    if (!allowed) return;
    sawDeploySignal = true;
    deployRecoveryActive = true;
    void pollUntilReady(!!force);
  }

  async function watchDeployInBackground() {
    if (!isProductionDeployHost() || deployRecoveryActive) return;
    var probe = await probeHealthDetailed();
    if (probe.deploySignal) {
      startDeployRecovery(false, "shutdown");
      return;
    }
    if (probe.stable && hasDeployMarkerDrift(probe)) {
      startDeployRecovery(true, "marker_drift");
      return;
    }
    rememberDeployBaseline(probe);
  }

  if ("serviceWorker" in navigator && isProductionDeployHost()) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/nex-deploy-sw.js?v=1", { scope: "/" }).catch(function () {});
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!isProductionDeployHost()) return;
    void probeHealthDetailed().then(function (probe) {
      rememberDeployBaseline(probe);
      if (probe.deploySignal) {
        startDeployRecovery(false, "shutdown");
        return;
      }
      window.setInterval(function () { void watchDeployInBackground(); }, DEPLOY_WATCH_MS);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") void watchDeployInBackground();
      });
    });
  });
})();
`;
