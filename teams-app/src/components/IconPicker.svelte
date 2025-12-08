<script lang="ts">
  import type { ActivityIcon } from "../types/admin";
  import { activityIconPaths } from "../types/admin";

  // Props
  let {
    value = "calendar" as ActivityIcon,
    color = "#0078D4",
    onchange,
  }: {
    value: ActivityIcon;
    color?: string;
    onchange?: (icon: ActivityIcon) => void;
  } = $props();

  let showPicker = $state(false);

  // All available icons
  const icons = Object.keys(activityIconPaths) as ActivityIcon[];

  function selectIcon(icon: ActivityIcon) {
    onchange?.(icon);
    showPicker = false;
  }
</script>

<div class="icon-picker-container">
  <button
    type="button"
    class="icon-preview"
    onclick={() => (showPicker = !showPicker)}
    aria-label="Select icon"
  >
    <div class="preview-icon" style="color: {color}">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={activityIconPaths[value]} fill="currentColor"/>
      </svg>
    </div>
    <span class="icon-name">{value}</span>
    <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.293 8.293a1 1 0 0 1 1.414 0L12 14.586l6.293-6.293a1 1 0 1 1 1.414 1.414l-7 7a1 1 0 0 1-1.414 0l-7-7a1 1 0 0 1 0-1.414Z" fill="currentColor"/>
    </svg>
  </button>

  {#if showPicker}
    <div class="picker-dropdown">
      <div class="picker-header">
        <span class="picker-label">Choose an icon</span>
        <button class="close-btn" onclick={() => (showPicker = false)} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m4.21 4.387.083-.094a1 1 0 0 1 1.32-.083l.094.083L12 10.585l6.293-6.292a1 1 0 1 1 1.414 1.414L13.415 12l6.292 6.293a1 1 0 0 1 .083 1.32l-.083.094a1 1 0 0 1-1.32.083l-.094-.083L12 13.415l-6.293 6.292a1 1 0 0 1-1.414-1.414L10.585 12 4.293 5.707a1 1 0 0 1-.083-1.32l.083-.094-.083.094Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <div class="icon-grid">
        {#each icons as icon}
          <button
            type="button"
            class="icon-option"
            class:selected={value === icon}
            onclick={() => selectIcon(icon)}
            aria-label={icon}
            title={icon}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: {value === icon ? color : 'inherit'}">
              <path d={activityIconPaths[icon]} fill="currentColor"/>
            </svg>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .icon-picker-container {
    position: relative;
    display: inline-block;
  }

  .icon-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--background-color);
    cursor: pointer;
    min-width: 160px;
    transition: border-color 0.15s;
  }

  .icon-preview:hover {
    border-color: var(--accent-color);
  }

  .preview-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-icon svg {
    width: 20px;
    height: 20px;
  }

  .icon-name {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-color);
    text-transform: capitalize;
  }

  .dropdown-arrow {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
  }

  .picker-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 1000;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    padding: 0.75rem;
    min-width: 320px;
    margin-top: 0.25rem;
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .picker-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn svg {
    width: 16px;
    height: 16px;
  }

  .close-btn:hover {
    background: var(--background-color);
    color: var(--text-color);
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.375rem;
  }

  .icon-option {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    border-radius: 6px;
    background: var(--background-color);
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s, background 0.15s;
    color: var(--text-secondary);
  }

  .icon-option svg {
    width: 22px;
    height: 22px;
  }

  .icon-option:hover {
    transform: scale(1.1);
    background: var(--surface-color);
    color: var(--text-color);
  }

  .icon-option.selected {
    border-color: var(--accent-color);
    background: var(--surface-color);
  }
</style>
