<script lang="ts">
  import type { ActivityTypeConfig, ActivityTypeFormData, ActivityIcon } from "../types/admin";
  import { defaultActivityTypes, activityIconPaths, generateHighlightColor } from "../types/admin";
  import type { Layer, LayerType } from "../types/hierarchy";
  import { supportedCountries, getCountryName } from "../services/holidayService";
  import ColorPicker from "./ColorPicker.svelte";
  import IconPicker from "./IconPicker.svelte";

  // Props
  let {
    isAdmin = false,
    activityTypes: initialTypes = defaultActivityTypes,
    layers: initialLayers = [],
    onClose,
    onTypesUpdate,
    onLayersUpdate,
    onMoveActivities,
    onDeleteLayerActivities,
  }: {
    isAdmin: boolean;
    activityTypes?: ActivityTypeConfig[];
    layers?: Layer[];
    onClose?: () => void;
    onTypesUpdate?: (types: ActivityTypeConfig[]) => void;
    onLayersUpdate?: (layers: Layer[]) => void;
    onMoveActivities?: (fromLayerId: string, toLayerId: string) => void;
    onDeleteLayerActivities?: (layerId: string) => void;
  } = $props();

  // Tab state
  type AdminTab = 'layers' | 'types';
  let activeTab = $state<AdminTab>('layers');

  // State - initialize from props
  let activityTypes = $state<ActivityTypeConfig[]>([]);
  let layers = $state<Layer[]>([]);
  
  // Sync state with props
  $effect(() => {
    activityTypes = [...initialTypes];
  });
  
  $effect(() => {
    layers = [...initialLayers];
  });
  
  // Activity type form state
  let showForm = $state(false);
  let editingType = $state<ActivityTypeConfig | null>(null);
  let formData = $state<ActivityTypeFormData>({
    key: "",
    label: "",
    color: "#0078D4",
    icon: "calendar",
    description: "",
  });
  
  // Layer form state
  let showLayerForm = $state(false);
  let editingLayer = $state<Layer | null>(null);
  let layerFormData = $state<{
    name: string;
    description: string;
    type: LayerType;
    color: string;
    holidayCountryCode: string;
  }>({
    name: "",
    description: "",
    type: "custom",
    color: "#3498DB",
    holidayCountryCode: "NO",
  });
  
  // Delete layer dialog state
  let showDeleteDialog = $state(false);
  let layerToDelete = $state<Layer | null>(null);
  let deleteAction = $state<'move' | 'delete'>('delete');
  let moveToLayerId = $state<string>('');
  
  let saveMessage = $state<string | null>(null);

  // Notify parent when types change
  function emitTypesUpdate() {
    onTypesUpdate?.(activityTypes);
  }
  
  // Notify parent when layers change
  function emitLayersUpdate() {
    onLayersUpdate?.(layers);
  }

  // Sorted activity types
  const sortedTypes = $derived(
    [...activityTypes].sort((a, b) => a.sortOrder - b.sortOrder)
  );

  function resetForm() {
    formData = {
      key: "",
      label: "",
      color: "#0078D4",
      icon: "calendar",
      description: "",
    };
    editingType = null;
    showForm = false;
  }

  function handleEdit(type: ActivityTypeConfig) {
    editingType = type;
    formData = {
      key: type.key,
      label: type.label,
      color: type.color,
      icon: type.icon,
      description: type.description || "",
    };
    showForm = true;
  }

  function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formData.key || !formData.label) {
      return;
    }

    // Auto-generate highlight color from the main color
    const highlightColor = generateHighlightColor(formData.color);

    if (editingType) {
      // Update existing
      activityTypes = activityTypes.map((t) =>
        t.id === editingType!.id
          ? { ...t, ...formData, highlightColor }
          : t
      );
      emitTypesUpdate();
      showMessage("Activity type updated successfully");
    } else {
      // Add new
      const newType: ActivityTypeConfig = {
        id: crypto.randomUUID(),
        key: formData.key.toLowerCase().replace(/\s+/g, "_"),
        label: formData.label,
        color: formData.color,
        highlightColor,
        icon: formData.icon,
        description: formData.description,
        isDefault: false,
        sortOrder: activityTypes.length + 1,
      };
      activityTypes = [...activityTypes, newType];
      emitTypesUpdate();
      showMessage("Activity type added successfully");
    }

    resetForm();
  }

  function handleDelete(type: ActivityTypeConfig) {
    if (type.isDefault) {
      showMessage("Cannot delete default activity types");
      return;
    }

    if (confirm(`Are you sure you want to delete "${type.label}"?`)) {
      activityTypes = activityTypes.filter((t) => t.id !== type.id);
      emitTypesUpdate();
      showMessage("Activity type deleted");
    }
  }

  function handleColorChange(color: string) {
    formData.color = color;
  }

  function handleIconChange(icon: ActivityIcon) {
    formData.icon = icon;
  }

  function showMessage(message: string) {
    saveMessage = message;
    setTimeout(() => {
      saveMessage = null;
    }, 3000);
  }

  function handleMoveUp(type: ActivityTypeConfig) {
    const index = activityTypes.findIndex((t) => t.id === type.id);
    if (index > 0) {
      const newTypes = [...activityTypes];
      const prevOrder = newTypes[index - 1].sortOrder;
      newTypes[index - 1].sortOrder = newTypes[index].sortOrder;
      newTypes[index].sortOrder = prevOrder;
      activityTypes = newTypes;
      emitTypesUpdate();
    }
  }

  function handleMoveDown(type: ActivityTypeConfig) {
    const index = activityTypes.findIndex((t) => t.id === type.id);
    if (index < activityTypes.length - 1) {
      const newTypes = [...activityTypes];
      const nextOrder = newTypes[index + 1].sortOrder;
      newTypes[index + 1].sortOrder = newTypes[index].sortOrder;
      newTypes[index].sortOrder = nextOrder;
      activityTypes = newTypes;
      emitTypesUpdate();
    }
  }

  // --- Layer management functions ---
  
  // Sorted layers by ring index
  const sortedLayers = $derived(
    [...layers].sort((a, b) => a.ringIndex - b.ringIndex)
  );

  function resetLayerForm() {
    layerFormData = {
      name: "",
      description: "",
      type: "custom",
      color: "#3498DB",
      holidayCountryCode: "NO",
    };
    editingLayer = null;
    showLayerForm = false;
  }

  function handleEditLayer(layer: Layer) {
    editingLayer = layer;
    layerFormData = {
      name: layer.name,
      description: layer.description || "",
      type: layer.type,
      color: layer.color,
      holidayCountryCode: layer.holidayCountryCode || "NO",
    };
    showLayerForm = true;
  }

  function handleSubmitLayer(event: Event) {
    event.preventDefault();

    if (!layerFormData.name) {
      return;
    }

    // Validate holiday country code when type is holidays
    if (layerFormData.type === 'holidays' && !layerFormData.holidayCountryCode) {
      showMessage("Please select a country for the holiday calendar");
      return;
    }

    if (editingLayer) {
      // Update existing layer
      layers = layers.map((l) =>
        l.id === editingLayer!.id
          ? { 
              ...l, 
              name: layerFormData.name, 
              description: layerFormData.description, 
              type: layerFormData.type, 
              color: layerFormData.color,
              holidayCountryCode: layerFormData.type === 'holidays' ? layerFormData.holidayCountryCode : undefined,
            }
          : l
      );
      emitLayersUpdate();
      showMessage("Layer updated successfully");
    } else {
      // Add new layer
      const maxRingIndex = layers.length > 0 ? Math.max(...layers.map(l => l.ringIndex)) : -1;
      
      // Generate unique ID for holiday layers based on country code
      const layerId = layerFormData.type === 'holidays' 
        ? `layer-holidays-${layerFormData.holidayCountryCode.toLowerCase()}-${crypto.randomUUID().slice(0, 4)}`
        : `layer-${crypto.randomUUID().slice(0, 8)}`;
      
      const newLayer: Layer = {
        id: layerId,
        name: layerFormData.name,
        description: layerFormData.description || undefined,
        type: layerFormData.type,
        color: layerFormData.color,
        ringIndex: maxRingIndex + 1,
        isVisible: true,
        createdBy: 'admin', // Will be replaced with actual user ID
        createdAt: new Date(),
        organizationId: 'org-1', // Will be replaced with actual org ID
        holidayCountryCode: layerFormData.type === 'holidays' ? layerFormData.holidayCountryCode : undefined,
      };
      layers = [...layers, newLayer];
      emitLayersUpdate();
      showMessage("Layer added successfully");
    }

    resetLayerForm();
  }

  function handleDeleteLayer(layer: Layer) {
    // Check if this is a system layer (holidays, organization)
    if (layer.type === 'holidays' || layer.type === 'organization') {
      showMessage("Cannot delete system layers. You can hide them instead.");
      return;
    }

    // Show delete dialog with options
    layerToDelete = layer;
    deleteAction = 'delete';
    // Default move target to the first available layer that isn't the one being deleted
    const availableLayers = layers.filter(l => l.id !== layer.id && l.type !== 'holidays');
    moveToLayerId = availableLayers.length > 0 ? availableLayers[0].id : '';
    showDeleteDialog = true;
  }

  function confirmDeleteLayer() {
    if (!layerToDelete) return;

    if (deleteAction === 'move' && moveToLayerId) {
      // Move activities to another layer
      onMoveActivities?.(layerToDelete.id, moveToLayerId);
      showMessage(`Activities moved to "${layers.find(l => l.id === moveToLayerId)?.name}"`);
    } else {
      // Delete all activities in the layer
      onDeleteLayerActivities?.(layerToDelete.id);
    }

    // Remove the layer
    layers = layers.filter((l) => l.id !== layerToDelete!.id);
    // Re-index remaining layers
    layers = layers.map((l, i) => ({ ...l, ringIndex: i }));
    emitLayersUpdate();
    
    showMessage(`Layer "${layerToDelete.name}" deleted`);
    cancelDeleteDialog();
  }

  function cancelDeleteDialog() {
    showDeleteDialog = false;
    layerToDelete = null;
    deleteAction = 'delete';
    moveToLayerId = '';
  }

  // Get layers that can receive moved activities (excluding the one being deleted and holiday layers)
  const availableTargetLayers = $derived(
    layers.filter(l => layerToDelete && l.id !== layerToDelete.id && l.type !== 'holidays')
  );

  function handleLayerColorChange(color: string) {
    layerFormData.color = color;
  }

  function handleMoveLayerUp(layer: Layer) {
    const index = sortedLayers.findIndex((l) => l.id === layer.id);
    if (index > 0) {
      const prevLayer = sortedLayers[index - 1];
      layers = layers.map((l) => {
        if (l.id === layer.id) return { ...l, ringIndex: prevLayer.ringIndex };
        if (l.id === prevLayer.id) return { ...l, ringIndex: layer.ringIndex };
        return l;
      });
      emitLayersUpdate();
    }
  }

  function handleMoveLayerDown(layer: Layer) {
    const index = sortedLayers.findIndex((l) => l.id === layer.id);
    if (index < sortedLayers.length - 1) {
      const nextLayer = sortedLayers[index + 1];
      layers = layers.map((l) => {
        if (l.id === layer.id) return { ...l, ringIndex: nextLayer.ringIndex };
        if (l.id === nextLayer.id) return { ...l, ringIndex: layer.ringIndex };
        return l;
      });
      emitLayersUpdate();
    }
  }

  function toggleLayerVisibility(layer: Layer) {
    layers = layers.map((l) =>
      l.id === layer.id ? { ...l, isVisible: !l.isVisible } : l
    );
    emitLayersUpdate();
  }

  function getLayerTypeLabel(type: LayerType): string {
    switch (type) {
      case 'holidays': return 'Holidays';
      case 'organization': return 'Organization';
      case 'custom': return 'Custom';
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="admin-overlay" onclick={onClose}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="admin-panel" onclick={(e) => e.stopPropagation()}>
    <div class="admin-header">
      <div class="header-title">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.012 2.25c.734.008 1.465.093 2.182.253a.75.75 0 0 1 .582.649l.17 1.527a1.384 1.384 0 0 0 1.927 1.116l1.401-.615a.75.75 0 0 1 .85.174 9.792 9.792 0 0 1 2.204 3.792.75.75 0 0 1-.271.825l-1.242.916a1.381 1.381 0 0 0 0 2.226l1.243.915a.75.75 0 0 1 .272.826 9.797 9.797 0 0 1-2.204 3.792.75.75 0 0 1-.848.175l-1.407-.617a1.38 1.38 0 0 0-1.926 1.114l-.169 1.526a.75.75 0 0 1-.572.647 9.518 9.518 0 0 1-4.406 0 .75.75 0 0 1-.572-.647l-.168-1.524a1.382 1.382 0 0 0-1.926-1.11l-1.406.616a.75.75 0 0 1-.849-.175 9.798 9.798 0 0 1-2.204-3.796.75.75 0 0 1 .272-.826l1.243-.916a1.38 1.38 0 0 0 0-2.226l-1.243-.914a.75.75 0 0 1-.271-.826 9.793 9.793 0 0 1 2.204-3.792.75.75 0 0 1 .85-.174l1.4.615a1.387 1.387 0 0 0 1.93-1.118l.17-1.526a.75.75 0 0 1 .583-.65c.717-.159 1.45-.243 2.201-.252Zm0 1.5a9.135 9.135 0 0 0-1.354.117l-.109.977A2.886 2.886 0 0 1 6.525 7.17l-.898-.394a8.293 8.293 0 0 0-1.348 2.317l.798.587a2.881 2.881 0 0 1 0 4.643l-.799.588c.32.842.776 1.626 1.348 2.322l.905-.397a2.882 2.882 0 0 1 4.017 2.318l.11.984c.889.15 1.798.15 2.687 0l.11-.984a2.881 2.881 0 0 1 4.018-2.322l.905.396a8.296 8.296 0 0 0 1.347-2.318l-.798-.588a2.881 2.881 0 0 1 0-4.643l.796-.587a8.293 8.293 0 0 0-1.348-2.317l-.896.393a2.884 2.884 0 0 1-4.023-2.324l-.11-.976a8.988 8.988 0 0 0-1.333-.117ZM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm0 1.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" fill="currentColor"/>
        </svg>
        <h2>Admin Settings</h2>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="m4.21 4.387.083-.094a1 1 0 0 1 1.32-.083l.094.083L12 10.585l6.293-6.292a1 1 0 1 1 1.414 1.414L13.415 12l6.292 6.293a1 1 0 0 1 .083 1.32l-.083.094a1 1 0 0 1-1.32.083l-.094-.083L12 13.415l-6.293 6.292a1 1 0 0 1-1.414-1.414L10.585 12 4.293 5.707a1 1 0 0 1-.083-1.32l.083-.094-.083.094Z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    {#if !isAdmin}
      <div class="access-denied">
        <div class="denied-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2a4 4 0 0 1 4 4v2h1.75C18.993 8 20 9.007 20 10.25v9.5c0 1.243-1.007 2.25-2.25 2.25H6.25A2.25 2.25 0 0 1 4 19.75v-9.5C4 9.007 5.007 8 6.25 8H8V6a4 4 0 0 1 4-4Zm0 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM12 3.5A2.5 2.5 0 0 0 9.5 6v2h5V6A2.5 2.5 0 0 0 12 3.5Z" fill="currentColor"/>
          </svg>
        </div>
        <h3>Access Denied</h3>
        <p>You need the <strong>admin.write</strong> role to access this page.</p>
        <p class="help-text">Contact your administrator to request access.</p>
      </div>
    {:else}
      <div class="admin-content">
        {#if saveMessage}
          <div class="save-message">
            <svg class="check-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.22 6.97-4.47 4.47-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5a.75.75 0 1 0-1.06-1.06Z" fill="currentColor"/>
            </svg>
            {saveMessage}
          </div>
        {/if}

        <!-- Tabs -->
        <div class="admin-tabs">
          <button 
            class="tab-btn" 
            class:active={activeTab === 'layers'}
            onclick={() => activeTab = 'layers'}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="tab-icon">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Layers
          </button>
          <button 
            class="tab-btn" 
            class:active={activeTab === 'types'}
            onclick={() => activeTab = 'types'}
          >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="tab-icon">
              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" fill="currentColor"/>
            </svg>
            Activity Types
          </button>
        </div>

        <!-- Layers Tab -->
        {#if activeTab === 'layers'}
          <section class="settings-section">
            <div class="section-header">
              <h3>Wheel Layers</h3>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <fluent-button appearance="primary" onclick={() => (showLayerForm = true)}>
                + Add Layer
              </fluent-button>
            </div>

            <p class="section-description">
              Manage the layers (rings) displayed on the annual wheel. Each layer represents a category of activities.
              Drag to reorder, or use arrows to change the ring position (inner to outer).
            </p>

            {#if showLayerForm}
              <div class="type-form-container">
                <form class="type-form" onsubmit={handleSubmitLayer}>
                  <h4>{editingLayer ? "Edit Layer" : "New Layer"}</h4>
                  
                  <div class="form-row">
                    <label class="form-field">
                      <span class="field-label">Name *</span>
                      <input
                        type="text"
                        class="text-input"
                        bind:value={layerFormData.name}
                        placeholder="e.g., Public Events"
                        required
                      />
                    </label>
                  </div>

                  <div class="form-row">
                    <label class="form-field">
                      <span class="field-label">Type</span>
                      <select class="text-input" bind:value={layerFormData.type} disabled={editingLayer?.type === 'holidays' || editingLayer?.type === 'organization'}>
                        <option value="holidays">Holidays</option>
                        <option value="organization">Organization</option>
                        <option value="custom">Custom</option>
                      </select>
                      <span class="field-hint">Type determines special behavior (e.g., holiday layers fetch public holidays from selected country).</span>
                    </label>
                  </div>

                  {#if layerFormData.type === 'holidays'}
                    <div class="form-row">
                      <label class="form-field">
                        <span class="field-label">Country *</span>
                        <select class="text-input" bind:value={layerFormData.holidayCountryCode}>
                          {#each supportedCountries as country}
                            <option value={country.code}>
                              {country.name}{country.nameLocal ? ` (${country.nameLocal})` : ''}
                            </option>
                          {/each}
                        </select>
                        <span class="field-hint">Public holidays will be fetched from <a href="https://date.nager.at" target="_blank" rel="noopener">Nager.Date API</a> for this country.</span>
                      </label>
                    </div>
                  {/if}

                  <div class="form-row">
                    <div class="form-field">
                      <span class="field-label">Color *</span>
                      <ColorPicker
                        value={layerFormData.color}
                        onchange={handleLayerColorChange}
                      />
                    </div>
                  </div>

                  <div class="form-row">
                    <label class="form-field">
                      <span class="field-label">Description</span>
                      <textarea
                        class="text-input textarea"
                        bind:value={layerFormData.description}
                        placeholder="Optional description..."
                        rows="2"
                      ></textarea>
                    </label>
                  </div>

                  <div class="form-actions">
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <fluent-button type="button" appearance="secondary" onclick={resetLayerForm}>
                      Cancel
                    </fluent-button>
                    <fluent-button type="submit" appearance="primary">
                      {editingLayer ? "Update" : "Add"}
                    </fluent-button>
                  </div>
                </form>
              </div>
            {/if}

            <div class="types-list">
              {#each sortedLayers as layer, index (layer.id)}
                <div class="type-card" class:disabled={!layer.isVisible}>
                  <div class="type-color-icon" style="background-color: {layer.color}">
                    <svg class="type-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="type-info">
                    <div class="type-header">
                      <span class="type-label">{layer.name}</span>
                      <span class="type-key">Ring {layer.ringIndex + 1}</span>
                      <span class="layer-type-badge" class:holidays={layer.type === 'holidays'} class:organization={layer.type === 'organization'}>
                        {getLayerTypeLabel(layer.type)}
                      </span>
                      {#if layer.type === 'holidays' && layer.holidayCountryCode}
                        <span class="country-badge" title="Country: {getCountryName(layer.holidayCountryCode)}">
                          🌍 {layer.holidayCountryCode}
                        </span>
                      {/if}
                    </div>
                    {#if layer.description}
                      <p class="type-description">{layer.description}</p>
                    {/if}
                    <div class="type-meta">
                      <span class="meta-item">
                        Color: <code>{layer.color}</code>
                      </span>
                      <span class="meta-item">
                        {layer.isVisible ? '👁 Visible' : '👁‍🗨 Hidden'}
                      </span>
                      {#if layer.type === 'holidays' && layer.holidayCountryCode}
                        <span class="meta-item">
                          Country: <code>{getCountryName(layer.holidayCountryCode)}</code>
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="type-actions">
                    <button
                      class="icon-btn"
                      onclick={() => handleMoveLayerUp(layer)}
                      disabled={index === 0}
                      aria-label="Move up (inner)"
                      title="Move to inner ring"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.293 15.707a1 1 0 0 0 1.414 0L12 9.414l6.293 6.293a1 1 0 0 0 1.414-1.414l-7-7a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 0 1.414Z" fill="currentColor"/>
                      </svg>
                    </button>
                    <button
                      class="icon-btn"
                      onclick={() => handleMoveLayerDown(layer)}
                      disabled={index === sortedLayers.length - 1}
                      aria-label="Move down (outer)"
                      title="Move to outer ring"
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4.293 8.293a1 1 0 0 1 1.414 0L12 14.586l6.293-6.293a1 1 0 1 1 1.414 1.414l-7 7a1 1 0 0 1-1.414 0l-7-7a1 1 0 0 1 0-1.414Z" fill="currentColor"/>
                      </svg>
                    </button>
                    <button 
                      class="icon-btn" 
                      class:active={layer.isVisible}
                      onclick={() => toggleLayerVisibility(layer)} 
                      aria-label={layer.isVisible ? "Hide layer" : "Show layer"}
                      title={layer.isVisible ? "Hide layer" : "Show layer"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {#if layer.isVisible}
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/>
                        {:else}
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" fill="currentColor"/>
                        {/if}
                      </svg>
                    </button>
                    <button class="icon-btn edit" onclick={() => handleEditLayer(layer)} aria-label="Edit">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21.03 2.97a3.578 3.578 0 0 1 0 5.06L9.062 20a2.25 2.25 0 0 1-.999.58l-5.116 1.395a.75.75 0 0 1-.92-.921l1.395-5.116a2.25 2.25 0 0 1 .58-.999L15.97 2.97a3.578 3.578 0 0 1 5.06 0ZM15 6.06 5.062 16a.75.75 0 0 0-.193.333l-1.05 3.85 3.85-1.05A.75.75 0 0 0 8 18.938L17.94 9 15 6.06Zm2.03-2.03-.97.97L19 7.94l.97-.97a2.079 2.079 0 0 0-2.94-2.94Z" fill="currentColor"/>
                      </svg>
                    </button>
                    <button
                      class="icon-btn delete"
                      onclick={() => handleDeleteLayer(layer)}
                      disabled={layer.type === 'holidays' || layer.type === 'organization'}
                      aria-label="Delete"
                      title={layer.type === 'holidays' || layer.type === 'organization' ? "System layers cannot be deleted" : "Delete layer"}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M21.5 6a1 1 0 0 1-.883.993L20.5 7h-.845l-1.231 12.52A2.75 2.75 0 0 1 15.687 22H8.313a2.75 2.75 0 0 1-2.737-2.48L4.345 7H3.5a1 1 0 0 1 0-2h5a3.5 3.5 0 1 1 7 0h5a1 1 0 0 1 1 1Zm-7.25 3.25a.75.75 0 0 0-.743.648L13.5 10v7a.75.75 0 0 0 1.493.102L15 17v-7a.75.75 0 0 0-.75-.75Zm-4.5 0a.75.75 0 0 0-.743.648L9 10v7a.75.75 0 0 0 1.493.102L10.5 17v-7a.75.75 0 0 0-.75-.75ZM12 3.5A1.5 1.5 0 0 0 10.5 5h3A1.5 1.5 0 0 0 12 3.5Z" fill="currentColor"/>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Activity Types Tab -->
        {#if activeTab === 'types'}
        <section class="settings-section">
          <div class="section-header">
            <h3>Activity Types</h3>
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <fluent-button appearance="primary" onclick={() => (showForm = true)}>
              + Add Type
            </fluent-button>
          </div>

          <p class="section-description">
            Configure the activity types available in the annual wheel. Each type has a unique color for easy identification.
          </p>

          {#if showForm}
            <div class="type-form-container">
              <form class="type-form" onsubmit={handleSubmit}>
                <h4>{editingType ? "Edit Activity Type" : "New Activity Type"}</h4>
                
                <div class="form-row">
                  <label class="form-field">
                    <span class="field-label">Label *</span>
                    <input
                      type="text"
                      class="text-input"
                      bind:value={formData.label}
                      placeholder="e.g., Workshop"
                      required
                    />
                  </label>
                </div>

                <div class="form-row">
                  <label class="form-field">
                    <span class="field-label">Key *</span>
                    <input
                      type="text"
                      class="text-input"
                      bind:value={formData.key}
                      placeholder="e.g., workshop"
                      pattern="[a-z_]+"
                      title="Lowercase letters and underscores only"
                      required
                      disabled={editingType?.isDefault}
                    />
                    <span class="field-hint">Lowercase, no spaces. Used internally.</span>
                  </label>
                </div>

                <div class="form-row">
                  <div class="form-field">
                    <span class="field-label">Color *</span>
                    <ColorPicker
                      value={formData.color}
                      onchange={handleColorChange}
                    />
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-field">
                    <span class="field-label">Icon *</span>
                    <IconPicker
                      value={formData.icon}
                      onchange={handleIconChange}
                    />
                  </div>
                </div>

                <div class="form-row">
                  <label class="form-field">
                    <span class="field-label">Description</span>
                    <textarea
                      class="text-input textarea"
                      bind:value={formData.description}
                      placeholder="Optional description..."
                      rows="2"
                    ></textarea>
                  </label>
                </div>

                <div class="form-actions">
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <fluent-button type="button" appearance="secondary" onclick={resetForm}>
                    Cancel
                  </fluent-button>
                  <fluent-button type="submit" appearance="primary">
                    {editingType ? "Update" : "Add"}
                  </fluent-button>
                </div>
              </form>
            </div>
          {/if}

          <div class="types-list">
            {#each sortedTypes as type, index (type.id)}
              <div class="type-card">
                <div class="type-color-icon" style="background-color: {type.color}">
                  <svg class="type-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d={activityIconPaths[type.icon]} fill="white"/>
                  </svg>
                </div>
                <div class="type-info">
                  <div class="type-header">
                    <span class="type-label">{type.label}</span>
                    <span class="type-key">{type.key}</span>
                    {#if type.isDefault}
                      <span class="default-badge">Default</span>
                    {/if}
                  </div>
                  {#if type.description}
                    <p class="type-description">{type.description}</p>
                  {/if}
                  <div class="type-meta">
                    <span class="meta-item">
                      Color: <code>{type.color}</code>
                    </span>
                    <span class="meta-item">
                      Icon: <code>{type.icon}</code>
                    </span>
                  </div>
                </div>
                <div class="type-actions">
                  <button
                    class="icon-btn"
                    onclick={() => handleMoveUp(type)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.293 15.707a1 1 0 0 0 1.414 0L12 9.414l6.293 6.293a1 1 0 0 0 1.414-1.414l-7-7a1 1 0 0 0-1.414 0l-7 7a1 1 0 0 0 0 1.414Z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    class="icon-btn"
                    onclick={() => handleMoveDown(type)}
                    disabled={index === sortedTypes.length - 1}
                    aria-label="Move down"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.293 8.293a1 1 0 0 1 1.414 0L12 14.586l6.293-6.293a1 1 0 1 1 1.414 1.414l-7 7a1 1 0 0 1-1.414 0l-7-7a1 1 0 0 1 0-1.414Z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button class="icon-btn edit" onclick={() => handleEdit(type)} aria-label="Edit">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.03 2.97a3.578 3.578 0 0 1 0 5.06L9.062 20a2.25 2.25 0 0 1-.999.58l-5.116 1.395a.75.75 0 0 1-.92-.921l1.395-5.116a2.25 2.25 0 0 1 .58-.999L15.97 2.97a3.578 3.578 0 0 1 5.06 0ZM15 6.06 5.062 16a.75.75 0 0 0-.193.333l-1.05 3.85 3.85-1.05A.75.75 0 0 0 8 18.938L17.94 9 15 6.06Zm2.03-2.03-.97.97L19 7.94l.97-.97a2.079 2.079 0 0 0-2.94-2.94Z" fill="currentColor"/>
                    </svg>
                  </button>
                  <button
                    class="icon-btn delete"
                    onclick={() => handleDelete(type)}
                    disabled={type.isDefault}
                    aria-label="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.5 6a1 1 0 0 1-.883.993L20.5 7h-.845l-1.231 12.52A2.75 2.75 0 0 1 15.687 22H8.313a2.75 2.75 0 0 1-2.737-2.48L4.345 7H3.5a1 1 0 0 1 0-2h5a3.5 3.5 0 1 1 7 0h5a1 1 0 0 1 1 1Zm-7.25 3.25a.75.75 0 0 0-.743.648L13.5 10v7a.75.75 0 0 0 1.493.102L15 17v-7a.75.75 0 0 0-.75-.75Zm-4.5 0a.75.75 0 0 0-.743.648L9 10v7a.75.75 0 0 0 1.493.102L10.5 17v-7a.75.75 0 0 0-.75-.75ZM12 3.5A1.5 1.5 0 0 0 10.5 5h3A1.5 1.5 0 0 0 12 3.5Z" fill="currentColor"/>
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </section>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Delete Layer Dialog -->
{#if showDeleteDialog && layerToDelete}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="delete-dialog-overlay" onclick={cancelDeleteDialog}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="delete-dialog" onclick={(e) => e.stopPropagation()}>
      <div class="delete-dialog-header">
        <svg class="warning-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.91 2.782a2.25 2.25 0 0 1 2.975.74l.083.138 7.759 14.009a2.25 2.25 0 0 1-1.814 3.334l-.154.006H4.243a2.25 2.25 0 0 1-2.041-3.197l.072-.143L10.031 3.66a2.25 2.25 0 0 1 .878-.878ZM12 16.002a.999.999 0 1 0 0 1.997.999.999 0 0 0 0-1.997ZM12 8.5a.75.75 0 0 0-.743.648l-.007.102v4.5a.75.75 0 0 0 1.493.102l.007-.102v-4.5A.75.75 0 0 0 12 8.5Z" fill="currentColor"/>
        </svg>
        <h3>Delete Layer</h3>
      </div>
      
      <p class="delete-dialog-message">
        You are about to delete <strong>"{layerToDelete.name}"</strong>.
        What would you like to do with the activities in this layer?
      </p>

      <div class="delete-options">
        <label class="delete-option">
          <input 
            type="radio" 
            name="deleteAction" 
            value="delete" 
            checked={deleteAction === 'delete'}
            onchange={() => deleteAction = 'delete'}
          />
          <div class="option-content">
            <span class="option-title">Delete all activities</span>
            <span class="option-desc">Permanently remove all activities in this layer</span>
          </div>
        </label>

        {#if availableTargetLayers.length > 0}
          <label class="delete-option">
            <input 
              type="radio" 
              name="deleteAction" 
              value="move" 
              checked={deleteAction === 'move'}
              onchange={() => deleteAction = 'move'}
            />
            <div class="option-content">
              <span class="option-title">Move activities to another layer</span>
              <span class="option-desc">Transfer all activities to a different layer</span>
            </div>
          </label>

          {#if deleteAction === 'move'}
            <div class="move-target-select">
              <label class="form-field">
                <span class="field-label">Move to:</span>
                <select class="text-input" bind:value={moveToLayerId}>
                  {#each availableTargetLayers as targetLayer}
                    <option value={targetLayer.id}>
                      {targetLayer.name} ({getLayerTypeLabel(targetLayer.type)})
                    </option>
                  {/each}
                </select>
              </label>
            </div>
          {/if}
        {:else}
          <p class="no-targets-message">
            <em>No other layers available to move activities to.</em>
          </p>
        {/if}
      </div>

      <div class="delete-dialog-actions">
        <fluent-button appearance="secondary" onclick={cancelDeleteDialog}>
          Cancel
        </fluent-button>
        <fluent-button appearance="primary" onclick={confirmDeleteLayer} class="danger-btn">
          {deleteAction === 'move' ? 'Move & Delete Layer' : 'Delete Layer'}
        </fluent-button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    z-index: 1000;
  }

  .admin-panel {
    width: 100%;
    max-width: 600px;
    height: 100vh;
    background: var(--surface-color);
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .admin-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--background-color);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-icon {
    width: 24px;
    height: 24px;
    color: var(--text-color);
  }

  .admin-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn svg {
    width: 20px;
    height: 20px;
  }

  .close-btn:hover {
    background: var(--border-color);
    color: var(--text-color);
  }

  .admin-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  /* Tabs */
  .admin-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    border-radius: 6px 6px 0 0;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.15s;
    border-bottom: 2px solid transparent;
    margin-bottom: -0.5rem;
    padding-bottom: calc(0.5rem + 2px);
  }

  .tab-btn:hover {
    color: var(--text-color);
    background: var(--hover-color, rgba(0, 0, 0, 0.05));
  }

  .tab-btn.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
    background: var(--accent-color-light, rgba(0, 120, 212, 0.08));
  }

  .tab-icon {
    width: 18px;
    height: 18px;
  }

  /* Layer type badges */
  .layer-type-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 10px;
    background: var(--border-color);
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .layer-type-badge.holidays {
    background: #E74C3C20;
    color: #E74C3C;
  }

  .layer-type-badge.organization {
    background: #9B59B620;
    color: #9B59B6;
  }

  .country-badge {
    font-size: 0.7rem;
    padding: 2px 6px;
    border-radius: 10px;
    background: #3498DB20;
    color: #3498DB;
    font-weight: 600;
  }

  .field-hint a {
    color: var(--accent-color);
    text-decoration: none;
  }

  .field-hint a:hover {
    text-decoration: underline;
  }

  .type-card.disabled {
    opacity: 0.5;
  }

  .icon-btn.active {
    color: var(--accent-color);
  }

  .access-denied {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .denied-icon {
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }

  .denied-icon svg {
    width: 64px;
    height: 64px;
  }

  .access-denied h3 {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
  }

  .access-denied p {
    margin: 0 0 0.5rem;
    color: var(--text-secondary);
  }

  .help-text {
    font-size: 0.875rem;
  }

  .save-message {
    background: var(--success-color);
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .check-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .settings-section {
    background: var(--background-color);
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .section-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
  }

  .type-form-container {
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .type-form h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .form-row {
    margin-bottom: 1rem;
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .field-hint {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .text-input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--background-color);
    color: var(--text-color);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .text-input:focus {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
  }

  .text-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .textarea {
    resize: vertical;
    min-height: 60px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .types-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .type-card {
    display: flex;
    align-items: stretch;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow: hidden;
  }

  .type-color-icon {
    width: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .type-icon {
    width: 24px;
    height: 24px;
  }

  .type-info {
    flex: 1;
    padding: 0.75rem 1rem;
  }

  .type-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .type-label {
    font-weight: 600;
  }

  .type-key {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
    background: var(--background-color);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .default-badge {
    font-size: 0.625rem;
    background: var(--accent-color);
    color: white;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .type-description {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0.25rem 0;
  }

  .type-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .meta-item code {
    font-family: monospace;
    background: var(--background-color);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .type-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0.5rem;
    gap: 0.125rem;
    border-left: 1px solid var(--border-color);
  }

  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn svg {
    width: 18px;
    height: 18px;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--background-color);
    color: var(--text-color);
  }

  .icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .icon-btn.edit {
    color: var(--accent-color);
  }

  .icon-btn.delete {
    color: var(--error-color);
  }

  /* Delete Layer Dialog */
  .delete-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .delete-dialog {
    background: var(--surface-color);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-width: 450px;
    width: 90%;
    padding: 1.5rem;
    animation: dialogFadeIn 0.15s ease-out;
  }

  @keyframes dialogFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .delete-dialog-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .delete-dialog-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .warning-icon {
    width: 28px;
    height: 28px;
    color: #F59E0B;
    flex-shrink: 0;
  }

  .delete-dialog-message {
    margin: 0 0 1.25rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .delete-options {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .delete-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-option:hover {
    background: var(--hover-color, rgba(0, 0, 0, 0.03));
  }

  .delete-option:has(input:checked) {
    border-color: var(--accent-color);
    background: var(--accent-color-light, rgba(0, 120, 212, 0.08));
  }

  .delete-option input[type="radio"] {
    margin-top: 2px;
    accent-color: var(--accent-color);
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .option-title {
    font-weight: 500;
    color: var(--text-color);
  }

  .option-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .move-target-select {
    margin-left: 1.75rem;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: var(--background-color);
    border-radius: 6px;
  }

  .no-targets-message {
    margin: 0;
    padding: 0.5rem 0.75rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .delete-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
  }

  .danger-btn::part(control) {
    background: var(--error-color, #D13438);
  }

  .danger-btn::part(control):hover {
    background: #B91C1C;
  }
</style>
