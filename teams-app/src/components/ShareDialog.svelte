<script lang="ts">
  import type { Layer } from "../types/hierarchy";
  import type { ShareLink, ShareVisibility, CreateShareRequest } from "../types/sharing";
  import { createShare, listShares, deleteShare, renewShare, regenerateShareKey } from "../services/sharingService";

  // Props
  let {
    layers = [],
    organizationId = "",
    userId = "",
    onClose,
  }: {
    layers: Layer[];
    organizationId: string;
    userId: string;
    onClose?: () => void;
  } = $props();

  // State
  let activeTab = $state<'create' | 'manage'>('create');
  let isLoading = $state(false);
  let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Create form state
  let visibility = $state<ShareVisibility>('public');
  let shareName = $state('');
  let shareDescription = $state('');
  // Initialize with all layer IDs using $derived
  let selectedLayers = $state<string[]>([]);
  let showLegend = $state(true);
  let showTitle = $state(true);
  let customTitle = $state('');
  let theme = $state<'light' | 'dark' | 'auto'>('light');
  
  // Initialize selected layers when layers prop changes
  $effect(() => {
    if (layers.length > 0 && selectedLayers.length === 0) {
      selectedLayers = layers.map(l => l.id);
    }
  });
  
  // Created share result
  let createdShare = $state<{ share: ShareLink; shareUrl: string; embedCode: string } | null>(null);
  
  // Existing shares
  let existingShares = $state<ShareLink[]>([]);

  // Load existing shares on mount
  $effect(() => {
    if (activeTab === 'manage' && organizationId) {
      loadShares();
    }
  });

  async function loadShares() {
    isLoading = true;
    try {
      const response = await listShares({ organizationId });
      existingShares = response.shares;
    } catch (error) {
      showMessage('error', 'Failed to load shares');
    } finally {
      isLoading = false;
    }
  }

  async function handleCreateShare() {
    if (selectedLayers.length === 0) {
      showMessage('error', 'Please select at least one layer');
      return;
    }

    isLoading = true;
    try {
      const request: CreateShareRequest = {
        visibility,
        name: shareName || undefined,
        description: shareDescription || undefined,
        layerConfig: {
          layerIds: selectedLayers,
          year: new Date().getFullYear(),
        },
        viewSettings: {
          theme,
          showLegend,
          showTitle,
          customTitle: customTitle || undefined,
          allowInteraction: true,
          rotateToCurrentMonth: true,
        },
      };

      const result = await createShare(request, organizationId, userId);
      createdShare = result;
      showMessage('success', 'Share link created successfully!');
    } catch (error) {
      showMessage('error', 'Failed to create share link');
    } finally {
      isLoading = false;
    }
  }

  async function handleDeleteShare(share: ShareLink) {
    if (!confirm(`Are you sure you want to delete "${share.name || share.shortCode}"?`)) {
      return;
    }

    try {
      await deleteShare(share.id, organizationId);
      existingShares = existingShares.filter(s => s.id !== share.id);
      showMessage('success', 'Share deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete share');
    }
  }

  async function handleRenewShare(share: ShareLink) {
    try {
      const renewed = await renewShare({ shareId: share.id }, organizationId);
      if (renewed) {
        existingShares = existingShares.map(s => s.id === share.id ? renewed : s);
        showMessage('success', 'Share renewed for another year');
      }
    } catch (error) {
      showMessage('error', 'Failed to renew share');
    }
  }

  async function handleRegenerateKey(share: ShareLink) {
    if (!confirm('Regenerating the key will invalidate the old share URL. Continue?')) {
      return;
    }

    try {
      const result = await regenerateShareKey(share.id, organizationId);
      if (result) {
        existingShares = existingShares.map(s => s.id === share.id ? result.share : s);
        showMessage('success', 'Key regenerated. Share the new URL.');
      }
    } catch (error) {
      showMessage('error', 'Failed to regenerate key');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showMessage('success', 'Copied to clipboard!');
  }

  function showMessage(type: 'success' | 'error', text: string) {
    message = { type, text };
    setTimeout(() => message = null, 3000);
  }

  function toggleLayer(layerId: string) {
    if (selectedLayers.includes(layerId)) {
      selectedLayers = selectedLayers.filter(id => id !== layerId);
    } else {
      selectedLayers = [...selectedLayers, layerId];
    }
  }

  function resetForm() {
    createdShare = null;
    shareName = '';
    shareDescription = '';
    selectedLayers = layers.map(l => l.id);
    visibility = 'public';
  }

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getDaysUntilExpiry(expiresAt: Date | string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose?.();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="share-dialog-overlay" onclick={onClose} onkeydown={handleKeyDown} role="presentation">
  <div class="share-dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" tabindex="-1">
    <div class="dialog-header">
      <div class="header-title">
        <svg viewBox="0 0 24 24" fill="none" class="header-icon">
          <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.42l-.47.48a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z" fill="currentColor"/>
        </svg>
        <h2 id="share-dialog-title">Create Share Link</h2>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close dialog">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    {#if message}
      <div class="message {message.type}">
        {message.text}
      </div>
    {/if}

    <div class="dialog-tabs">
      <button 
        class="tab-btn" 
        class:active={activeTab === 'create'}
        onclick={() => activeTab = 'create'}
      >
        Create Share
      </button>
      <button 
        class="tab-btn" 
        class:active={activeTab === 'manage'}
        onclick={() => activeTab = 'manage'}
      >
        Manage Shares
      </button>
    </div>

    <div class="dialog-content">
      {#if activeTab === 'create'}
        {#if createdShare}
          <!-- Share Created Success -->
          <div class="share-success">
            <div class="success-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
              </svg>
            </div>
            <h3>Share Link Created!</h3>
            
            <div class="share-result">
              <span class="result-label">Share URL</span>
              <div class="copy-field">
                <input type="text" readonly value={createdShare.shareUrl} aria-label="Share URL" />
                <button class="copy-btn" onclick={() => copyToClipboard(createdShare!.shareUrl)}>
                  Copy
                </button>
              </div>
            </div>

            <div class="share-result">
              <span class="result-label">Embed Code</span>
              <div class="copy-field">
                <textarea readonly rows="3" aria-label="Embed code">{createdShare.embedCode}</textarea>
                <button class="copy-btn" onclick={() => copyToClipboard(createdShare!.embedCode)}>
                  Copy
                </button>
              </div>
            </div>

            <div class="share-meta">
              <span>Expires: {formatDate(createdShare.share.expiresAt)}</span>
              <span>Visibility: {createdShare.share.visibility}</span>
            </div>

            <button class="create-another-btn" onclick={resetForm}>
              Create Another Share
            </button>
          </div>
        {:else}
          <!-- Create Share Form -->
          <div class="create-form">
            <div class="form-section">
              <span class="section-label">Visibility</span>
              <div class="visibility-options" role="radiogroup" aria-label="Visibility options">
                <label class="radio-option">
                  <input type="radio" bind:group={visibility} value="public" />
                  <div class="option-content">
                    <span class="option-title">
                      <svg class="option-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
                      </svg>
                      Public
                    </span>
                    <span class="option-desc">Anyone with the link can view (no login required)</span>
                  </div>
                </label>
                <label class="radio-option">
                  <input type="radio" bind:group={visibility} value="users" />
                  <div class="option-content">
                    <span class="option-title">
                      <svg class="option-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/>
                      </svg>
                      Organization Users
                    </span>
                    <span class="option-desc">Only signed-in users from your organization can view</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="form-section">
              <span class="section-label">Select Layers</span>
              <div class="layer-checkboxes" role="group" aria-label="Layer selection">
                {#each layers as layer}
                  <label class="checkbox-option">
                    <input 
                      type="checkbox" 
                      checked={selectedLayers.includes(layer.id)}
                      onchange={() => toggleLayer(layer.id)}
                    />
                    <span class="layer-dot" style="background: {layer.color}"></span>
                    <span class="layer-name">{layer.name}</span>
                  </label>
                {/each}
              </div>
            </div>

            <div class="form-section">
              <span class="section-label">Share Details (Optional)</span>
              <input 
                type="text" 
                class="text-input"
                placeholder="Share name (e.g., Q1 Calendar)"
                aria-label="Share name"
                bind:value={shareName}
              />
              <textarea 
                class="text-input"
                placeholder="Description..."
                rows="2"
                aria-label="Description"
                bind:value={shareDescription}
              ></textarea>
            </div>

            <div class="form-section">
              <span class="section-label">Display Settings</span>
              <div class="settings-grid" role="group" aria-label="Display settings">
                <label class="checkbox-option">
                  <input type="checkbox" bind:checked={showLegend} />
                  <span>Show legend</span>
                </label>
                <label class="checkbox-option">
                  <input type="checkbox" bind:checked={showTitle} />
                  <span>Show title</span>
                </label>
              </div>
              {#if showTitle}
                <input 
                  type="text" 
                  class="text-input"
                  placeholder="Custom title (optional)"
                  aria-label="Custom title"
                  bind:value={customTitle}
                />
              {/if}
              <select class="text-input" bind:value={theme} aria-label="Theme selection">
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
                <option value="auto">Auto (system preference)</option>
              </select>
            </div>
          </div>
        {/if}
      {:else}
        <!-- Manage Shares Tab -->
        <div class="manage-shares">
          {#if isLoading}
            <div class="loading">Loading shares...</div>
          {:else if existingShares.length === 0}
            <div class="empty-state">
              <p>No shares created yet.</p>
              <button class="create-first-btn" onclick={() => activeTab = 'create'}>
                Create your first share
              </button>
            </div>
          {:else}
            <div class="shares-list">
              {#each existingShares as share}
                <div class="share-card" class:expired={getDaysUntilExpiry(share.expiresAt) <= 0}>
                  <div class="share-info">
                    <div class="share-header">
                      <span class="share-name">{share.name || share.shortCode}</span>
                      <span class="share-visibility" class:public={share.visibility === 'public'}>
                        {#if share.visibility === 'public'}
                          <svg class="visibility-icon" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/></svg>
                          Public
                        {:else}
                          <svg class="visibility-icon" viewBox="0 0 24 24" fill="none"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="currentColor"/></svg>
                          Users
                        {/if}
                      </span>
                    </div>
                    <div class="share-meta">
                      <span>Created: {formatDate(share.createdAt)}</span>
                      <span class="expiry" class:warning={getDaysUntilExpiry(share.expiresAt) <= 30}>
                        {#if getDaysUntilExpiry(share.expiresAt) <= 0}
                          ⚠️ Expired
                        {:else if getDaysUntilExpiry(share.expiresAt) <= 30}
                          ⚠️ Expires in {getDaysUntilExpiry(share.expiresAt)} days
                        {:else}
                          Expires: {formatDate(share.expiresAt)}
                        {/if}
                      </span>
                    </div>
                    <div class="share-stats">
                      <svg class="stats-icon" viewBox="0 0 24 24" fill="none"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>
                      {share.stats.viewCount} views
                    </div>
                  </div>
                  <div class="share-actions">
                    <button class="action-btn" onclick={() => copyToClipboard(`${window.location.origin}/s/${share.shortCode}${share.visibility === 'public' ? `?k=${share.shareKey}` : ''}`)}>
                      <svg class="btn-icon" viewBox="0 0 24 24" fill="none"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" fill="currentColor"/></svg>
                      Copy URL
                    </button>
                    {#if getDaysUntilExpiry(share.expiresAt) <= 30}
                      <button class="action-btn renew" onclick={() => handleRenewShare(share)}>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
                        Renew
                      </button>
                    {/if}
                    <button class="action-btn" onclick={() => handleRegenerateKey(share)}>
                      <svg class="btn-icon" viewBox="0 0 24 24" fill="none"><path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="currentColor"/></svg>
                      New Key
                    </button>
                    <button class="action-btn delete" onclick={() => handleDeleteShare(share)}>
                      <svg class="btn-icon" viewBox="0 0 24 24" fill="none"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
                      Delete
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Fixed footer for Create tab -->
    {#if activeTab === 'create' && !createdShare}
      <div class="dialog-footer">
        <button class="cancel-btn" onclick={onClose}>Cancel</button>
        <button 
          class="create-btn" 
          onclick={handleCreateShare}
          disabled={isLoading || selectedLayers.length === 0}
        >
          {isLoading ? 'Creating...' : 'Create Share Link'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .share-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .share-dialog {
    background: var(--surface-color, #fff);
    border-radius: 12px;
    width: 100%;
    max-width: 500px;
    max-height: min(92vh, 800px);
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    flex-shrink: 0;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-icon {
    width: 24px;
    height: 24px;
    color: var(--accent-color, #0078d4);
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    color: var(--text-secondary, #666);
  }

  .close-btn:hover {
    background: var(--border-color, #e0e0e0);
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .message {
    padding: 0.5rem 1.25rem;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .message.success {
    background: #d4edda;
    color: #155724;
  }

  .message.error {
    background: #f8d7da;
    color: #721c24;
  }

  .dialog-tabs {
    display: flex;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    flex-shrink: 0;
  }

  .tab-btn {
    flex: 1;
    padding: 0.625rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary, #666);
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }

  .tab-btn:hover {
    color: var(--text-color, #333);
    background: var(--background-color, #f5f5f5);
  }

  .tab-btn.active {
    color: var(--accent-color, #0078d4);
    border-bottom-color: var(--accent-color, #0078d4);
  }

  .dialog-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem 1.25rem;
    scroll-behavior: smooth;
    scrollbar-width: thin;
    scrollbar-color: var(--border-color, #e0e0e0) transparent;
  }

  .dialog-content::-webkit-scrollbar {
    width: 6px;
  }

  .dialog-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .dialog-content::-webkit-scrollbar-thumb {
    background: var(--border-color, #d0d0d0);
    border-radius: 3px;
  }

  .dialog-content::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary, #999);
  }

  /* Create Form Styles */
  .create-form {
    display: flex;
    flex-direction: column;
  }

  .form-section {
    margin-bottom: 1rem;
  }

  .form-section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-color, #333);
    margin-bottom: 0.375rem;
  }

  .visibility-options {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .radio-option {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .radio-option:hover {
    border-color: var(--accent-color, #0078d4);
  }

  .radio-option input[type="radio"] {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .option-title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 500;
    font-size: 0.875rem;
  }

  .option-icon {
    width: 16px;
    height: 16px;
    color: var(--text-secondary, #666);
    flex-shrink: 0;
  }

  .option-desc {
    font-size: 0.7rem;
    color: var(--text-secondary, #666);
    line-height: 1.3;
  }

  .layer-checkboxes {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .layer-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .text-input {
    width: 100%;
    padding: 0.4rem 0.625rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.8rem;
    margin-top: 0.375rem;
    box-sizing: border-box;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--accent-color, #0078d4);
  }

  textarea.text-input {
    resize: vertical;
    font-family: inherit;
    min-height: 50px;
  }

  .settings-grid {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
    padding: 0.75rem 1.25rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
    background: var(--surface-color, #fff);
    flex-shrink: 0;
  }

  .cancel-btn, .create-btn {
    padding: 0.4rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
  }

  .cancel-btn {
    background: none;
    border: 1px solid var(--border-color, #e0e0e0);
    color: var(--text-color, #333);
  }

  .cancel-btn:hover {
    background: var(--background-color, #f5f5f5);
  }

  .create-btn {
    background: var(--accent-color, #0078d4);
    border: none;
    color: white;
  }

  .create-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-color, #0078d4) 85%, black);
  }

  .create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Share Success Styles */
  .share-success {
    text-align: center;
  }

  .success-icon {
    width: 64px;
    height: 64px;
    background: #d4edda;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  .success-icon svg {
    width: 32px;
    height: 32px;
    color: #155724;
  }

  .share-success h3 {
    margin: 0 0 1.5rem;
  }

  .share-result {
    margin-bottom: 1rem;
    text-align: left;
  }

  .result-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary, #666);
    margin-bottom: 0.25rem;
  }

  .copy-field {
    display: flex;
    gap: 0.5rem;
  }

  .copy-field input, .copy-field textarea {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: monospace;
    background: var(--background-color, #f5f5f5);
  }

  .copy-btn {
    padding: 0.5rem 1rem;
    background: var(--accent-color, #0078d4);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .share-meta {
    display: flex;
    justify-content: center;
    gap: 1rem;
    font-size: 0.8rem;
    color: var(--text-secondary, #666);
    margin: 1rem 0;
  }

  .create-another-btn {
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    cursor: pointer;
    color: var(--text-color, #333);
  }

  /* Manage Shares Styles */
  .loading, .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-secondary, #666);
  }

  .create-first-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: var(--accent-color, #0078d4);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .shares-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .share-card {
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 1rem;
  }

  .share-card.expired {
    opacity: 0.6;
    border-color: #dc3545;
  }

  .share-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .share-name {
    font-weight: 600;
  }

  .share-visibility {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    background: #e0e0e0;
  }

  .share-visibility.public {
    background: #cce5ff;
    color: #004085;
  }

  .visibility-icon {
    width: 12px;
    height: 12px;
  }

  .share-card .share-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
    margin: 0.5rem 0;
    justify-content: flex-start;
  }

  .expiry.warning {
    color: #856404;
    font-weight: 500;
  }

  .share-stats {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-secondary, #666);
  }

  .stats-icon {
    width: 14px;
    height: 14px;
  }

  .share-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    border: 1px solid var(--border-color, #e0e0e0);
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .btn-icon {
    width: 12px;
    height: 12px;
  }

  .action-btn:hover {
    background: var(--background-color, #f5f5f5);
  }

  .action-btn.renew {
    border-color: #ffc107;
    background: #fff3cd;
  }

  .action-btn.delete {
    border-color: #dc3545;
    color: #dc3545;
  }

  .action-btn.delete:hover {
    background: #f8d7da;
  }
</style>
