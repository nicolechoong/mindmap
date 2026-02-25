interface ShortcutsModalProps {
    onClose: () => void;
}

const shortcuts = [
    ['Tab', 'Add child node'],
    ['Enter', 'Add sibling node'],
    ['Delete / Backspace', 'Delete node'],
    ['F2', 'Edit node text'],
    ['Space', 'Toggle collapse'],
    ['Arrow keys', 'Navigate nodes'],
    ['Double-click', 'Inline edit'],
    ['Right-click', 'Context menu'],
    ['Scroll wheel', 'Zoom in / out'],
    ['Drag canvas', 'Pan the view'],
    ['Ctrl + Z', 'Undo'],
    ['Ctrl + Y', 'Redo'],
    ['Ctrl + S', 'Save'],
    ['Ctrl + Shift + S', 'Save As'],
    ['Ctrl + O', 'Open file'],
    ['Ctrl + N', 'New map'],
    ['Ctrl + 0', 'Reset zoom'],
    ['Ctrl + Shift + T', 'Toggle theme'],
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
    return (
        <div className="shortcuts-overlay" onClick={onClose}>
            <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
                <h2>⌨ Keyboard Shortcuts</h2>
                <table>
                    <tbody>
                        {shortcuts.map(([key, desc], i) => (
                            <tr key={i}>
                                <td>{desc}</td>
                                <td><kbd>{key}</kbd></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <button className="shortcuts-close" onClick={onClose}>Close</button>
            </div>
        </div>
    );
}
