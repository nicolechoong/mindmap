import type { MindMapNode, SubNode, MindMapDocument } from '../types';

// ── Markdown Export ───────────────────────────────────────────────────────

/**
 * Convert a mind map document to Markdown outline format.
 */
export function toMarkdown(doc: MindMapDocument): string {
    const lines: string[] = [];
    lines.push(`# ${doc.title}\n`);

    const renderNode = (nodeId: string, depth: number) => {
        const node = doc.nodes[nodeId];
        if (!node) return;

        const indent = '  '.repeat(depth);
        const bullet = depth === 0 ? '' : `${indent}- `;
        lines.push(`${bullet}${node.text}`);

        // Render subnodes as checklist
        if (node.subNodes.length > 0) {
            renderSubNodes(node.subNodes, depth + 1);
        }

        // Render notes
        if (node.notes.trim()) {
            lines.push('');
            for (const line of node.notes.split('\n')) {
                lines.push(`${'  '.repeat(depth + 1)}> ${line}`);
            }
            lines.push('');
        }

        // Recurse children
        for (const childId of node.children) {
            renderNode(childId, depth + 1);
        }
    };

    const renderSubNodes = (subs: SubNode[], depth: number) => {
        const indent = '  '.repeat(depth);
        for (const sn of subs) {
            const check = sn.checked ? '[x]' : '[ ]';
            const link = sn.childNodeId ? ' 🔗' : '';
            lines.push(`${indent}- ${check} ${sn.text}${link}`);
            if (sn.subNodes.length > 0) {
                renderSubNodes(sn.subNodes, depth + 1);
            }
        }
    };

    for (const rootId of doc.rootIds) {
        renderNode(rootId, 0);
        lines.push('');
    }
    return lines.join('\n').trimEnd();
}

// ── JSON Export ───────────────────────────────────────────────────────────

/**
 * Export the document as pretty-printed JSON.
 */
export function toJson(doc: MindMapDocument): string {
    return JSON.stringify(doc, null, 2);
}

// ── PNG Export ─────────────────────────────────────────────────────────────

/**
 * Export a Konva stage to a data URL.
 * This is called from the canvas component with the stage reference.
 */
export function stageToDataUrl(
    stage: { toDataURL: (config: { pixelRatio: number; mimeType: string }) => string },
): string {
    return stage.toDataURL({
        pixelRatio: 2,
        mimeType: 'image/png',
    });
}

// ── JPG Export ─────────────────────────────────────────────────────────────

/**
 * Export a Konva stage to a JPG data URL.
 * Background must be filled since JPG doesn't support transparency.
 */
export async function stageToJpgDataUrl(
    stage: { toDataURL: (config: { pixelRatio: number; mimeType: string }) => string },
    backgroundColor: string = '#ffffff'
): Promise<string> {
    const pngUrl = stage.toDataURL({
        pixelRatio: 2,
        mimeType: 'image/png',
    });

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No canvas context');

            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = reject;
        img.src = pngUrl;
    });
}
