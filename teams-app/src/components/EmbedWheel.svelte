<script lang="ts">
  import { onMount } from "svelte";
  import type { Activity } from "../types/activity";
  import type { ActivityTypeConfig } from "../types/admin";
  import { defaultActivityTypes } from "../types/admin";
  import type { ScopeFilters, Layer } from "../types/hierarchy";
  import { createDefaultScopeFilters } from "../types/hierarchy";
  import { getActivitiesForUser, mockLayers } from "../data/mockData";
  import { createMockUserContext } from "../services/authService";
  import AnnualWheel from "./AnnualWheel.svelte";

  // Parse URL parameters
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      layers: params.get('layers')?.split(',').filter(Boolean) || null,
      year: params.get('year') ? parseInt(params.get('year')!) : new Date().getFullYear(),
      theme: (params.get('theme') as 'default' | 'dark' | 'light') || 'default',
      showLegend: params.get('legend') !== 'false',
      title: params.get('title') || null,
    };
  }

  const urlParams = getUrlParams();

  // State
  let isLoading = $state(true);
  let activities = $state<Activity[]>([]);
  let layers = $state<Layer[]>([]);
  let scopeFilters = $state<ScopeFilters>({});
  let activityTypes = $state<ActivityTypeConfig[]>([...defaultActivityTypes]);

  // Apply theme
  onMount(() => {
    document.documentElement.setAttribute("data-theme", urlParams.theme);
    
    // Load data
    const allLayers = [...mockLayers];
    
    // Filter layers if specified in URL
    if (urlParams.layers) {
      layers = allLayers.filter(l => 
        urlParams.layers!.some(param => 
          l.id.toLowerCase().includes(param.toLowerCase()) ||
          l.name.toLowerCase().includes(param.toLowerCase())
        )
      );
    } else {
      layers = allLayers;
    }
    
    // Create scope filters - all enabled for visible layers
    scopeFilters = createDefaultScopeFilters(layers);
    
    // Load activities
    const userContext = createMockUserContext();
    activities = getActivitiesForUser(userContext, activityTypes, layers);
    
    isLoading = false;
  });

  // Derive theme class
  const themeClass = $derived(`theme-${urlParams.theme}`);
</script>

<div class="embed-container {themeClass}">
  {#if isLoading}
    <div class="embed-loading">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else}
    {#if urlParams.title}
      <div class="embed-header">
        <h1>{urlParams.title}</h1>
      </div>
    {/if}
    
    <div class="embed-wheel">
      <AnnualWheel 
        {activities} 
        highlightedActivityId={null} 
        {scopeFilters} 
        {layers} 
      />
    </div>
    
    {#if urlParams.showLegend && layers.length > 0}
      <div class="embed-legend">
        {#each layers as layer}
          <div class="legend-item">
            <span class="legend-dot" style="background-color: {layer.color}"></span>
            <span class="legend-label">{layer.name}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .embed-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--background-color, #ffffff);
    overflow: hidden;
  }

  .embed-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--text-secondary, #666);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color, #e0e0e0);
    border-top-color: var(--accent-color, #0078d4);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .embed-header {
    padding: 1rem;
    text-align: center;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  .embed-header h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #333);
  }

  .embed-wheel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    min-height: 0;
  }

  .embed-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface-color, #f5f5f5);
    border-top: 1px solid var(--border-color, #e0e0e0);
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-color, #333);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    white-space: nowrap;
  }

  /* Dark theme overrides */
  :global([data-theme="dark"]) .embed-container {
    background: #1e1e1e;
  }

  :global([data-theme="dark"]) .embed-header h1,
  :global([data-theme="dark"]) .legend-label {
    color: #e0e0e0;
  }

  :global([data-theme="dark"]) .embed-legend {
    background: #2d2d2d;
    border-color: #404040;
  }
</style>
