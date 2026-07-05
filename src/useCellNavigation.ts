import { useState, useCallback, useRef, useEffect } from 'react';
import { CellData, CellType, CellMode } from './types';

export type NavigationResult = { openCommandPalette?: boolean };

export function useCellNavigation(
  cells: CellData[],
  addCell: (type: CellType, index?: number) => string,
  updateCell: (id: string, d: Partial<CellData>) => void,
  removeCell: (id: string) => void,
) {
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
  const [mode, setMode] = useState<CellMode>('command');
  const [selectedCellIds, setSelectedCellIds] = useState<Set<string>>(new Set());
  const [clipboardCell, setClipboardCell] = useState<CellData | null>(null);
  const [clipboardMode, setClipboardMode] = useState<'copy' | 'cut'>('copy');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); }, []);

  const focusedIndex = cells.findIndex(c => c.id === focusedCellId);

  const moveFocus = useCallback((dir: 1 | -1, extend?: boolean) => {
    setFocusedCellId(prev => {
      const idx = cells.findIndex(c => c.id === prev);
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= cells.length) return prev;
      const nextId = cells[nextIdx].id;
      setSelectedCellIds(s => {
        if (extend) { const ns = new Set(s); if (s.size === 0 && prev) ns.add(prev); ns.add(nextId); return ns; }
        return new Set();
      });
      return nextId;
    });
  }, [cells]);

  const insertAbove = useCallback(() => {
    const idx = focusedIndex >= 0 ? focusedIndex : cells.length;
    const id = addCell('canvas', idx);
    setFocusedCellId(id);
    setMode('edit');
  }, [focusedIndex, cells.length, addCell]);

  const insertBelow = useCallback(() => {
    const idx = focusedIndex >= 0 ? focusedIndex + 1 : cells.length;
    const id = addCell('canvas', idx);
    setFocusedCellId(id);
    setMode('edit');
  }, [focusedIndex, cells.length, addCell]);

  const deleteFocused = useCallback(() => {
    if (!focusedCellId) return;
    const idx = cells.findIndex(c => c.id === focusedCellId);
    removeCell(focusedCellId);
    let nextIdx = idx < cells.length - 1 ? idx : idx - 1;
    setFocusedCellId(nextIdx >= 0 && nextIdx < cells.length ? cells[nextIdx === idx ? nextIdx + 1 : nextIdx]?.id ?? null : null);
    setSelectedCellIds(new Set());
  }, [focusedCellId, cells, removeCell]);

  const cutFocused = useCallback(() => {
    if (!focusedCellId) return;
    const cell = cells.find(c => c.id === focusedCellId);
    if (cell) { setClipboardCell({ ...cell, id: '' }); setClipboardMode('cut'); deleteFocused(); }
  }, [focusedCellId, cells, deleteFocused]);

  const copyFocused = useCallback(() => {
    if (!focusedCellId) return;
    const cell = cells.find(c => c.id === focusedCellId);
    if (cell) { setClipboardCell({ ...cell, id: '' }); setClipboardMode('copy'); }
  }, [focusedCellId, cells]);

  const pasteBelow = useCallback(() => {
    if (!clipboardCell) return;
    const idx = focusedIndex >= 0 ? focusedIndex + 1 : cells.length;
    const id = addCell(clipboardCell.type, idx);
    updateCell(id, { ...clipboardCell, id });
    if (clipboardMode === 'cut') setClipboardCell(null);
    setFocusedCellId(id);
    setMode('command');
  }, [focusedIndex, cells.length, addCell, clipboardCell, clipboardMode, updateCell]);

  const duplicateCell = useCallback((id: string) => {
    const idx = cells.findIndex(c => c.id === id);
    if (idx < 0) return;
    const cell = cells[idx];
    const newId = addCell(cell.type, idx + 1);
    updateCell(newId, { ...cell, id: newId });
    setFocusedCellId(newId);
  }, [cells, addCell, updateCell]);

  const moveCell = useCallback((id: string, toIndex: number): CellData[] | undefined => {
    const fromIdx = cells.findIndex(c => c.id === id);
    if (fromIdx < 0 || fromIdx === toIndex || toIndex < 0 || toIndex >= cells.length) return;
    const reordered = [...cells];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIndex, 0, moved);
    setFocusedCellId(id);
    return reordered;
  }, [cells]);

  const focusCell = useCallback((id: string) => {
    setFocusedCellId(id);
    setMode('command');
    setSelectedCellIds(new Set());
    setPendingAction(null);
  }, []);

  const toggleSelectCell = useCallback((id: string, shiftKey: boolean) => {
    setFocusedCellId(id);
    setSelectedCellIds(s => {
      const ns = new Set(s);
      if (shiftKey) {
        const fromIdx = cells.findIndex(c => c.id === focusedCellId);
        const toIdx = cells.findIndex(c => c.id === id);
        if (fromIdx >= 0) {
          const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
          for (let i = start; i <= end; i++) ns.add(cells[i].id);
        } else { ns.add(id); }
      } else {
        if (ns.has(id)) ns.delete(id); else ns.add(id);
      }
      return ns;
    });
  }, [cells, focusedCellId]);

  const changeCellType = useCallback((id: string, type: CellType) => {
    const cell = cells.find(c => c.id === id);
    if (!cell || cell.type === type) return;
    const base: Partial<CellData> = { type, isEditing: type === 'markdown', isLoading: false };
    if (type === 'canvas') {
      base.versions = cell.versions.length > 0 ? cell.versions : []; base.currentVersionIndex = cell.currentVersionIndex;
      base.markdownContent = ''; base.codeContent = ''; base.sandboxHtml = ''; base.sandboxCss = ''; base.sandboxJs = '';
    } else if (type === 'markdown') {
      base.markdownContent = cell.markdownContent || cell.versions?.[cell.currentVersionIndex]?.content || '';
    } else if (type === 'code') {
      base.codeContent = ''; base.language = 'javascript';
    } else if (type === 'sandbox') {
      base.sandboxHtml = ''; base.sandboxCss = ''; base.sandboxJs = ''; base.sandboxAutoRun = true;
    }
    updateCell(id, base);
  }, [cells, updateCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): 'command-palette' | undefined => {
    if (mode === 'edit') {
      if (e.key === 'Escape') { e.preventDefault(); setMode('command'); setSelectedCellIds(new Set()); }
      return;
    }

    if (e.key === 'Escape') {
      setFocusedCellId(null); setSelectedCellIds(new Set()); setPendingAction(null);
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') { e.preventDefault(); return 'command-palette'; }

    if (e.key === 'Enter') { e.preventDefault(); setMode('edit'); return; }

    if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (pendingAction === 'd') { deleteFocused(); setPendingAction(null); if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; } }
      else { if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); const t = setTimeout(() => setPendingAction(null), 600); pendingTimerRef.current = t; setPendingAction('d'); }
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setPendingAction(null); moveFocus(1, e.shiftKey); return; }
    if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setPendingAction(null); moveFocus(-1, e.shiftKey); return; }

    // Reset pending d on any non-d key
    setPendingAction(null); if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }

    if (e.key === 'a' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); insertAbove(); return; }
    if (e.key === 'b' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); insertBelow(); return; }
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); copyFocused(); return; }
    if (e.key === 'x' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); cutFocused(); return; }
    if (e.key === 'v' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pasteBelow(); return; }

    return;
  }, [mode, moveFocus, deleteFocused, insertAbove, insertBelow, copyFocused, cutFocused, pasteBelow]);

  return {
    focusedCellId, setFocusedCellId, focusedIndex,
    mode, setMode,
    selectedCellIds, setSelectedCellIds,
    clipboardCell,
    pendingAction,
    focusCell, toggleSelectCell,
    moveCell, moveFocus,
    insertAbove, insertBelow,
    deleteFocused, cutFocused, copyFocused, pasteBelow,
    duplicateCell,
    changeCellType,
    handleKeyDown,
  };
}
