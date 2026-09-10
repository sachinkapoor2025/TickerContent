import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { AppShell, type ShellLinkProps } from "@ticker-cms/ui";
import {
  DESIGNER_DEFAULT_NAME,
  DESIGNER_DISPLAY_SIZE_LABEL,
  DESIGNER_PUBLISH_TOAST,
  DESIGNER_SAVE_TOAST,
  DESIGNER_SCHEDULE_TOAST,
  DESIGNER_TOAST_MS,
  DESIGNER_HEIGHT,
  DESIGNER_WIDTH,
  appendDesignerNode,
  clearAllNodes,
  clearSelectedNode,
  createInitialFlow,
  nextSelectedId,
  removeDesignerNode,
  type DesignerNode,
  type DesignerNodeKind,
} from "./designerDocument";
import { DesignerCanvas } from "./DesignerCanvas";
import {
  DESIGNER_BRAND_LABEL,
  DESIGNER_CONTEXT_LABEL,
  DESIGNER_PAGE_TITLE,
  DESIGNER_PUBLIC_NAV,
} from "./designerShell";

function DesignerLink({ to, end, className, children, title, onClick, "aria-label": ariaLabel }: ShellLinkProps) {
  return (
    <NavLink to={to} end={end} className={className} title={title} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </NavLink>
  );
}

export function TickerDesignerDemoPage() {
  const [name] = useState(DESIGNER_DEFAULT_NAME);
  const [nodes, setNodes] = useState<DesignerNode[]>(createInitialFlow);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
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

  function addKind(kind: DesignerNodeKind) {
    nodeSeq.current += 1;
    const id = `node-${kind}-${nodeSeq.current}`;
    setNodes((current) => appendDesignerNode(current, kind, id));
    setSelectedId(id);
  }

  function removeNode(id: string) {
    setSelectedId((currentSelected) => nextSelectedId(nodes, id, currentSelected));
    setNodes((current) => removeDesignerNode(current, id));
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

  return (
    <AppShell
      product="customer"
      brandLabel={DESIGNER_BRAND_LABEL}
      contextLabel={DESIGNER_CONTEXT_LABEL}
      headerTitle={DESIGNER_PAGE_TITLE}
      navItems={DESIGNER_PUBLIC_NAV}
      linkComponent={DesignerLink}
      showLogout={false}
    >
      <DesignerCanvas
        tickerName={name}
        tickerChip={`${name} · ${DESIGNER_DISPLAY_SIZE_LABEL}`}
        width={DESIGNER_WIDTH}
        height={DESIGNER_HEIGHT}
        nodes={nodes}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNodesChange={setNodes}
        onAdd={addKind}
        onRemove={removeNode}
        onClearSelected={clearSelected}
        onClearAll={clearAll}
        canEdit
        canSave
        canPublish
        canSchedule
        onSave={() => setToast(DESIGNER_SAVE_TOAST)}
        onPublish={() => setToast(DESIGNER_PUBLISH_TOAST)}
        onScheduleSave={() => {
          setToast(DESIGNER_SCHEDULE_TOAST);
          return true;
        }}
        onToast={setToast}
        toast={toast}
      />
    </AppShell>
  );
}
