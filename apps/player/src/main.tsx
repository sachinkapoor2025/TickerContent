import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RenderResources } from "@ticker-cms/composition";
import { TickerDisplay } from "../../web/src/components/TickerDisplay";
import { AssetMediaSession } from "../../web/src/media/assetClient";
import { createLottieRenderer } from "../../web/src/media/lottieRenderer";
import { loadReferencedMedia } from "./loadMedia";
import {
  PLAYBACK_POLL_MS,
  errorView,
  fetchPlayback,
  interpretPlayback,
  playbackIdentity,
  readStoredToken,
  readTickerId,
  tickerColorMode,
  type PlaybackResponse,
  type PlayerView,
} from "./playback";
import "./styles.css";

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="player-shell">
      <p className="player-message">
        <strong>{title}</strong>
        {body}
      </p>
    </div>
  );
}

function Player() {
  const tickerId = readTickerId(window.location.search);
  const session = useMemo(
    () =>
      new AssetMediaSession({
        fetch: globalThis.fetch.bind(globalThis),
        getToken: () => readStoredToken(window.localStorage),
      }),
    [],
  );
  const [view, setView] = useState<PlayerView>(() => {
    if (!tickerId) return { kind: "need_ticker" };
    if (!readStoredToken(window.localStorage)) return { kind: "need_auth" };
    return { kind: "loading" };
  });
  const [resources, setResources] = useState<RenderResources>({});
  const identityRef = useRef("");

  useEffect(() => {
    if (!tickerId) return;
    let cancelled = false;

    const load = async () => {
      const token = readStoredToken(window.localStorage);
      if (!token) {
        setView({ kind: "need_auth" });
        return;
      }
      try {
        const { status, body } = await fetchPlayback(tickerId, { fetch: globalThis.fetch.bind(globalThis), token });
        if (cancelled) return;
        if (status !== 200) {
          const message = "error" in body ? body.error?.message : undefined;
          setView(errorView(status, message));
          setResources({});
          identityRef.current = "";
          return;
        }
        const playback = body as PlaybackResponse;
        const nextIdentity = playbackIdentity(playback);
        if (nextIdentity === identityRef.current) return;
        const next = interpretPlayback(playback);
        if (next.kind !== "ready") {
          identityRef.current = nextIdentity;
          setResources({});
          setView(next);
          return;
        }
        const media = await loadReferencedMedia(next.document, session);
        if (cancelled) return;
        identityRef.current = nextIdentity;
        setResources({
          images: media.images,
          renderLottie: createLottieRenderer(media.lottie),
        });
        setView(next);
      } catch {
        if (!cancelled) {
          setView({ kind: "error", message: "Unable to reach the playback API." });
          setResources({});
          identityRef.current = "";
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), PLAYBACK_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session, tickerId]);

  if (view.kind === "need_ticker") {
    return (
      <Message
        title="Ticker required"
        body="Open this player with ?tickerId=<ticker-id>. A ticker is not selected automatically."
      />
    );
  }
  if (view.kind === "need_auth") {
    return (
      <Message
        title="Sign in required"
        body="Sign in to the tenant app, then set ticker_cms_token in this origin’s local storage. The player does not use another user’s session."
      />
    );
  }
  if (view.kind === "loading") {
    return <Message title="Loading" body="Loading published playback…" />;
  }
  if (view.kind === "error") {
    return <Message title="Playback unavailable" body={view.message} />;
  }
  if (view.kind === "empty") {
    return (
      <div className="player-shell">
        <TickerDisplay
          document={null}
          profile={{
            width: view.ticker.width,
            height: view.ticker.height,
            colorMode: tickerColorMode(view.ticker.colorMode),
          }}
          scale="large"
          emptyMessage="No published content"
        />
        <p className="player-message">
          <strong>No published content</strong>
          {`${view.ticker.width}×${view.ticker.height} · ${view.ticker.colorMode}`}
        </p>
      </div>
    );
  }
  return (
    <div className="player-shell">
      <TickerDisplay
        document={view.document}
        resources={resources}
        scale="large"
        label="Published LED ticker"
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Player />
  </StrictMode>,
);
