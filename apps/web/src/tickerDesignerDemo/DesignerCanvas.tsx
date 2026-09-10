import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TickerDisplay } from "../components/TickerDisplay";
import {
  DESIGNER_ADD_ITEMS,
  DESIGNER_API_REFRESH_SECONDS,
  DESIGNER_API_TEST_TOAST,
  DESIGNER_COLORS,
  DESIGNER_OCCASIONS,
  applyEffectOccasion,
  buildDesignerDocument,
  connectDesignerApi,
  designerScrolling,
  effectsForOccasion,
  filterEmojiGroups,
  nodeKindLabel,
  nodeSummary,
  resolveFlowPlayback,
  type DesignerAnimationKind,
  type DesignerColorId,
  type DesignerColorMode,
  type DesignerEffectId,
  type DesignerNode,
  type DesignerNodeKind,
  type DesignerOccasion,
} from "./designerDocument";
import { DESIGNER_EMPTY_HINT, DESIGNER_PAGE_DESCRIPTION, DESIGNER_PAGE_TITLE, DESIGNER_SELECT_HINT } from "./designerShell";
import "./tickerDesignerDemo.css";

function toggleClass(pressed: boolean) {
  return pressed ? "pp-btn pp-btn--primary" : "pp-btn pp-btn--ghost";
}

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updateNode(nodes: DesignerNode[], id: string, patch: Partial<DesignerNode>): DesignerNode[] {
  return nodes.map((node) => (node.id === id ? ({ ...node, ...patch } as DesignerNode) : node));
}

function EmojiPalette({
  value,
  disabled,
  onPick,
}: {
  value: string;
  disabled?: boolean;
  onPick: (emoji: string) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => filterEmojiGroups(query), [query]);
  return (
    <div className="designer-emoji-palette">
      <label className="pp-field" htmlFor={searchId}>
        Search emoji
        <input
          id={searchId}
          className="pp-input"
          type="search"
          value={query}
          placeholder="Search emoji..."
          autoComplete="off"
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="designer-legend">Choose an emoji</p>
      {groups.length === 0 ? (
        <p className="muted designer-note">No emoji match that search.</p>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="designer-emoji-group">
            <p className="designer-emoji-group__label">{group.label}</p>
            <div className="designer-emoji-grid" role="group" aria-label={group.label}>
              {group.items.map((item) => (
                <button
                  key={`${group.id}-${item.glyph}`}
                  type="button"
                  className={toggleClass(value === item.glyph)}
                  aria-pressed={value === item.glyph}
                  aria-label={item.keywords[0] ? `${item.glyph} ${item.keywords[0]}` : item.glyph}
                  disabled={disabled}
                  onClick={() => onPick(item.glyph)}
                >
                  {item.glyph}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export type DesignerCanvasProps = {
  tickerName: string;
  tickerChip: string;
  width: number;
  height: number;
  nodes: DesignerNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNodesChange: (nodes: DesignerNode[]) => void;
  onAdd: (kind: DesignerNodeKind) => void;
  onRemove: (id: string) => void;
  onClearSelected: () => void;
  onClearAll: () => void;
  canEdit: boolean;
  canSave: boolean;
  canPublish: boolean;
  canSchedule: boolean;
  saving?: boolean;
  publishing?: boolean;
  scheduling?: boolean;
  onSave: () => void;
  onPublish: () => void;
  onScheduleSave: (start: string, end: string) => Promise<boolean> | boolean;
  onToast: (message: string) => void;
  toast: string;
  error?: string;
  scheduleError?: string;
  initialSchedule?: { start: string; end: string } | null;
  description?: string;
};

export function DesignerCanvas({
  tickerName,
  tickerChip,
  width,
  height,
  nodes,
  selectedId,
  onSelect,
  onNodesChange,
  onAdd,
  onRemove,
  onClearSelected,
  onClearAll,
  canEdit,
  canSave,
  canPublish,
  canSchedule,
  saving = false,
  publishing = false,
  scheduling = false,
  onSave,
  onPublish,
  onScheduleSave,
  onToast,
  toast,
  error,
  scheduleError,
  initialSchedule,
  description = DESIGNER_PAGE_DESCRIPTION,
}: DesignerCanvasProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStart, setScheduleStart] = useState(() => initialSchedule?.start || localDateTimeValue(new Date()));
  const [scheduleEnd, setScheduleEnd] = useState(
    () => initialSchedule?.end || localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const addWrapRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const addMenuId = useId();
  const scheduleTitleId = useId();
  const fieldId = useId();

  useEffect(() => {
    if (!initialSchedule) return;
    setScheduleStart(initialSchedule.start);
    setScheduleEnd(initialSchedule.end);
  }, [initialSchedule?.start, initialSchedule?.end]);

  useEffect(() => {
    if (!scheduleOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [scheduleOpen]);

  useLayoutEffect(() => {
    if (!addOpen) return;
    function placeMenu() {
      const plus = plusRef.current;
      const menu = menuRef.current;
      if (!plus || !menu) return;
      const rect = plus.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const gap = 8;
      const mobile = window.innerWidth <= 720;
      let left = mobile ? rect.left : rect.right + gap;
      let top = mobile ? rect.bottom + gap : rect.top;
      if (left + menuWidth > window.innerWidth - gap) left = Math.max(gap, rect.right - menuWidth);
      if (left < gap) left = gap;
      if (top + menuHeight > window.innerHeight - gap) top = Math.max(gap, rect.top - menuHeight - gap);
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.round(top)}px`;
    }
    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [addOpen]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!addWrapRef.current?.contains(event.target as Node)) setAddOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setAddOpen(false);
      setScheduleOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const playback = useMemo(() => resolveFlowPlayback(nodes), [nodes]);
  const documentModel = useMemo(() => buildDesignerDocument(playback, { width, height }), [playback, width, height]);
  const scrolling = designerScrolling(playback);
  const busy = saving || publishing || scheduling;

  async function saveSchedule() {
    const ok = await onScheduleSave(scheduleStart, scheduleEnd);
    if (ok) setScheduleOpen(false);
  }

  return (
    <div className="designer-page">
      <div className="designer-head">
        <div>
          <h1>{DESIGNER_PAGE_TITLE}</h1>
          <p className="muted page-lead">{description}</p>
        </div>
        <p className="designer-ticker-chip" aria-label={tickerChip} title={tickerName}>
          {tickerChip}
        </p>
      </div>
      {error ? (
        <p className="error designer-error" role="alert">
          {error}
        </p>
      ) : null}
      <section className="designer-stage" aria-label="LED ticker">
        <TickerDisplay
          document={documentModel}
          scale="large"
          label="LED ticker"
          timeOffsetMs={scrolling ? 8_000 : 0}
        />
      </section>
      <section className="designer-flow-wrap" aria-label="Your ticker flow">
        <p className="designer-kicker">Your ticker flow</p>
        <div className="designer-flow">
          {nodes.map((node, index) => (
            <div className="designer-flow__item" key={node.id}>
              {index > 0 ? (
                <span className="designer-connector" aria-hidden="true">
                  →
                </span>
              ) : null}
              <div className={`designer-node designer-node--${node.kind}${selectedId === node.id ? " is-selected" : ""}`}>
                <button
                  type="button"
                  className="designer-node__body"
                  aria-pressed={selectedId === node.id}
                  aria-label={`${nodeKindLabel(node.kind)} ${nodeSummary(node)}`}
                  onClick={() => onSelect(node.id)}
                >
                  <span className="designer-node__kind">{nodeKindLabel(node.kind)}</span>
                  <span className={`designer-node__value${node.kind === "emoji" && node.emoji ? " designer-node__value--emoji" : ""}`}>
                    {nodeSummary(node)}
                  </span>
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    className="designer-node__remove"
                    aria-label={`Remove ${nodeKindLabel(node.kind)} block`}
                    onClick={() => onRemove(node.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {canEdit ? (
            <div className="designer-flow__item designer-flow__add" ref={addWrapRef}>
              {nodes.length > 0 ? (
                <span className="designer-connector" aria-hidden="true">
                  →
                </span>
              ) : null}
              <button
                type="button"
                className="designer-plus"
                ref={plusRef}
                aria-expanded={addOpen}
                aria-controls={addMenuId}
                aria-haspopup="menu"
                aria-label="Add block"
                onClick={() => setAddOpen((open) => !open)}
              >
                <span aria-hidden="true">+</span>
                <span className="designer-plus__label">Add</span>
              </button>
              {addOpen ? (
                <div className="designer-add-menu" id={addMenuId} role="menu" aria-label="Add" ref={menuRef}>
                  <p className="designer-add-menu__title">Add</p>
                  {DESIGNER_ADD_ITEMS.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      role="menuitem"
                      className="designer-add-menu__item"
                      onClick={() => {
                        onAdd(item.kind);
                        setAddOpen(false);
                      }}
                    >
                      <span aria-hidden="true">{item.mark}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {nodes.length === 0 ? <p className="muted designer-empty">{DESIGNER_EMPTY_HINT}</p> : null}
      </section>
      {selected ? (
        <section className="designer-props" aria-label="Block settings">
          <p className="designer-kicker">Block settings</p>
          <h2>{nodeKindLabel(selected.kind)}</h2>
          {selected.kind === "text" ? (
            <label className="pp-field" htmlFor={`${fieldId}-text`}>
              Text
              <input
                id={`${fieldId}-text`}
                className="pp-input"
                type="text"
                value={selected.text}
                autoComplete="off"
                disabled={!canEdit}
                onChange={(event) => onNodesChange(updateNode(nodes, selected.id, { text: event.target.value }))}
              />
            </label>
          ) : null}
          {selected.kind === "emoji" ? (
            <EmojiPalette
              value={selected.emoji}
              disabled={!canEdit}
              onPick={(emoji) => onNodesChange(updateNode(nodes, selected.id, { emoji }))}
            />
          ) : null}
          {selected.kind === "animation" ? (
            <>
              <div className="designer-segment" role="group" aria-label="Animation">
                <button
                  type="button"
                  className={toggleClass(selected.animationKind === "static")}
                  aria-pressed={selected.animationKind === "static"}
                  disabled={!canEdit}
                  onClick={() =>
                    onNodesChange(updateNode(nodes, selected.id, { animationKind: "static" satisfies DesignerAnimationKind }))
                  }
                >
                  Static
                </button>
                <button
                  type="button"
                  className={toggleClass(selected.animationKind === "dynamic")}
                  aria-pressed={selected.animationKind === "dynamic"}
                  disabled={!canEdit}
                  onClick={() =>
                    onNodesChange(
                      updateNode(nodes, selected.id, { animationKind: "dynamic" satisfies DesignerAnimationKind }),
                    )
                  }
                >
                  Dynamic
                </button>
              </div>
              {selected.animationKind === "dynamic" ? (
                <>
                  <p className="designer-legend">Movement</p>
                  <div className="designer-segment" role="group" aria-label="Movement">
                    <button type="button" className="pp-btn pp-btn--primary" aria-pressed="true" disabled={!canEdit}>
                      Scroll
                    </button>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {selected.kind === "color" ? (
            <>
              <div className="designer-segment" role="group" aria-label="Color">
                <button
                  type="button"
                  className={toggleClass(selected.colorMode === "rgb")}
                  aria-pressed={selected.colorMode === "rgb"}
                  disabled={!canEdit}
                  onClick={() =>
                    onNodesChange(updateNode(nodes, selected.id, { colorMode: "rgb" satisfies DesignerColorMode }))
                  }
                >
                  RGB / Full Color
                </button>
                <button
                  type="button"
                  className={toggleClass(selected.colorMode === "mono")}
                  aria-pressed={selected.colorMode === "mono"}
                  disabled={!canEdit}
                  onClick={() =>
                    onNodesChange(updateNode(nodes, selected.id, { colorMode: "mono" satisfies DesignerColorMode }))
                  }
                >
                  Mono
                </button>
              </div>
              {selected.colorMode === "mono" ? (
                <>
                  <p className="designer-legend">LED color</p>
                  <div className="designer-swatches" role="group" aria-label="LED color">
                    {DESIGNER_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className="pp-btn pp-btn--ghost designer-color"
                        aria-pressed={selected.colorId === color.id}
                        disabled={!canEdit}
                        onClick={() =>
                          onNodesChange(updateNode(nodes, selected.id, { colorId: color.id satisfies DesignerColorId }))
                        }
                      >
                        <span className="designer-dot" style={{ background: color.value }} />
                        {color.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="muted designer-note">RGB keeps emoji colors. Mono uses one LED color.</p>
            </>
          ) : null}
          {selected.kind === "effect" ? (
            <>
              <p className="designer-legend">Occasion</p>
              <div className="designer-segment" role="group" aria-label="Occasion">
                {DESIGNER_OCCASIONS.map((occasion) => (
                  <button
                    key={occasion.id}
                    type="button"
                    className={toggleClass(selected.occasion === occasion.id)}
                    aria-pressed={selected.occasion === occasion.id}
                    disabled={!canEdit}
                    onClick={() =>
                      onNodesChange(
                        nodes.map((node) =>
                          node.id === selected.id && node.kind === "effect"
                            ? applyEffectOccasion(node, occasion.id satisfies DesignerOccasion)
                            : node,
                        ),
                      )
                    }
                  >
                    {occasion.label}
                  </button>
                ))}
              </div>
              <p className="designer-legend">Decoration</p>
              <div className="designer-segment" role="group" aria-label="Decoration">
                {effectsForOccasion(selected.occasion).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={toggleClass(selected.effect === option.id)}
                    aria-pressed={selected.effect === option.id}
                    aria-label={option.ready ? option.label : `${option.label} coming soon`}
                    disabled={!canEdit || !option.ready}
                    title={option.ready ? option.label : "Coming soon"}
                    onClick={() => {
                      if (!option.ready) return;
                      onNodesChange(updateNode(nodes, selected.id, { effect: option.id satisfies DesignerEffectId }));
                    }}
                  >
                    {option.mark} {option.label}
                    {option.ready ? null : <span className="designer-soon">Coming soon</span>}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {selected.kind === "api" ? (
            <>
              <label className="pp-field" htmlFor={`${fieldId}-api-url`}>
                API URL
                <input
                  id={`${fieldId}-api-url`}
                  className="pp-input"
                  type="url"
                  value={selected.url}
                  placeholder="Enter API URL"
                  autoComplete="off"
                  disabled={!canEdit}
                  onChange={(event) => onNodesChange(updateNode(nodes, selected.id, { url: event.target.value }))}
                />
              </label>
              <label className="pp-field" htmlFor={`${fieldId}-api-field`}>
                Data field
                <input
                  id={`${fieldId}-api-field`}
                  className="pp-input"
                  type="text"
                  value={selected.field}
                  placeholder="message"
                  autoComplete="off"
                  disabled={!canEdit}
                  onChange={(event) => onNodesChange(updateNode(nodes, selected.id, { field: event.target.value }))}
                />
              </label>
              <label className="pp-field" htmlFor={`${fieldId}-api-refresh`}>
                Refresh
                <select
                  id={`${fieldId}-api-refresh`}
                  className="pp-input"
                  value={selected.refreshSeconds}
                  disabled={!canEdit}
                  onChange={(event) =>
                    onNodesChange(updateNode(nodes, selected.id, { refreshSeconds: Number(event.target.value) }))
                  }
                >
                  {DESIGNER_API_REFRESH_SECONDS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds} sec
                    </option>
                  ))}
                </select>
              </label>
              <label className="pp-field" htmlFor={`${fieldId}-api-mock`}>
                Current value
                <input
                  id={`${fieldId}-api-mock`}
                  className="pp-input"
                  type="text"
                  value={selected.mockValue}
                  placeholder="Welcome to Photonplay"
                  autoComplete="off"
                  disabled={!canEdit}
                  onChange={(event) => onNodesChange(updateNode(nodes, selected.id, { mockValue: event.target.value }))}
                />
              </label>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                title="Demo only"
                disabled={!canEdit}
                onClick={() => {
                  onNodesChange(
                    nodes.map((node) => (node.id === selected.id && node.kind === "api" ? connectDesignerApi(node) : node)),
                  );
                  onToast(DESIGNER_API_TEST_TOAST);
                }}
              >
                Test Connection
              </button>
              {selected.connected ? (
                <p className="designer-connected">
                  ✓ Connected
                  <span className="designer-current">Current value: “{selected.mockValue || "empty"}”</span>
                </p>
              ) : (
                <p className="muted designer-note">Demo only. No live connection.</p>
              )}
            </>
          ) : null}
        </section>
      ) : nodes.length > 0 ? (
        <p className="muted designer-props-empty">{DESIGNER_SELECT_HINT}</p>
      ) : null}
      <div className="designer-actions">
        <div className="designer-actions__primary">
          <button type="button" className="pp-btn pp-btn--ghost" disabled={!canSave || busy} onClick={onSave}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" className="pp-btn pp-btn--primary" disabled={!canPublish || busy} onClick={onPublish}>
            {publishing ? "Publishing..." : "Save & Publish"}
          </button>
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            aria-haspopup="dialog"
            aria-expanded={scheduleOpen}
            disabled={!canSchedule || busy}
            onClick={() => setScheduleOpen(true)}
          >
            Schedule
          </button>
        </div>
        <div className="designer-actions__secondary">
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            disabled={!canEdit || !selected}
            title={selected ? "Remove the selected block" : "Select a block to clear"}
            aria-label="Clear selected block"
            onClick={onClearSelected}
          >
            Clear
          </button>
          <button
            type="button"
            className="pp-btn pp-btn--ghost"
            disabled={!canEdit}
            title="Remove every block"
            aria-label="Clear all blocks"
            onClick={onClearAll}
          >
            Clear All
          </button>
        </div>
      </div>
      {toast ? (
        <p className="designer-toast" role="status">
          {toast}
        </p>
      ) : null}
      {scheduleOpen ? (
        <div className="designer-modal" role="dialog" aria-modal="true" aria-labelledby={scheduleTitleId}>
          <button
            type="button"
            className="designer-modal__backdrop"
            aria-label="Close schedule"
            onClick={() => setScheduleOpen(false)}
          />
          <div className="designer-modal__panel">
            <div className="designer-modal__head">
              <h2 id={scheduleTitleId}>Schedule Ticker</h2>
              <button
                type="button"
                className="designer-modal__close"
                aria-label="Close"
                onClick={() => setScheduleOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="pp-field" htmlFor={`${fieldId}-start`}>
              Start
              <input
                id={`${fieldId}-start`}
                className="pp-input"
                type="datetime-local"
                value={scheduleStart}
                onChange={(event) => setScheduleStart(event.target.value)}
              />
            </label>
            <label className="pp-field" htmlFor={`${fieldId}-end`}>
              End
              <input
                id={`${fieldId}-end`}
                className="pp-input"
                type="datetime-local"
                value={scheduleEnd}
                onChange={(event) => setScheduleEnd(event.target.value)}
              />
            </label>
            {scheduleError ? (
              <p className="error" role="alert">
                {scheduleError}
              </p>
            ) : null}
            <div className="designer-modal__actions">
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setScheduleOpen(false)}>
                Cancel
              </button>
              <button type="button" className="pp-btn pp-btn--primary" disabled={scheduling} onClick={() => void saveSchedule()}>
                {scheduling ? "Saving..." : "Save Schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
