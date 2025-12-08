<script lang="ts">
  import type { ScopeFilters, Layer } from "../types/hierarchy";
  import { t } from "../services/i18nService";

  let {
    filters = $bindable(),
    layers = $bindable(),
    onFilterChange,
    onLayersReorder,
  }: {
    filters: ScopeFilters;
    layers: Layer[];
    onFilterChange?: (filters: ScopeFilters) => void;
    onLayersReorder?: (layers: Layer[]) => void;
  } = $props();

  // Sort layers by ring index for display
  const sortedLayers = $derived(
    [...layers].sort((a, b) => a.ringIndex - b.ringIndex)
  );

  // Drag and drop state
  let draggedIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  function toggleAll(show: boolean) {
    Object.keys(filters).forEach((key) => {
      filters[key] = show;
    });
    onFilterChange?.(filters);
  }

  // Drag and drop handlers
  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    // Reorder the layers
    const newLayers = [...sortedLayers];
    const [draggedItem] = newLayers.splice(draggedIndex, 1);
    newLayers.splice(targetIndex, 0, draggedItem);
    
    // Update ring indices
    const reorderedLayers = newLayers.map((layer, i) => ({
      ...layer,
      ringIndex: i
    }));
    
    // Update the layers array with new ring indices
    layers = reorderedLayers;
    onLayersReorder?.(reorderedLayers);
    
    draggedIndex = null;
    dragOverIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  // Helper to convert hex to rgba
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
</script>

<div class="scope-filter-panel">
  <div class="filter-header">
    <span class="filter-title">
      <svg class="title-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      {t('filters.layers')}
    </span>
    <div class="quick-actions">
      <button class="quick-btn" onclick={() => toggleAll(true)}>{t('filters.all')}</button>
      <button class="quick-btn" onclick={() => toggleAll(false)}>{t('filters.none')}</button>
    </div>
  </div>
  
  <div class="filter-list">
    {#each sortedLayers as layer, index}
      <label 
        class="filter-item" 
        class:active={filters[layer.id]}
        class:dragging={draggedIndex === index}
        class:drag-over={dragOverIndex === index && draggedIndex !== index}
        draggable="true"
        ondragstart={() => handleDragStart(index)}
        ondragover={(e) => handleDragOver(e, index)}
        ondragleave={handleDragLeave}
        ondrop={() => handleDrop(index)}
        ondragend={handleDragEnd}
        style="--layer-bg: {hexToRgba(layer.color, 0.15)}"
      >
        <span class="drag-handle">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm8-15a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" fill="currentColor"/>
          </svg>
        </span>
        <input
          type="checkbox"
          bind:checked={filters[layer.id]}
          onchange={() => onFilterChange?.(filters)}
          onclick={(e) => e.stopPropagation()}
        />
        <span class="scope-indicator" style="background-color: {layer.color}"></span>
        <span class="scope-label">{layer.name}</span>
      </label>
    {/each}
  </div>
  
  <div class="legend">
    <span class="legend-label">Inner → Outer:</span>
    <div class="legend-items">
      {#each sortedLayers as layer, i}
        <span class="legend-item" style="color: {layer.color}">
          {layer.name}{i < sortedLayers.length - 1 ? " →" : ""}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  .scope-filter-panel {
    background: var(--surface-color, #ffffff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .filter-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-color, #333333);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .quick-actions {
    display: flex;
    gap: 8px;
  }

  .quick-btn {
    padding: 4px 8px;
    font-size: 0.75rem;
    background: var(--accent-color, #0078d4);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s, opacity 0.15s;
  }

  .quick-btn:hover {
    background: var(--accent-color-dark, #005a9e);
    opacity: 0.9;
  }

  .filter-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: grab;
    transition: background-color 0.15s, transform 0.15s, box-shadow 0.15s;
    opacity: 0.6;
    background: var(--layer-bg, transparent);
    border: 1px solid transparent;
  }

  .filter-item:hover {
    background: var(--layer-bg, var(--hover-color, #f5f5f5));
    border-color: var(--border-color, #e0e0e0);
  }

  .filter-item.active {
    opacity: 1;
    background: var(--layer-bg, var(--accent-color-light, #e6f2ff));
    border-color: var(--border-color, #e0e0e0);
  }

  .filter-item.dragging {
    opacity: 0.5;
    transform: scale(1.02);
    cursor: grabbing;
  }

  .filter-item.drag-over {
    border-color: var(--accent-color, #0078d4);
    border-style: dashed;
    background: var(--accent-color-light, #e6f2ff);
  }

  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    color: var(--text-secondary, #666666);
    opacity: 0.5;
    transition: opacity 0.15s;
  }

  .filter-item:hover .drag-handle {
    opacity: 1;
  }

  .drag-handle svg {
    width: 14px;
    height: 14px;
  }

  .filter-item input[type="checkbox"] {
    margin: 0;
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--accent-color, #0078d4);
  }

  .scope-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .scope-label {
    flex: 1;
    font-size: 0.85rem;
    color: var(--text-color, #333333);
  }

  .legend {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }

  .legend-label {
    font-size: 0.75rem;
    color: var(--text-secondary, #666666);
    display: block;
    margin-bottom: 4px;
  }

  .legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 0.75rem;
  }

  .legend-item {
    font-weight: 500;
  }

  @media (max-width: 768px) {
    .filter-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .filter-item {
      padding: 8px;
    }
  }
</style>
