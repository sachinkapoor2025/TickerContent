import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink } from "react-router-dom";
import { LED_TEXT_FONT_STACK } from "@ticker-cms/composition";
import { AppShell, type ShellLinkProps } from "@ticker-cms/ui";
import { TickerDisplay } from "../components/TickerDisplay";
import {
  STIMULATE_COLORS,
  STIMULATE_DEFAULTS,
  STIMULATE_HEIGHT,
  buildStimulateDocument,
  canvasGlyphSupported,
  prepareStimulateMessage,
  replaceUnsupportedGraphemes,
  type StimulateAnimation,
  type StimulateColorId,
  type StimulateMode,
  type StimulateSettings,
} from "./stimulateDocument";
import {
  STIMULATE_BRAND_LABEL,
  STIMULATE_CONTEXT_LABEL,
  STIMULATE_HEADER_TITLE,
  STIMULATE_PAGE_DESCRIPTION,
  STIMULATE_PAGE_TITLE,
  STIMULATE_PUBLIC_NAV,
} from "./stimulateShell";
import "./stimulate.css";

function glyphSafeMessage(message: string): string {
  const probe = prepareStimulateMessage(message);
  if (typeof document === "undefined") return probe;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return probe;
  ctx.font = `bold ${STIMULATE_HEIGHT - 8}px ${LED_TEXT_FONT_STACK}`;
  return replaceUnsupportedGraphemes(probe, (grapheme) => canvasGlyphSupported(ctx, grapheme));
}

function StimulateLink({ to, end, className, children, title, onClick, "aria-label": ariaLabel }: ShellLinkProps) {
  return (
    <NavLink to={to} end={end} className={className} title={title} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </NavLink>
  );
}

function toggleClass(pressed: boolean) {
  return pressed ? "pp-btn pp-btn--primary" : "pp-btn pp-btn--ghost";
}

export function StimulatePage() {
  const [draft, setDraft] = useState<StimulateSettings>(STIMULATE_DEFAULTS);
  const [live, setLive] = useState<StimulateSettings>(STIMULATE_DEFAULTS);

  useEffect(() => {
    const previous = document.title;
    document.title = STIMULATE_PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  const documentModel = useMemo(
    () => buildStimulateDocument(live, glyphSafeMessage(live.message)),
    [live],
  );

  function stimulate(event: FormEvent) {
    event.preventDefault();
    setLive({ ...draft, message: prepareStimulateMessage(draft.message) });
  }

  return (
    <AppShell
      product="customer"
      brandLabel={STIMULATE_BRAND_LABEL}
      contextLabel={STIMULATE_CONTEXT_LABEL}
      headerTitle={STIMULATE_HEADER_TITLE}
      navItems={STIMULATE_PUBLIC_NAV}
      linkComponent={StimulateLink}
      showLogout={false}
    >
      <div className="top">
        <div>
          <h1>{STIMULATE_PAGE_TITLE}</h1>
          <p className="muted page-lead">{STIMULATE_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      <section className="stimulate-stage" aria-label="LED ticker">
        <TickerDisplay
          document={documentModel}
          scale="large"
          label="LED ticker"
          timeOffsetMs={live.animation === "scroll" ? 8_000 : 0}
        />
      </section>
      <form className="stimulate-controls" onSubmit={stimulate}>
        <label className="pp-field stimulate-message" htmlFor="stimulate-message">
          Message
          <input
            id="stimulate-message"
            className="pp-input"
            type="text"
            value={draft.message}
            placeholder="Happy Diwali! 🪔✨"
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
          />
        </label>
        <div className="stimulate-control-row">
          <fieldset className="stimulate-fieldset">
            <legend className="stimulate-legend">Display</legend>
            <div className="stimulate-segment" role="group" aria-label="Display">
              <button
                type="button"
                className={toggleClass(draft.mode === "full")}
                aria-pressed={draft.mode === "full"}
                onClick={() => setDraft((current) => ({ ...current, mode: "full" satisfies StimulateMode }))}
              >
                Full Color
              </button>
              <button
                type="button"
                className={toggleClass(draft.mode === "mono")}
                aria-pressed={draft.mode === "mono"}
                onClick={() => setDraft((current) => ({ ...current, mode: "mono" satisfies StimulateMode }))}
              >
                Mono
              </button>
            </div>
          </fieldset>
          <fieldset className="stimulate-fieldset">
            <legend className="stimulate-legend">Animation</legend>
            <div className="stimulate-segment" role="group" aria-label="Animation">
              <button
                type="button"
                className={toggleClass(draft.animation === "static")}
                aria-pressed={draft.animation === "static"}
                onClick={() => setDraft((current) => ({ ...current, animation: "static" satisfies StimulateAnimation }))}
              >
                Static
              </button>
              <button
                type="button"
                className={toggleClass(draft.animation === "scroll")}
                aria-pressed={draft.animation === "scroll"}
                onClick={() => setDraft((current) => ({ ...current, animation: "scroll" satisfies StimulateAnimation }))}
              >
                Scroll
              </button>
            </div>
          </fieldset>
        </div>
        {draft.mode === "full" ? (
          <fieldset className="stimulate-fieldset">
            <legend className="stimulate-legend">Color</legend>
            <div className="stimulate-swatches" role="group" aria-label="Color">
              {STIMULATE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className="pp-btn pp-btn--ghost stimulate-color"
                  aria-pressed={draft.colorId === color.id}
                  onClick={() => setDraft((current) => ({ ...current, colorId: color.id satisfies StimulateColorId }))}
                >
                  <span className="stimulate-dot" style={{ background: color.value }} />
                  {color.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <button className="pp-btn pp-btn--primary stimulate-go" type="submit">
          Stimulate
        </button>
      </form>
    </AppShell>
  );
}
