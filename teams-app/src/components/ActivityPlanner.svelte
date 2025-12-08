<script lang="ts">
  import type { Activity, ActivityFormData, ActivityType } from "../types/activity";
  import { getActivityDuration, getWeekNumber } from "../types/activity";
  import type { ActivityTypeConfig } from "../types/admin";
  import { defaultActivityTypes, activityIconPaths } from "../types/admin";
  import type { ActivityScope, Layer } from "../types/hierarchy";
  import { t, getLocale } from "../services/i18nService";

  // Props
  let {
    activities = [],
    activityTypes = defaultActivityTypes,
    layers = [],
    onAdd,
    onDelete,
    onDeleteGroup,
    onHover,
  }: {
    activities: Activity[];
    activityTypes?: ActivityTypeConfig[];
    layers?: Layer[];
    onAdd?: (activity: Activity) => void;
    onDelete?: (id: string) => void;
    onDeleteGroup?: (repeatGroupId: string) => void;
    onHover?: (id: string | null) => void;
  } = $props();

  // Helper to get layer by scope (scope field is the layer id)
  function getLayerByScope(scope: string): Layer | undefined {
    return layers.find(l => l.id === scope);
  }

  // Track selected activity for mobile highlight
  let selectedActivityId = $state<string | null>(null);

  // Handle activity click (for mobile highlighting)
  function handleActivityClick(activityId: string) {
    // Toggle selection - if same activity clicked, deselect
    if (selectedActivityId === activityId) {
      selectedActivityId = null;
      onHover?.(null);
    } else {
      selectedActivityId = activityId;
      onHover?.(activityId);
    }
  }

  // Get activity type config by key
  function getTypeConfig(typeKey: string) {
    return activityTypes.find(t => t.key === typeKey) || activityTypes[0];
  }

  // Form state - initialize with empty, will set layer when form opens
  let formData = $state<ActivityFormData>({
    title: "",
    startDate: "",
    endDate: "",
    type: "event",
    color: getTypeConfig("event").color,
    description: "",
    scope: "" as ActivityScope,
    scopeId: "",
  });

  // Repetition state
  type RepeatPattern = 'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly';
  let isRepeating = $state(false);
  let repeatPattern = $state<RepeatPattern>('weekly');
  let repeatDays = $state<boolean[]>([false, false, false, false, false, false, false]); // Sun-Sat
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let showForm = $state(false);
  let editingId = $state<string | null>(null);
  
  // Search and filter state
  let searchQuery = $state("");
  let showDone = $state(false);

  // Delete confirmation state for repeated activities
  let showDeleteDialog = $state(false);
  let deleteActivityId = $state<string | null>(null);
  let deleteGroupId = $state<string | null>(null);
  let deleteGroupCount = $state(0);

  // Set default layer when opening form
  function openForm() {
    if (layers.length > 0 && !formData.scope) {
      formData.scope = layers[0].id as ActivityScope;
      formData.scopeId = layers[0].id;
    }
    showForm = true;
  }

  // Check if activity is done (end date is in the past)
  function isDone(activity: Activity): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activity.endDate < today;
  }

  // Derived - filter and sort activities
  const filteredActivities = $derived(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return activities.filter(a => {
      // Filter by done status
      const activityDone = a.endDate < today;
      if (!showDone && activityDone) return false;
      
      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = a.title.toLowerCase().includes(query);
        const matchesDescription = a.description?.toLowerCase().includes(query);
        const typeConfig = getTypeConfig(a.type);
        const matchesType = typeConfig.label.toLowerCase().includes(query);
        const layer = getLayerByScope(a.scope);
        const matchesLayer = layer?.name.toLowerCase().includes(query);
        
        if (!matchesTitle && !matchesDescription && !matchesType && !matchesLayer) {
          return false;
        }
      }
      
      return true;
    });
  });

  const sortedActivities = $derived(
    [...filteredActivities()].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  );
  
  // Count of done activities
  const doneCount = $derived(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activities.filter(a => a.endDate < today).length;
  });

  function resetForm() {
    const defaultType = getTypeConfig("event");
    const firstLayer = layers[0];
    formData = {
      title: "",
      startDate: "",
      endDate: "",
      type: "event",
      color: defaultType.color,
      description: "",
      scope: firstLayer?.id || "" as ActivityScope,
      scopeId: firstLayer?.id || "",
    };
    // Reset repetition state
    isRepeating = false;
    repeatPattern = 'weekly';
    repeatDays = [false, false, false, false, false, false, false];
    editingId = null;
    showForm = false;
  }

  function handleLayerChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const layerId = target.value;
    formData.scope = layerId as ActivityScope;
    formData.scopeId = layerId;
  }

  // Generate dates for repeated activities (up to 1 year)
  function generateRepeatedDates(startDate: Date, endDate: Date): Array<{start: Date, end: Date}> {
    const dates: Array<{start: Date, end: Date}> = [];
    const duration = endDate.getTime() - startDate.getTime();
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (repeatPattern === 'monthly') {
      // Monthly: same day each month
      let currentStart = new Date(startDate);
      while (currentStart < oneYearFromNow) {
        const currentEnd = new Date(currentStart.getTime() + duration);
        dates.push({ start: new Date(currentStart), end: currentEnd });
        currentStart.setMonth(currentStart.getMonth() + 1);
      }
    } else {
      // Weekly patterns
      const weekInterval = repeatPattern === 'weekly' ? 1 : repeatPattern === 'biweekly' ? 2 : 3;
      const selectedDays = repeatDays.map((selected, index) => selected ? index : -1).filter(d => d !== -1);
      
      if (selectedDays.length === 0) {
        // If no days selected, just use the start date's day
        selectedDays.push(startDate.getDay());
      }
      
      let currentWeekStart = new Date(startDate);
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Go to Sunday
      
      while (currentWeekStart < oneYearFromNow) {
        for (const dayOfWeek of selectedDays) {
          const activityStart = new Date(currentWeekStart);
          activityStart.setDate(activityStart.getDate() + dayOfWeek);
          
          if (activityStart >= startDate && activityStart < oneYearFromNow) {
            const activityEnd = new Date(activityStart.getTime() + duration);
            dates.push({ start: activityStart, end: activityEnd });
          }
        }
        currentWeekStart.setDate(currentWeekStart.getDate() + (7 * weekInterval));
      }
    }
    
    return dates;
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!formData.title || !formData.startDate || !formData.endDate) {
      return;
    }

    // Get the type config for highlight color
    const typeConfig = getTypeConfig(formData.type);
    const baseStartDate = new Date(formData.startDate);
    const baseEndDate = new Date(formData.endDate);

    if (isRepeating && !editingId) {
      // Generate repeated activities with shared group ID
      const repeatedDates = generateRepeatedDates(baseStartDate, baseEndDate);
      const repeatGroupId = crypto.randomUUID(); // Shared ID for all occurrences
      
      for (const { start, end } of repeatedDates) {
        const newActivity: Activity = {
          id: crypto.randomUUID(),
          title: formData.title,
          startDate: start,
          endDate: end,
          type: formData.type,
          color: formData.color,
          highlightColor: typeConfig.highlightColor,
          description: formData.description,
          scope: formData.scope,
          scopeId: formData.scopeId,
          repeatGroupId,
        };
        onAdd?.(newActivity);
      }
    } else {
      // Single activity
      const newActivity: Activity = {
        id: editingId || crypto.randomUUID(),
        title: formData.title,
        startDate: baseStartDate,
        endDate: baseEndDate,
        type: formData.type,
        color: formData.color,
        highlightColor: typeConfig.highlightColor,
        description: formData.description,
        scope: formData.scope,
        scopeId: formData.scopeId,
      };
      onAdd?.(newActivity);
    }

    resetForm();
  }

  function handleEdit(activity: Activity) {
    editingId = activity.id;
    formData = {
      title: activity.title,
      startDate: activity.startDate.toISOString().split("T")[0],
      endDate: activity.endDate.toISOString().split("T")[0],
      type: activity.type,
      color: activity.color,
      description: activity.description || "",
      scope: activity.scope,
      scopeId: activity.scopeId,
    };
    showForm = true;
  }

  function handleDelete(id: string) {
    const activity = activities.find(a => a.id === id);
    if (!activity) return;
    
    // Check if this is part of a repeat group
    if (activity.repeatGroupId) {
      const groupCount = activities.filter(a => a.repeatGroupId === activity.repeatGroupId).length;
      deleteActivityId = id;
      deleteGroupId = activity.repeatGroupId;
      deleteGroupCount = groupCount;
      showDeleteDialog = true;
    } else {
      // Single activity - confirm and delete directly
      if (confirm(t('activities.deleteConfirm'))) {
        onDelete?.(id);
      }
    }
  }

  function confirmDeleteSingle() {
    if (deleteActivityId) {
      onDelete?.(deleteActivityId);
    }
    closeDeleteDialog();
  }

  function confirmDeleteAll() {
    if (deleteGroupId) {
      onDeleteGroup?.(deleteGroupId);
    }
    closeDeleteDialog();
  }

  function closeDeleteDialog() {
    showDeleteDialog = false;
    deleteActivityId = null;
    deleteGroupId = null;
    deleteGroupCount = 0;
  }

  function handleTypeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newType = target.value as ActivityType;
    formData.type = newType;
    // Auto-set color based on admin-configured type
    const typeConfig = getTypeConfig(newType);
    formData.color = typeConfig.color;
  }

  function formatDateRange(start: Date, end: Date): string {
    const locale = getLocale();
    const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    const startStr = start.toLocaleDateString(locale, opts);
    const endStr = end.toLocaleDateString(locale, opts);
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  }

  function formatWeekRange(start: Date, end: Date): string | null {
    // Only show week range if activity spans more than 1 day
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (duration <= 1) return null;
    
    const startWeek = getWeekNumber(start);
    const endWeek = getWeekNumber(end);
    
    if (startWeek === endWeek) {
      return `${t('wheel.week')} ${startWeek}`;
    } else {
      return `${t('wheel.week')} ${startWeek} - ${endWeek}`;
    }
  }
</script>

<div class="planner-container">
  <div class="planner-header">
    <h2>{t('activities.title')}</h2>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <fluent-button appearance="primary" onclick={openForm}>
      + {t('activities.newActivity')}
    </fluent-button>
  </div>

  {#if showForm}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-overlay" onclick={resetForm}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="modal-dialog" onclick={(e: Event) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>{editingId ? t('activities.edit') : t('activities.newActivity')}</h3>
          <button class="modal-close" onclick={resetForm} aria-label={t('common.close')}>✕</button>
        </div>
        <form class="modal-body" onsubmit={handleSubmit}>
          <div class="form-row">
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label class="form-field">
              <span class="field-label">{t('activities.form.title')}</span>
              <fluent-text-input
                type="text"
                value={formData.title}
                oninput={(e: Event) => (formData.title = (e.target as HTMLInputElement).value)}
                placeholder={t('activities.form.titlePlaceholder')}
                required
              ></fluent-text-input>
            </label>
          </div>

          <div class="form-row" class:form-row-2col={!isRepeating}>
            <label class="form-field">
              <span class="field-label">{t('activities.form.startDate')}</span>
              <input
                type="date"
                bind:value={formData.startDate}
                class="date-input"
                required
              />
            </label>
            {#if !isRepeating}
              <label class="form-field">
                <span class="field-label">{t('activities.form.endDate')}</span>
                <input
                  type="date"
                  bind:value={formData.endDate}
                  class="date-input"
                  required
                />
              </label>
            {/if}
          </div>

          <div class="form-row form-row-2col">
            <label class="form-field">
              <span class="field-label">{t('activities.form.type')}</span>
              <div class="type-select-wrapper">
                <select
                  class="type-select"
                  value={formData.type}
                  onchange={handleTypeChange}
                >
                  {#each defaultActivityTypes as typeConfig}
                    <option value={typeConfig.key}>{typeConfig.label}</option>
                  {/each}
                </select>
                <div class="type-preview" style="background-color: {getTypeConfig(formData.type).color}">
                  <svg class="type-preview-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d={activityIconPaths[getTypeConfig(formData.type).icon]} fill="white"/>
                  </svg>
                </div>
              </div>
            </label>
            <label class="form-field">
              <span class="field-label">{t('activities.form.layer')}</span>
              <div class="layer-select-wrapper">
                <select
                  class="layer-select"
                  value={formData.scope}
                  onchange={handleLayerChange}
                  required
                >
                  {#each layers as layer}
                    <option value={layer.id}>{layer.name}</option>
                  {/each}
                </select>
                {#if layers.find(l => l.id === formData.scope)}
                  <div class="layer-preview" style="background-color: {layers.find(l => l.id === formData.scope)?.color}"></div>
                {/if}
              </div>
            </label>
          </div>

          <!-- Repetition options (only for new activities) -->
          {#if !editingId}
            <div class="form-row">
              <div class="repeat-section">
                <label class="toggle-switch">
                  <input type="checkbox" bind:checked={isRepeating} />
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                  <span class="toggle-label">{t('activities.form.repeatActivity')}</span>
                </label>
                
                {#if isRepeating}
                  <div class="repeat-options">
                    <div class="repeat-pattern">
                      <span class="field-label">{t('activities.form.frequency')}</span>
                      <div class="pattern-buttons">
                        <button 
                          type="button" 
                          class="pattern-btn" 
                          class:active={repeatPattern === 'weekly'}
                          onclick={() => repeatPattern = 'weekly'}
                        >{t('activities.form.weekly')}</button>
                        <button 
                          type="button" 
                          class="pattern-btn" 
                          class:active={repeatPattern === 'biweekly'}
                          onclick={() => repeatPattern = 'biweekly'}
                        >{t('activities.form.every2Weeks')}</button>
                        <button 
                          type="button" 
                          class="pattern-btn" 
                          class:active={repeatPattern === 'triweekly'}
                          onclick={() => repeatPattern = 'triweekly'}
                        >{t('activities.form.every3Weeks')}</button>
                        <button 
                          type="button" 
                          class="pattern-btn" 
                          class:active={repeatPattern === 'monthly'}
                          onclick={() => repeatPattern = 'monthly'}
                        >{t('activities.form.monthly')}</button>
                      </div>
                    </div>
                    
                    {#if repeatPattern !== 'monthly'}
                      <div class="repeat-days">
                        <span class="field-label">{t('activities.form.repeatOn')}</span>
                        <div class="day-checkboxes">
                          {#each dayNames as day, index}
                            <label class="day-checkbox" class:checked={repeatDays[index]}>
                              <input 
                                type="checkbox" 
                                bind:checked={repeatDays[index]}
                              />
                              <span>{day}</span>
                            </label>
                          {/each}
                        </div>
                      </div>
                    {/if}
                    
                    <p class="repeat-note">
                      <svg class="info-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 7a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 12 10.5Zm0-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" fill="currentColor"/>
                      </svg>
                      {t('activities.form.repeatNote')}
                    </p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <div class="form-row">
            <label class="form-field">
              <span class="field-label">{t('activities.form.description')} ({t('common.optional')})</span>
              <textarea
                bind:value={formData.description}
                class="description-input"
                placeholder={t('activities.form.descriptionPlaceholder')}
                rows="2"
              ></textarea>
            </label>
          </div>

          <div class="modal-footer">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <fluent-button type="button" appearance="secondary" onclick={resetForm}>
              {t('common.cancel')}
            </fluent-button>
            <fluent-button type="submit" appearance="primary">
              {editingId ? t('activities.form.update') : t('activities.form.addActivity')}
            </fluent-button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Delete confirmation dialog for repeated activities -->
  {#if showDeleteDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-backdrop" onclick={closeDeleteDialog}>
      <div class="modal delete-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{t('activities.deleteDialog.title')}</h2>
          <!-- svelte-ignore a11y_consider_explicit_label -->
          <button class="close-btn" onclick={closeDeleteDialog}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="m4.21 4.387.083-.094a1 1 0 0 1 1.32-.083l.094.083L12 10.585l6.293-6.292a1 1 0 1 1 1.414 1.414L13.415 12l6.292 6.293a1 1 0 0 1 .083 1.32l-.083.094a1 1 0 0 1-1.32.083l-.094-.083L12 13.415l-6.293 6.292a1 1 0 0 1-1.414-1.414L10.585 12 4.293 5.707a1 1 0 0 1-.083-1.32Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div class="delete-dialog-content">
          <p>{t('activities.deleteDialog.seriesMessage', { count: deleteGroupCount })}</p>
          <p>{t('activities.deleteDialog.whatToDelete')}</p>
        </div>
        <div class="delete-dialog-actions">
          <button class="delete-option-btn" onclick={confirmDeleteSingle}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm0 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z" fill="currentColor"/>
            </svg>
            <span>
              <strong>{t('activities.deleteDialog.thisOccurrence')}</strong>
              <small>{t('activities.deleteDialog.thisOccurrenceDesc')}</small>
            </span>
          </button>
          <button class="delete-option-btn delete-all" onclick={confirmDeleteAll}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 3A2.5 2.5 0 0 0 4 5.5v9A2.5 2.5 0 0 0 6.5 17h4.1a6.518 6.518 0 0 1-.393-1.5H6.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3.707a6.52 6.52 0 0 1 1.5.393V5.5A2.5 2.5 0 0 0 17.5 3h-11ZM23 17.5a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0Zm-7.146-2.354a.5.5 0 0 1 .638-.057l.07.057L17.5 16.086l.94-.94a.5.5 0 0 1 .765.638l-.057.07-.94.94.94.94a.5.5 0 0 1-.638.765l-.07-.057-.94-.94-.94.94a.5.5 0 0 1-.765-.638l.057-.07.94-.94-.94-.94a.5.5 0 0 1 0-.708Z" fill="currentColor"/>
            </svg>
            <span>
              <strong>{t('activities.deleteDialog.allOccurrences', { count: deleteGroupCount })}</strong>
              <small>{t('activities.deleteDialog.allOccurrencesDesc')}</small>
            </span>
          </button>
        </div>
        <div class="delete-dialog-footer">
          <button class="cancel-btn" onclick={closeDeleteDialog}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="activities-list">
    <div class="list-header">
      <h3><span class="count-badge">{filteredActivities().length}</span>{#if doneCount() > 0 && !showDone}<span class="done-count">+{doneCount()} {t('activities.done').toLowerCase()}</span>{/if}</h3>
      {#if doneCount() > 0}
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={showDone} />
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
          <span class="toggle-label">{t('activities.showDone')}</span>
        </label>
      {/if}
    </div>
    
    <div class="search-container">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2.5a7.5 7.5 0 0 1 5.964 12.048l4.743 4.745a1 1 0 0 1-1.32 1.497l-.094-.083-4.745-4.743A7.5 7.5 0 1 1 10 2.5Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"/>
      </svg>
      <input
        type="text"
        class="search-input"
        placeholder={t('activities.search')}
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button class="clear-search" onclick={() => searchQuery = ''} aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m4.21 4.387.083-.094a1 1 0 0 1 1.32-.083l.094.083L12 10.585l6.293-6.292a1 1 0 1 1 1.414 1.414L13.415 12l6.292 6.293a1 1 0 0 1-1.32 1.497l-.094-.083L12 13.415l-6.293 6.292a1 1 0 0 1-1.414-1.414L10.585 12 4.293 5.707a1 1 0 0 1-.083-1.32l.083-.094-.083.094Z" fill="currentColor"/>
          </svg>
        </button>
      {/if}
    </div>
    
    {#if sortedActivities.length === 0}
      <p class="empty-message">{searchQuery ? t('activities.noSearchResults') : t('activities.noActivities')}</p>
    {:else}
      <div class="activity-cards">
        {#each sortedActivities as activity (activity.id)}
          {@const typeConfig = getTypeConfig(activity.type)}
          {@const layer = getLayerByScope(activity.scope)}
          {@const activityIsDone = isDone(activity)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="activity-card"
            class:selected={selectedActivityId === activity.id}
            class:done={activityIsDone}
            onclick={() => handleActivityClick(activity.id)}
            onkeydown={(e) => e.key === 'Enter' && handleActivityClick(activity.id)}
            onmouseenter={() => onHover?.(activity.id)}
            onmouseleave={() => { if (selectedActivityId !== activity.id) onHover?.(null); }}
            tabindex="0"
          >
            <div class="activity-icon-bar" style="background-color: {activityIsDone ? '#999' : activity.color}">
              {#if activityIsDone}
                <svg class="activity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2Zm3.22 6.97-4.47 4.47-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5a.75.75 0 1 0-1.06-1.06Z" fill="white"/>
                </svg>
              {:else}
                <svg class="activity-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d={activityIconPaths[typeConfig.icon]} fill="white"/>
                </svg>
              {/if}
            </div>
            <div class="activity-content">
              <div class="activity-title-row">
                <h4 class="activity-title">{activity.title}</h4>
                {#if activityIsDone}
                  <span class="done-badge">{t('activities.done')}</span>
                {/if}
              </div>
              <div class="activity-badges">
                <span class="type-badge" style="background-color: {typeConfig.color}">
                  {typeConfig.label}
                </span>
                {#if layer}
                  <span class="layer-badge" style="background-color: {layer.color}20; color: {layer.color}; border-color: {layer.color}">
                    <svg class="layer-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {layer.name}
                  </span>
                {/if}
              </div>
              <div class="activity-dates">
                <svg class="date-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.75 3A3.25 3.25 0 0 1 21 6.25v11.5A3.25 3.25 0 0 1 17.75 21H6.25A3.25 3.25 0 0 1 3 17.75V6.25A3.25 3.25 0 0 1 6.25 3h11.5Zm1.75 5.5h-15v9.25c0 .966.784 1.75 1.75 1.75h11.5a1.75 1.75 0 0 0 1.75-1.75V8.5Zm-11.75 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-4.25-4a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm1.5-6H6.25A1.75 1.75 0 0 0 4.5 6.25V7h15v-.75a1.75 1.75 0 0 0-1.75-1.75Z" fill="currentColor"/>
                </svg>
                {formatDateRange(activity.startDate, activity.endDate)}
                <span class="duration-badge">
                  {getActivityDuration(activity)} {getActivityDuration(activity) === 1 ? t('activities.day') : t('activities.days')}
                </span>
              </div>
              {#if formatWeekRange(activity.startDate, activity.endDate)}
                <div class="activity-dates">
                  <svg class="date-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.75 3A3.25 3.25 0 0 1 21 6.25v11.5A3.25 3.25 0 0 1 17.75 21H6.25A3.25 3.25 0 0 1 3 17.75V6.25A3.25 3.25 0 0 1 6.25 3h11.5Zm1.75 5.5h-15v9.25c0 .966.784 1.75 1.75 1.75h11.5a1.75 1.75 0 0 0 1.75-1.75V8.5Zm-11.75 6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm-4.25-4a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm4.25 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm1.5-6H6.25A1.75 1.75 0 0 0 4.5 6.25V7h15v-.75a1.75 1.75 0 0 0-1.75-1.75Z" fill="currentColor"/>
                  </svg>
                  {formatWeekRange(activity.startDate, activity.endDate)}
                </div>
              {/if}
              {#if activity.description}
                <p class="activity-description">{activity.description}</p>
              {/if}
              <div class="activity-actions">
                <button class="action-btn edit-btn" onclick={() => handleEdit(activity)}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.03 2.97a3.578 3.578 0 0 1 0 5.06L9.062 20a2.25 2.25 0 0 1-.999.58l-5.116 1.395a.75.75 0 0 1-.92-.921l1.395-5.116a2.25 2.25 0 0 1 .58-.999L15.97 2.97a3.578 3.578 0 0 1 5.06 0ZM15 6.06 5.062 16a.75.75 0 0 0-.193.333l-1.05 3.85 3.85-1.05A.75.75 0 0 0 8 18.938L17.94 9 15 6.06Zm2.03-2.03-.97.97L19 7.94l.97-.97a2.079 2.079 0 0 0-2.94-2.94Z" fill="currentColor"/>
                  </svg>
                  {t('common.edit')}
                </button>
                <button class="action-btn delete-btn" onclick={() => handleDelete(activity.id)}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.5 6a1 1 0 0 1-.883.993L20.5 7h-.845l-1.231 12.52A2.75 2.75 0 0 1 15.687 22H8.313a2.75 2.75 0 0 1-2.737-2.48L4.345 7H3.5a1 1 0 0 1 0-2h5a3.5 3.5 0 1 1 7 0h5a1 1 0 0 1 1 1Zm-7.25 3.25a.75.75 0 0 0-.743.648L13.5 10v7a.75.75 0 0 0 1.493.102L15 17v-7a.75.75 0 0 0-.75-.75Zm-4.5 0a.75.75 0 0 0-.743.648L9 10v7a.75.75 0 0 0 1.493.102L10.5 17v-7a.75.75 0 0 0-.75-.75ZM12 3.5A1.5 1.5 0 0 0 10.5 5h3A1.5 1.5 0 0 0 12 3.5Z" fill="currentColor"/>
                  </svg>
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .planner-container {
    background: var(--surface-color);
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
  }

  .planner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .planner-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-dialog {
    background: var(--surface-color);
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: modalSlideIn 0.2s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0.25rem;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }

  .modal-close:hover {
    background: var(--background-color);
    color: var(--text-color);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    margin-top: 1rem;
  }

  .form-row {
    margin-bottom: 1rem;
  }

  .form-row-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
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

  .date-input,
  .type-select,
  .description-input {
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--background-color);
    color: var(--text-color);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .date-input:focus,
  .type-select:focus,
  .description-input:focus {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
  }

  .description-input {
    resize: vertical;
    min-height: 60px;
  }

  .type-select-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .type-select-wrapper .type-select {
    flex: 1;
  }

  .type-preview {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .type-preview-icon {
    width: 20px;
    height: 20px;
  }

  .layer-select-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .layer-select-wrapper .layer-select {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--background-color);
    font-size: 0.875rem;
  }

  .layer-preview {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .list-header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: var(--accent-color);
    color: white;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .done-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #107C10;
  }

  /* Fluent v3 Toggle Switch */
  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .toggle-switch input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-track {
    position: relative;
    width: 40px;
    height: 20px;
    background: var(--border-color, #d1d1d1);
    border-radius: 10px;
    transition: background-color 0.2s ease;
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }

  .toggle-switch input:checked + .toggle-track {
    background: var(--accent-color, #0078d4);
  }

  .toggle-switch input:checked + .toggle-track .toggle-thumb {
    transform: translateX(20px);
  }

  .toggle-switch input:focus-visible + .toggle-track {
    outline: 2px solid var(--accent-color, #0078d4);
    outline-offset: 2px;
  }

  .toggle-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .search-container {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 2.25rem 0.625rem 2.5rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--background-color);
    color: var(--text-color);
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px rgba(0, 120, 212, 0.2);
  }

  .search-input::placeholder {
    color: var(--text-secondary);
  }

  .clear-search {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .clear-search:hover {
    background: var(--surface-color);
    color: var(--text-color);
  }

  .clear-search svg {
    width: 14px;
    height: 14px;
  }

  .empty-message {
    text-align: center;
    color: var(--text-secondary);
    padding: 2rem;
    font-style: italic;
  }

  .activity-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .activity-card {
    display: flex;
    background: var(--background-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }

  .activity-card.done {
    opacity: 0.7;
  }

  .activity-card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 1;
  }

  .activity-card.selected {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px var(--accent-color);
  }

  .activity-card:focus {
    outline: none;
    border-color: var(--accent-color);
  }

  .activity-icon-bar {
    width: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .activity-icon {
    width: 24px;
    height: 24px;
  }

  .activity-content {
    flex: 1;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .activity-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .activity-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .done-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #107C10;
    background: #DFF6DD;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
  }

  .activity-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    align-items: center;
  }

  .type-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    color: white;
    padding: 0.1875rem 0.5rem;
    border-radius: 3px;
  }

  .layer-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border: 1px solid;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .layer-icon {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
  }

  .activity-dates {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .date-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .duration-badge {
    background: var(--surface-color);
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
  }

  .activity-description {
    margin: 0.5rem 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .activity-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .action-btn {
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
    border-radius: 4px;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .action-btn svg {
    width: 14px;
    height: 14px;
  }

  .action-btn:hover {
    background: var(--surface-color);
  }

  .edit-btn {
    color: var(--accent-color);
  }

  .delete-btn {
    color: var(--error-color);
  }

  @media (max-width: 600px) {
    .form-row-2col {
      grid-template-columns: 1fr;
    }
  }

  /* Repetition section styles */
  .repeat-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--surface-color);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .repeat-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border-color);
  }

  .repeat-pattern,
  .repeat-days {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pattern-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .pattern-btn {
    padding: 0.5rem 0.875rem;
    border: 1px solid var(--border-color);
    background: white;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: all 0.15s;
    color: var(--text-primary);
  }

  .pattern-btn:hover {
    border-color: var(--accent-color);
    background: #F0F5FF;
  }

  .pattern-btn.active {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
    font-weight: 500;
  }

  .day-checkboxes {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .day-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.15s;
    background: white;
    color: var(--text-secondary);
  }

  .day-checkbox input {
    display: none;
  }

  .day-checkbox:hover {
    border-color: var(--accent-color);
    background: #F0F5FF;
  }

  .day-checkbox.checked {
    background: var(--accent-color);
    border-color: var(--accent-color);
    color: white;
  }

  .repeat-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0;
    padding: 0.5rem 0.75rem;
    background: #FFF4E5;
    border-radius: 6px;
  }

  .info-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: #B86800;
  }

  /* Delete dialog styles */
  .delete-modal {
    max-width: 400px;
  }

  .delete-dialog-content {
    padding: 1rem 1.5rem;
  }

  .delete-dialog-content p {
    margin: 0 0 0.5rem 0;
    color: var(--text-secondary);
  }

  .delete-dialog-content p:last-child {
    margin-bottom: 0;
  }

  .delete-dialog-actions {
    padding: 0 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .delete-option-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: white;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .delete-option-btn:hover {
    border-color: var(--accent-color);
    background: #F0F5FF;
  }

  .delete-option-btn.delete-all:hover {
    border-color: var(--error-color);
    background: #FFF5F5;
  }

  .delete-option-btn svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: var(--text-secondary);
  }

  .delete-option-btn.delete-all svg {
    color: var(--error-color);
  }

  .delete-option-btn span {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .delete-option-btn strong {
    font-weight: 600;
    color: var(--text-primary);
  }

  .delete-option-btn small {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .delete-dialog-footer {
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--border-color);
    margin-top: 1rem;
  }

  .cancel-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background 0.15s;
  }

  .cancel-btn:hover {
    background: var(--surface-color);
  }
</style>
