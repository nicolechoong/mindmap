import type { ElectronAPI } from './preload';

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

// ── SubNode (checklist item inside a MindMapNode) ─────────────────────────

export interface SubNode {
    id: string;
    text: string;
    type: 'checklist' | 'attachment';
    filePath?: string;      // absolute path – only for type === 'attachment'
    checked: boolean;
    collapsed: boolean;
    subNodes: SubNode[];
    childNodeId: string | null;
    startTime?: string;     // ISO 8601: "2026-03-03" (date) or "2026-03-03T14:00" (datetime)
    endTime?: string;       // ISO 8601, same granularity as startTime
    timeGranularity?: 'date' | 'datetime';
}

// ── MindMapNode ───────────────────────────────────────────────────────────

export interface NodeStyle {
    fillColor: string;
    strokeColor: string;
    textColor: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    shape: 'rectangle' | 'rounded' | 'pill' | 'ellipse';
    icon?: string;
}

export interface MindMapNode {
    id: string;
    parentId: string | null;
    parentSubNodeId: string | null;
    children: string[];
    text: string;
    notes: string;
    collapsed: boolean;
    subNodesCollapsed?: boolean;
    subNodes: SubNode[];
    style: NodeStyle;
    position: { x: number; y: number };
    side?: 'left' | 'right';
}

// ── Edges ─────────────────────────────────────────────────────────────────

export interface EdgeStyle {
    color: string;
    width: number;
    curve: 'bezier' | 'straight' | 'elbow';
}

export interface MindMapEdge {
    id: string;
    sourceId: string;
    targetId: string;
    style: EdgeStyle;
}

// ── Associative Links ─────────────────────────────────────────────────────

export interface MindMapLink {
    id: string;
    sourceId: string;
    targetId: string;
}

// ── Theme ─────────────────────────────────────────────────────────────────

export interface ThemeConfig {
    name: string;
    mode: 'dark' | 'light';
    colors: {
        background: string;
        surface: string;
        primary: string;
        secondary: string;
        text: string;
        textMuted: string;
        border: string;
        accent: string;
    };
    defaultNodeStyle: NodeStyle;
    defaultEdgeStyle: EdgeStyle;
}

// ── App Settings ────────────────────────────────────────────────────────────────────────

/** @deprecated Use ConnectorAnchor + LineStyle instead */
export type ConnectorStyle = 'bezier' | 'orthogonal' | 'horizontal';

/** Where connectors attach to nodes */
export type ConnectorAnchor = 'adaptive' | 'horizontal';

/** Shape of the connector line */
export type LineStyle = 'bezier' | 'orthogonal' | 'straight';

export interface AppSettings {
    libraryPath: string;            // where .mindmap files are stored
    defaultConnectorStyle: ConnectorStyle; // legacy
    autoSaveInterval: 0 | 30 | 60 | 300;  // seconds, 0 = off
    theme: 'light' | 'dark';
    inheritParentColor: boolean;    // new child nodes copy the parent's fill color
}

// ── Document ──────────────────────────────────────────────────────────────────────────

export interface MindMapDocument {
    version: number;
    title: string;
    rootIds: string[];
    nodes: Record<string, MindMapNode>;
    edges: Record<string, MindMapEdge>;
    links: Record<string, MindMapLink>;
    manualPositions?: Record<string, { x: number; y: number }>;
    theme: ThemeConfig;
    viewport: { x: number; y: number; zoom: number };
    createdAt: string;
    updatedAt: string;
    connectorStyle?: ConnectorStyle;  // legacy, for backward compat
    connectorAnchor?: ConnectorAnchor;
    lineStyle?: LineStyle;
}

// ── Viewport ──────────────────────────────────────────────────────────────

export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}
