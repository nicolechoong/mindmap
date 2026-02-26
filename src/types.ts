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
    subNodes: SubNode[];
    style: NodeStyle;
    position: { x: number; y: number };
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

// ── Document ──────────────────────────────────────────────────────────────

export interface MindMapDocument {
    version: number;
    title: string;
    rootIds: string[];
    nodes: Record<string, MindMapNode>;
    edges: Record<string, MindMapEdge>;
    links: Record<string, MindMapLink>;
    theme: ThemeConfig;
    viewport: { x: number; y: number; zoom: number };
    createdAt: string;
    updatedAt: string;
}

// ── Viewport ──────────────────────────────────────────────────────────────

export interface ViewportState {
    x: number;
    y: number;
    zoom: number;
}
