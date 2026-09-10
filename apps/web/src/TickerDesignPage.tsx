import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  DESIGNER_PUBLISH_TOAST,
  DESIGNER_SAVE_TOAST,
  DESIGNER_SCHEDULE_TOAST,
  DESIGNER_TOAST_MS,
  appendDesignerNode,
  clearAllNodes,
  clearSelectedNode,
  createInitialFlow,
  nextSelectedId,
  removeDesignerNode,
  type DesignerNode,
  type DesignerNodeKind,
} from "./tickerDesignerDemo/designerDocument";
import { DesignerCanvas } from "./tickerDesignerDemo/DesignerCanvas";
import { DESIGNER_PAGE_TITLE } from "./tickerDesignerDemo/designerShell";
import type { CampaignRecord } from "./campaignData";
import type { ContentRecord } from "./contentData";
import {
  TICKER_CREATE_SUCCESS,
  TICKER_DETAIL_ERROR_MESSAGE,
  TICKER_DETAIL_LOADING_MESSAGE,
  type TickerPlayback,
  type TickerRecord,
} from "./tickerData";
import {
  TICKER_DESIGN_LEGACY_PUBLISH,
  TICKER_DESIGN_PUBLISH_ERROR,
  TICKER_DESIGN_SAVE_ERROR,
  TICKER_DESIGN_SCHEDULE_ERROR,
  buildTickerScheduleRequest,
  contentBelongsToTickerDesign,
  designerSaveBody,
  emptyDesignerWouldReplaceLegacy,
  findTickerSchedule,
  isoToDatetimeLocal,
  loadedDesignerNodes,
  nextDesignerNodeSeq,
  selectTickerDesignContent,
  storedDesignerDocument,
  tickerDesignTitle,
  tickerDesignerChip,
  tickerDesignerActions,
  tickerPublishBody,
} from "./tickerDesign/tickerDesignPersistence";

type DesignLocationState = {
  tickerCreated?: boolean;
};

type SavedContent = {
  id: string;
  title: string;
  publishedVersionId?: string | null;
  document?: unknown;
};

export function TickerDesignPage() {
  const { id } = useParams();
  const location = useLocation();
  const access = useCustomerAccess();
  const actions = tickerDesignerActions(undefined, access);
  const { canWriteContent, canPublish, canManageCampaigns } = access;
  const created = Boolean((location.state as DesignLocationState | null)?.tickerCreated);
  const [ticker, setTicker] = useState<TickerRecord | null>(null);
  const [nodes, setNodes] = useState<DesignerNode[]>(createInitialFlow);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<SavedContent | null>(null);
  const [playbackDocument, setPlaybackDocument] = useState<unknown>(null);
  const [contentsCatalog, setContentsCatalog] = useState<ContentRecord[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [initialSchedule, setInitialSchedule] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [toast, setToast] = useState(created ? TICKER_CREATE_SUCCESS : "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const nodeSeq = useRef(0);

  useEffect(() => {
    const previous = document.title;
    document.title = DESIGNER_PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), DESIGNER_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    if (!id) {
      setTicker(null);
      setLoadError(TICKER_DETAIL_ERROR_MESSAGE);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    setError("");
    try {
      const row = await api<TickerRecord>(`/v1/tickers/${id}`);
      let playback: TickerPlayback | null = null;
      try {
        playback = await api<TickerPlayback>(`/v1/playback/tickers/${id}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }

      let details: ContentRecord[] = [];
      try {
        const list = await api<{ items: ContentRecord[] }>("/v1/contents");
        const items = Array.isArray(list.items) ? list.items : [];
        details = await Promise.all(
          items
            .filter((item): item is ContentRecord & { id: string } => typeof item.id === "string" && item.id.length > 0)
            .map(async (item) => {
              try {
                return await api<ContentRecord>(`/v1/contents/${item.id}`);
              } catch (err) {
                if (err instanceof ApiError && err.status === 401) throw err;
                return item;
              }
            }),
        );
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }

      const matched = selectTickerDesignContent({
        tickerId: id,
        playbackContentId: playback?.contentId,
        contents: details,
      });
      const nextNodes = loadedDesignerNodes(matched, id);
      setTicker(row);
      setPlaybackDocument(playback?.document ?? null);
      setContentsCatalog(details);
      setContent(
        matched?.id
          ? {
              id: matched.id,
              title: matched.title ?? tickerDesignTitle(row.name),
              publishedVersionId: matched.publishedVersionId ?? null,
              document: matched.document,
            }
          : null,
      );
      setNodes(nextNodes);
      setSelectedId(null);
      nodeSeq.current = nextDesignerNodeSeq(nextNodes);

      if (matched?.id && canManageCampaigns) {
        try {
          const campaigns = await api<{ items: CampaignRecord[] }>("/v1/campaigns");
          const existing = findTickerSchedule(campaigns.items, id, matched.id);
          setCampaignId(existing?.id ?? null);
          if (existing?.startAt && existing?.endAt) {
            const start = isoToDatetimeLocal(existing.startAt);
            const end = isoToDatetimeLocal(existing.endAt);
            if (start && end) setInitialSchedule({ start, end });
          } else {
            setInitialSchedule(null);
          }
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) return;
          setCampaignId(null);
        }
      } else {
        setCampaignId(null);
        setInitialSchedule(null);
      }
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setTicker(null);
      setLoadError(TICKER_DETAIL_ERROR_MESSAGE);
      setLoading(false);
    }
  }

  function addKind(kind: DesignerNodeKind) {
    nodeSeq.current += 1;
    const nextId = `node-${kind}-${nodeSeq.current}`;
    setNodes((current) => appendDesignerNode(current, kind, nextId));
    setSelectedId(nextId);
    setError("");
  }

  function removeNode(nodeId: string) {
    setSelectedId((currentSelected) => nextSelectedId(nodes, nodeId, currentSelected));
    setNodes((current) => removeDesignerNode(current, nodeId));
  }

  function clearSelected() {
    if (!selectedId) return;
    const cleared = clearSelectedNode(nodes, selectedId);
    setNodes(cleared.nodes);
    setSelectedId(cleared.selectedId);
  }

  function clearAll() {
    setNodes(clearAllNodes());
    setSelectedId(null);
    nodeSeq.current = 0;
  }

  function documentForTicker() {
    if (!id || !ticker) return null;
    const width = typeof ticker.width === "number" && ticker.width > 0 ? ticker.width : 0;
    const height = typeof ticker.height === "number" && ticker.height > 0 ? ticker.height : 0;
    if (!width || !height) return null;
    return storedDesignerDocument({
      tickerId: id,
      nodes,
      width,
      height,
    });
  }

  async function persistDraft(): Promise<SavedContent> {
    if (!id || !ticker) throw new Error(TICKER_DESIGN_SAVE_ERROR);
    const document = documentForTicker();
    if (!document) throw new Error(TICKER_DESIGN_SAVE_ERROR);
    const title = tickerDesignTitle(ticker.name);
    const body = designerSaveBody(title, document);
    if (content && contentBelongsToTickerDesign(content, id)) {
      await api<{ versionId: string }>(`/v1/contents/${content.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const next = {
        ...content,
        title,
        document,
      };
      setContent(next);
      setContentsCatalog((current) => current.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
      return next;
    }
    const createdContent = await api<SavedContent>("/v1/contents", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!createdContent.id) throw new Error(TICKER_DESIGN_SAVE_ERROR);
    const next = {
      id: createdContent.id,
      title,
      publishedVersionId: createdContent.publishedVersionId ?? null,
      document,
    };
    setContent(next);
    setContentsCatalog((current) => [...current.filter((item) => item.id !== next.id), next]);
    return next;
  }

  async function saveDraft() {
    if (!canWriteContent) return;
    setSaving(true);
    setError("");
    try {
      await persistDraft();
      setToast(DESIGNER_SAVE_TOAST);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(TICKER_DESIGN_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndPublish() {
    if (!canWriteContent || !canPublish || !id) return;
    if (
      emptyDesignerWouldReplaceLegacy({
        nodes,
        tickerId: id,
        playbackDocument,
      })
    ) {
      setError(TICKER_DESIGN_LEGACY_PUBLISH);
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const saved = await persistDraft();
      const published = await api<{ snapshot?: { version?: string } }>(`/v1/contents/${saved.id}/publish`, {
        method: "POST",
        body: JSON.stringify(tickerPublishBody(id)),
      });
      const next = { ...saved, publishedVersionId: published.snapshot?.version ?? saved.publishedVersionId ?? null };
      try {
        const fresh = await api<ContentRecord>(`/v1/contents/${saved.id}`);
        next.publishedVersionId = fresh.publishedVersionId ?? next.publishedVersionId;
        next.document = fresh.document ?? saved.document;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }
      setContent(next);
      setPlaybackDocument(next.document ?? playbackDocument);
      setContentsCatalog((current) => current.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
      setToast(DESIGNER_PUBLISH_TOAST);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setError(TICKER_DESIGN_PUBLISH_ERROR);
    } finally {
      setPublishing(false);
    }
  }

  async function saveSchedule(start: string, end: string) {
    if (!canManageCampaigns || !id || !ticker) return false;
    setScheduling(true);
    setScheduleError("");
    try {
      const request = buildTickerScheduleRequest({
        tickerId: id,
        tickerName: tickerDesignTitle(ticker.name),
        contentId: content?.id ?? null,
        startAt: start,
        endAt: end,
        contents: content
          ? contentsCatalog.map((item) => (item.id === content.id ? { ...item, ...content } : item))
          : contentsCatalog,
      });
      if (!request.ok) {
        setScheduleError(request.error);
        return false;
      }
      if (campaignId) {
        const updated = await api<CampaignRecord>(`/v1/campaigns/${campaignId}`, {
          method: "PATCH",
          body: JSON.stringify(request.body),
        });
        setCampaignId(updated.id ?? campaignId);
      } else {
        const createdSchedule = await api<CampaignRecord>("/v1/campaigns", {
          method: "POST",
          body: JSON.stringify(request.body),
        });
        setCampaignId(createdSchedule.id ?? null);
      }
      setInitialSchedule({ start, end });
      setToast(DESIGNER_SCHEDULE_TOAST);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return false;
      setScheduleError(TICKER_DESIGN_SCHEDULE_ERROR);
      return false;
    } finally {
      setScheduling(false);
    }
  }

  if (loading) {
    return (
      <>
        <h1>{DESIGNER_PAGE_TITLE}</h1>
        <p className="muted" aria-live="polite">
          {TICKER_DETAIL_LOADING_MESSAGE}
        </p>
      </>
    );
  }

  if (loadError || !ticker || !id) {
    return (
      <>
        <h1>{DESIGNER_PAGE_TITLE}</h1>
        <p className="error" role="alert">
          {loadError || TICKER_DETAIL_ERROR_MESSAGE}
        </p>
      </>
    );
  }

  const width = typeof ticker.width === "number" && ticker.width > 0 ? ticker.width : 0;
  const height = typeof ticker.height === "number" && ticker.height > 0 ? ticker.height : 0;

  return (
    <DesignerCanvas
      tickerName={tickerDesignTitle(ticker.name)}
      tickerChip={tickerDesignerChip(ticker)}
      width={width}
      height={height}
      nodes={nodes}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onNodesChange={setNodes}
      onAdd={addKind}
      onRemove={removeNode}
      onClearSelected={clearSelected}
      onClearAll={clearAll}
      canEdit={actions.canEdit}
      canSave={actions.canSave}
      canPublish={actions.canPublish}
      canSchedule={actions.canSchedule}
      saving={saving}
      publishing={publishing}
      scheduling={scheduling}
      onSave={() => void saveDraft()}
      onPublish={() => void saveAndPublish()}
      onScheduleSave={saveSchedule}
      onToast={setToast}
      toast={toast}
      error={error}
      scheduleError={scheduleError}
      initialSchedule={initialSchedule}
    />
  );
}
