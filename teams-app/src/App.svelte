<script lang="ts">
  import { onMount } from "svelte";
  import * as microsoftTeams from "@microsoft/teams-js";
  import type { Activity } from "./types/activity";
  import type { ActivityTypeConfig } from "./types/admin";
  import { defaultActivityTypes } from "./types/admin";
  import type { UserContext, ScopeFilters, Layer, UserSettings } from "./types/hierarchy";
  import { createDefaultScopeFilters, applyUserLayerOrder } from "./types/hierarchy";
  import { getActivityTypeColor, getActivityTypeHighlightColor, mockLayers, getActivitiesForUserAsync } from "./data/mockData";
  import AnnualWheel from "./components/AnnualWheel.svelte";
  import ActivityPlanner from "./components/ActivityPlanner.svelte";
  import AdminSettings from "./components/AdminSettings.svelte";
  import ScopeFilterPanel from "./components/ScopeFilterPanel.svelte";
  import EmbedWheel from "./components/EmbedWheel.svelte";
  import { getUserRoles, getUserContext, createMockUserContext } from "./services/authService";
  import ShareDialog from "./components/ShareDialog.svelte";
  import { getUserSettings, saveLayerOrder } from "./services/userSettingsService";
  import { initI18n, t, getLocale, loadLocale, supportedLocales, type SupportedLocale } from "./services/i18nService";

  // Check if we're in embed mode (URL contains /embed or ?mode=embed)
  const isEmbedMode = $derived(
    window.location.pathname.includes('/embed') || 
    new URLSearchParams(window.location.search).get('mode') === 'embed'
  );

  // Svelte 5 runes for reactive state
  let teamsContext = $state<microsoftTeams.app.Context | null>(null);
  let isInTeams = $state(false);
  let initError = $state<string | null>(null);
  let theme = $state<"default" | "dark" | "contrast">("default");
  let isLoading = $state(true);

  // Admin state
  let showAdmin = $state(false);
  let showShareDialog = $state(false);
  let showUserMenu = $state(false);
  let showLanguageSubmenu = $state(false);
  let isAdmin = $state(false);
  
  // i18n state - getLocale() checks localStorage if not yet initialized
  let currentLocale = $state<SupportedLocale>(getLocale());

  // Language change handler
  async function handleLanguageChange(locale: SupportedLocale) {
    if (locale === currentLocale) return;
    try {
      await loadLocale(locale);
      currentLocale = locale;
      showLanguageSubmenu = false;
      showUserMenu = false;
      // Reload page to apply translations
      window.location.reload();
    } catch (e) {
      console.error('Failed to change language:', e);
    }
  }
  
  // User context (from Teams SSO + Graph API)
  let userContext = $state<UserContext | null>(null);
  
  // Layers configuration (admin-managed)
  let layers = $state<Layer[]>([...mockLayers]);
  
  // User settings (persisted) - assigned but read access reserved for future features
  // @ts-expect-error Variable is assigned but read access planned for future UI features
  let userSettings: UserSettings | null = null;
  
  // Scope filters for showing/hiding layers
  let scopeFilters = $state<ScopeFilters>(createDefaultScopeFilters(mockLayers));
  
  // Activity types configuration (will come from API/storage later)
  let activityTypes = $state<ActivityTypeConfig[]>([...defaultActivityTypes]);

  // Activities state - will be loaded based on user context
  let activities = $state<Activity[]>([]);

  // Highlighted activity for hover sync between list and wheel
  let highlightedActivityId = $state<string | null>(null);

  // Derived state
  const themeClass = $derived(`theme-${theme}`);
  
  // Calculate the visible date range (same as AnnualWheel)
  const today = new Date();
  const FULL_VIEW_DAYS = 365;
  const wheelStartDate = new Date(today);
  wheelStartDate.setDate(wheelStartDate.getDate() - FULL_VIEW_DAYS / 2);
  const wheelEndDate = new Date(today);
  wheelEndDate.setDate(wheelEndDate.getDate() + FULL_VIEW_DAYS / 2);
  
  // Filter activities by visible scopes AND date range (to match wheel)
  const visibleActivities = $derived(
    activities.filter(a => 
      scopeFilters[a.scope] && 
      a.endDate >= wheelStartDate && 
      a.startDate <= wheelEndDate
    )
  );

  // Initialize Teams SDK
  onMount(async () => {
    let teamsLocale: string | undefined;

    try {
      await microsoftTeams.app.initialize();
      isInTeams = true;

      // Get Teams context
      teamsContext = await microsoftTeams.app.getContext();
      
      // Get locale from Teams SDK
      teamsLocale = teamsContext.app.locale;

      // Set initial theme
      if (teamsContext.app.theme) {
        theme = teamsContext.app.theme as "default" | "dark" | "contrast";
      }

      // Listen for theme changes
      microsoftTeams.app.registerOnThemeChangeHandler((newTheme) => {
        theme = newTheme as "default" | "dark" | "contrast";
        applyTheme(newTheme);
      });

      applyTheme(theme);

      // Check if user has admin role
      try {
        const roles = await getUserRoles();
        isAdmin = roles.isAdmin;
      } catch (e) {
        console.log("Could not get user roles:", e);
      }
      
      // Get user context from Graph API
      try {
        userContext = await getUserContext();
        if (userContext) {
          // Load user settings (layer order, visibility)
          const settings = await loadUserSettingsFromApi();
          if (settings) {
            userSettings = settings;
            applyUserSettings(settings);
          }
          // Load activities based on user's hierarchy context (includes API holidays)
          activities = await getActivitiesForUserAsync(userContext, activityTypes, layers);
        }
      } catch (e) {
        console.log("Could not get user context:", e);
        // Fall back to mock user context
        userContext = createMockUserContext();
        // Load user settings
        const settings = await loadUserSettingsFromApi();
        if (settings) {
          userSettings = settings;
          applyUserSettings(settings);
        }
        activities = await getActivitiesForUserAsync(userContext, activityTypes, layers);
      }

      // Notify Teams that app is ready
      microsoftTeams.app.notifySuccess();
    } catch (error) {
      // Not running in Teams - that's ok for development
      console.log("Running outside Teams context");
      // In development mode, allow admin access for testing
      isAdmin = true;
      // Use mock user context for development
      userContext = createMockUserContext();
      // Load user settings
      const settings = await loadUserSettingsFromApi();
      if (settings) {
        userSettings = settings;
        applyUserSettings(settings);
      }
      activities = await getActivitiesForUserAsync(userContext, activityTypes, layers);
      initError = null;
    } finally {
      // Initialize i18n with Teams locale (if available)
      try {
        await initI18n(teamsLocale);
        currentLocale = getLocale();
      } catch (e) {
        console.error('Failed to initialize i18n:', e);
      }
      isLoading = false;
    }
  });

  /**
   * Apply theme to document for CSS custom properties
   */
  function applyTheme(themeName: string) {
    document.documentElement.setAttribute("data-theme", themeName);
  }

  /**
   * Load user settings from API/storage
   */
  async function loadUserSettingsFromApi(): Promise<UserSettings | null> {
    if (!userContext) return null;
    try {
      return await getUserSettings(userContext.userId, userContext.organizationId);
    } catch (e) {
      console.error('Failed to load user settings:', e);
      return null;
    }
  }

  /**
   * Handle layer reorder from user
   */
  function handleLayersReorder(newLayers: Layer[]) {
    layers = newLayers;
    
    // Save the new order to user settings
    const layerOrder = newLayers
      .sort((a, b) => a.ringIndex - b.ringIndex)
      .map(l => l.id);
    
    // Update local state
    const settings: UserSettings = {
      userId: userContext?.userId || 'anonymous',
      organizationId: userContext?.organizationId || 'default',
      layerOrder,
      layerVisibility: { ...scopeFilters },
      updatedAt: new Date(),
    };
    userSettings = settings;
    
    // Save to API (async, fire-and-forget for responsiveness)
    saveLayerOrder(
      userContext?.userId || 'anonymous',
      userContext?.organizationId || 'default',
      layerOrder
    ).catch(e => console.error('Failed to save layer order:', e));
  }

  /**
   * Apply loaded user settings to layers
   */
  function applyUserSettings(settings: UserSettings) {
    if (settings.layerOrder) {
      layers = applyUserLayerOrder(mockLayers, settings.layerOrder);
    }
    if (settings.layerVisibility) {
      scopeFilters = { ...scopeFilters, ...settings.layerVisibility };
    }
  }

  /**
   * Add or update an activity
   */
  function handleAddActivity(activity: Activity) {
    const existingIndex = activities.findIndex((a) => a.id === activity.id);
    if (existingIndex >= 0) {
      activities[existingIndex] = activity;
    } else {
      activities = [...activities, activity];
    }
  }

  /**
   * Delete an activity
   */
  function handleDeleteActivity(id: string) {
    activities = activities.filter((a) => a.id !== id);
  }

  /**
   * Delete all activities in a repeat group
   */
  function handleDeleteActivityGroup(repeatGroupId: string) {
    activities = activities.filter((a) => a.repeatGroupId !== repeatGroupId);
  }

  /**
   * Handle activity types update from admin settings
   * Updates type configs and refreshes activity colors
   */
  function handleActivityTypesUpdate(newTypes: ActivityTypeConfig[]) {
    activityTypes = newTypes;
    // Update colors of existing activities based on new type configs
    activities = activities.map((activity) => ({
      ...activity,
      color: getActivityTypeColor(activity.type, newTypes),
      highlightColor: getActivityTypeHighlightColor(activity.type, newTypes),
    }));
  }

  /**
   * Handle layers update from admin settings
   * Updates layers and refreshes scope filters + holidays from new layers
   */
  async function handleLayersUpdate(newLayers: Layer[]) {
    layers = newLayers;
    // Update scope filters to include any new layers
    scopeFilters = createDefaultScopeFilters(newLayers);
    
    // Reload activities to fetch holidays for any new holiday layers
    if (userContext) {
      try {
        activities = await getActivitiesForUserAsync(userContext, activityTypes, newLayers);
      } catch (e) {
        console.error('Failed to reload activities after layer update:', e);
      }
    }
  }

  /**
   * Move activities from one layer to another
   */
  function handleMoveActivitiesToLayer(fromLayerId: string, toLayerId: string) {
    activities = activities.map(activity => 
      activity.scope === fromLayerId 
        ? { ...activity, scope: toLayerId, scopeId: toLayerId }
        : activity
    );
  }

  /**
   * Delete all activities belonging to a specific layer
   */
  function handleDeleteLayerActivities(layerId: string) {
    activities = activities.filter(activity => activity.scope !== layerId);
  }
</script>

<!-- Embed mode: Show only the wheel viewer -->
{#if isEmbedMode}
  <EmbedWheel />
{:else}
<!-- Full app mode -->
<div class="app-container {themeClass}">
  {#if isLoading}
    <div class="loading-container">
      <fluent-spinner></fluent-spinner>
      <p>{t('common.loading')}</p>
    </div>
  {:else if initError}
    <div class="error-container">
      <p class="error-message">{initError}</p>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <fluent-button appearance="primary" onclick={() => location.reload()}>
        {t('common.retry')}
      </fluent-button>
    </div>
  {:else}
    <header class="app-header">
      <h1>{t('app.title')}</h1>
      {#if isInTeams && teamsContext}
        <span class="teams-badge">Teams • {theme}</span>
      {/if}
      
      <!-- User info and settings -->
      <div class="header-right">
        {#if userContext}
          <div class="user-menu-container">
            <button 
              class="user-avatar-btn" 
              onclick={() => showUserMenu = !showUserMenu}
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              {#if userContext.photoUrl}
                <img class="user-avatar-img" src={userContext.photoUrl} alt={userContext.displayName} />
              {:else}
                <div class="user-avatar">
                  {userContext.displayName.charAt(0).toUpperCase()}
                </div>
              {/if}
            </button>
            
            {#if showUserMenu}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div class="user-menu-backdrop" onclick={() => showUserMenu = false}></div>
              <div class="user-menu-dropdown">
                <div class="user-menu-header">
                  {#if userContext.photoUrl}
                    <img class="menu-avatar-img" src={userContext.photoUrl} alt={userContext.displayName} />
                  {:else}
                    <div class="menu-avatar">
                      {userContext.displayName.charAt(0).toUpperCase()}
                    </div>
                  {/if}
                  <div class="menu-user-info">
                    <span class="menu-user-name">{userContext.displayName}</span>
                    <span class="menu-user-org">{userContext.organizationName}</span>
                  </div>
                </div>
                <div class="user-menu-divider"></div>
                <a href="https://github.com/frid-iks-no/arshjul" target="_blank" rel="noopener noreferrer" class="user-menu-item">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" fill="currentColor"/>
                  </svg>
                  <span>{t('common.documentation')}</span>
                </a>
                <div class="user-menu-divider"></div>
                <div class="language-section">
                  <button class="user-menu-item language-header" onclick={() => showLanguageSubmenu = !showLanguageSubmenu}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="currentColor"/>
                    </svg>
                    <span>{t('language.title')}</span>
                    <svg class="chevron" class:expanded={showLanguageSubmenu} viewBox="0 0 24 24" fill="none">
                      <path d="M8.293 12.707a1 1 0 0 1 0-1.414l5.657-5.657a1 1 0 1 1 1.414 1.414L10.414 12l4.95 4.95a1 1 0 0 1-1.414 1.414l-5.657-5.657Z" fill="currentColor"/>
                    </svg>
                  </button>
                  {#if showLanguageSubmenu}
                    <div class="language-submenu">
                      {#each supportedLocales as locale}
                        <button 
                          class="language-option" 
                          class:selected={locale.code === currentLocale}
                          onclick={() => handleLanguageChange(locale.code)}
                        >
                          <span class="lang-name">{locale.nativeName}</span>
                          {#if locale.code === currentLocale}
                            <svg class="check-icon" viewBox="0 0 24 24" fill="none">
                              <path d="m8.5 16.586-3.793-3.793a1 1 0 0 0-1.414 1.414l4.5 4.5a1 1 0 0 0 1.414 0l10-10a1 1 0 0 0-1.414-1.414L8.5 16.586Z" fill="currentColor"/>
                            </svg>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="user-menu-divider"></div>
                <button class="user-menu-item" onclick={() => { showUserMenu = false; alert('Annual Wheel v1.0.0\n\nMIT License\n© 2025 Frid IKS'); }}>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z" fill="currentColor"/>
                  </svg>
                  <span>License & Version</span>
                </button>
              </div>
            {/if}
          </div>
          
          <!-- Desktop: show user name -->
          <div class="user-details-desktop">
            <span class="user-name-compact">{userContext.displayName}</span>
            <span class="user-org-compact">{userContext.organizationName}</span>
          </div>
        {/if}
        <button class="share-btn" onclick={() => (showShareDialog = true)} aria-label={t('share.title')} title={t('share.createLink')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.42l-.47.48a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z" fill="currentColor"/>
          </svg>
          <span>{t('share.title')}</span>
        </button>
        <button class="admin-btn" onclick={() => (showAdmin = true)} aria-label={t('admin.title')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.012 2.25c.734.008 1.465.093 2.182.253a.75.75 0 0 1 .582.649l.17 1.527a1.384 1.384 0 0 0 1.927 1.116l1.401-.615a.75.75 0 0 1 .85.174 9.792 9.792 0 0 1 2.204 3.792.75.75 0 0 1-.271.825l-1.242.916a1.381 1.381 0 0 0 0 2.226l1.243.915a.75.75 0 0 1 .272.826 9.797 9.797 0 0 1-2.204 3.792.75.75 0 0 1-.848.175l-1.407-.617a1.38 1.38 0 0 0-1.926 1.114l-.169 1.526a.75.75 0 0 1-.572.647 9.518 9.518 0 0 1-4.406 0 .75.75 0 0 1-.572-.647l-.168-1.524a1.382 1.382 0 0 0-1.926-1.11l-1.406.616a.75.75 0 0 1-.849-.175 9.798 9.798 0 0 1-2.204-3.796.75.75 0 0 1 .272-.826l1.243-.916a1.38 1.38 0 0 0 0-2.226l-1.243-.914a.75.75 0 0 1-.271-.826 9.793 9.793 0 0 1 2.204-3.792.75.75 0 0 1 .85-.174l1.4.615a1.387 1.387 0 0 0 1.93-1.118l.17-1.526a.75.75 0 0 1 .583-.65c.717-.159 1.45-.243 2.201-.252Zm0 1.5a9.135 9.135 0 0 0-1.354.117l-.109.977A2.886 2.886 0 0 1 6.525 7.17l-.898-.394a8.293 8.293 0 0 0-1.348 2.317l.798.587a2.881 2.881 0 0 1 0 4.643l-.799.588c.32.842.776 1.626 1.348 2.322l.905-.397a2.882 2.882 0 0 1 4.017 2.318l.11.984c.889.15 1.798.15 2.687 0l.11-.984a2.881 2.881 0 0 1 4.018-2.322l.905.396a8.296 8.296 0 0 0 1.347-2.318l-.798-.588a2.881 2.881 0 0 1 0-4.643l.796-.587a8.293 8.293 0 0 0-1.348-2.317l-.896.393a2.884 2.884 0 0 1-4.023-2.324l-.11-.976a8.988 8.988 0 0 0-1.333-.117ZM12 8.25a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5Zm0 1.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </header>

    {#if showAdmin}
      <AdminSettings 
        {isAdmin} 
        {activityTypes}
        {layers}
        onClose={() => (showAdmin = false)} 
        onTypesUpdate={handleActivityTypesUpdate}
        onLayersUpdate={handleLayersUpdate}
        onMoveActivities={handleMoveActivitiesToLayer}
        onDeleteLayerActivities={handleDeleteLayerActivities}
      />
    {/if}

    {#if showShareDialog && userContext}
      <ShareDialog
        {layers}
        organizationId={userContext.organizationId}
        userId={userContext.userId}
        onClose={() => (showShareDialog = false)}
      />
    {/if}

    <main class="app-main">
      <div class="main-content">
        <!-- Annual Wheel Section -->
        <section class="wheel-section">
          <AnnualWheel {activities} {highlightedActivityId} {scopeFilters} {layers} />
        </section>

        <!-- Sidebar with filters and planner -->
        <section class="planner-section">
          <!-- Scope filter panel -->
          <ScopeFilterPanel 
            bind:filters={scopeFilters} 
            bind:layers={layers}
            onLayersReorder={handleLayersReorder}
          />
          
          <!-- Activity Planner -->
          <ActivityPlanner
            activities={visibleActivities}
            {activityTypes}
            {layers}
            onAdd={handleAddActivity}
            onDelete={handleDeleteActivity}
            onDeleteGroup={handleDeleteActivityGroup}
            onHover={(id) => highlightedActivityId = id}
          />
        </section>
      </div>
    </main>
  {/if}
</div>
{/if}

<style>
  :global(:root) {
    /* Light theme (default) */
    --background-color: #ffffff;
    --text-color: #242424;
    --text-secondary: #616161;
    --surface-color: #fafafa;
    --border-color: #e0e0e0;
    --accent-color: #0078d4;
    --error-color: #d13438;
    --success-color: #107c10;
  }

  :global([data-theme="dark"]) {
    --background-color: #1f1f1f;
    --text-color: #ffffff;
    --text-secondary: #a0a0a0;
    --surface-color: #292929;
    --border-color: #3d3d3d;
    --accent-color: #4da6ff;
    --error-color: #ff6b6b;
    --success-color: #6ccb5f;
  }

  :global([data-theme="contrast"]) {
    --background-color: #000000;
    --text-color: #ffffff;
    --text-secondary: #ffff00;
    --surface-color: #000000;
    --border-color: #ffffff;
    --accent-color: #ffff00;
    --error-color: #ff0000;
    --success-color: #00ff00;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif;
    background-color: var(--background-color);
    color: var(--text-color);
    line-height: 1.5;
    overflow: hidden;
  }

  :global(html, body) {
    height: 100%;
  }

  .app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-container,
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 1rem;
  }

  .error-message {
    color: var(--error-color);
    font-weight: 500;
  }

  .app-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--surface-color);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .teams-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
    background-color: var(--accent-color);
    color: white;
    border-radius: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .user-menu-container {
    position: relative;
  }

  .user-avatar-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 50%;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .user-avatar-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--accent-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .user-avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .user-menu-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 240px;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow: hidden;
  }

  .user-menu-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  .menu-avatar,
  .menu-avatar-img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .menu-avatar {
    background: var(--accent-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .menu-avatar-img {
    object-fit: cover;
  }

  .menu-user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .menu-user-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-user-org {
    font-size: 0.8rem;
    color: var(--accent-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-menu-divider {
    height: 1px;
    background: var(--border-color);
    margin: 0;
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.875rem;
    color: var(--text-color);
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s;
  }

  .user-menu-item:hover {
    background: var(--hover-color, rgba(0, 0, 0, 0.05));
  }

  .user-menu-item svg {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  /* Language section in user menu */
  .language-section {
    padding: 0;
  }

  .language-header {
    justify-content: flex-start;
  }

  .language-header .chevron {
    width: 16px;
    height: 16px;
    margin-left: 4px;
    transform: rotate(-90deg);
    transition: transform 0.2s;
    opacity: 0.5;
  }

  .language-header .chevron.expanded {
    transform: rotate(90deg);
  }

  .language-submenu {
    background: var(--hover-color, rgba(0, 0, 0, 0.03));
    border-top: 1px solid var(--border-color);
  }

  .language-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 16px 10px 40px;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.85rem;
    color: var(--text-color);
    cursor: pointer;
    transition: background 0.15s;
  }

  .language-option:hover {
    background: var(--hover-color, rgba(0, 0, 0, 0.05));
  }

  .language-option.selected {
    background: rgba(0, 120, 212, 0.08);
    font-weight: 500;
  }

  .language-option .lang-name {
    flex: 1;
  }

  .language-option .check-icon {
    width: 16px;
    height: 16px;
    color: var(--accent-color);
  }

  .user-details-desktop {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .user-name-compact {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.2;
  }

  .user-org-compact {
    font-size: 0.7rem;
    color: var(--accent-color);
    line-height: 1.2;
  }

  .admin-btn {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-btn svg {
    width: 20px;
    height: 20px;
  }

  .admin-btn:hover {
    background: var(--background-color);
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .share-btn {
    background: var(--accent-color);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    color: white;
    transition: background 0.15s, transform 0.1s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .share-btn svg {
    width: 18px;
    height: 18px;
  }

  .share-btn:hover {
    background: color-mix(in srgb, var(--accent-color) 85%, black);
    transform: translateY(-1px);
  }

  .share-btn:active {
    transform: translateY(0);
  }

  .app-main {
    flex: 1;
    padding: 1.5rem;
    overflow: hidden;
    min-height: 0;
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    height: 100%;
  }

  .wheel-section {
    background: var(--surface-color);
    border-radius: 12px;
    padding: 1rem;
    border: 1px solid var(--border-color);
    overflow: hidden;
  }

  .planner-section {
    overflow-y: auto;
    min-height: 0;
  }

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
    }

    .planner-section {
      max-height: none;
    }
  }

  /* Mobile styles */
  @media (max-width: 768px) {
    .app-header {
      padding: 0.75rem 1rem;
    }

    .app-header h1 {
      font-size: 1.25rem;
    }

    .user-details-desktop {
      display: none;
    }

    .share-btn span {
      display: none;
    }

    .share-btn {
      padding: 0.5rem;
    }

    .header-right {
      gap: 8px;
    }

    .user-menu-dropdown {
      right: -40px;
    }
  }

  .welcome-card {
    max-width: 600px;
    width: 100%;
    padding: 2rem;
    text-align: center;
  }

  .welcome-card p {
    margin: 0 0 1rem;
    color: var(--text-secondary);
  }

  .teams-info,
  .dev-info {
    font-size: 0.75rem;
    padding: 0.5rem 1rem;
    background-color: var(--surface-color);
    border-radius: 4px;
    display: inline-block;
  }

  .actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .user-context-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 16px;
  }

  .user-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--text-color);
  }

  .user-org {
    font-size: 0.85rem;
    color: var(--accent-color);
  }

  .user-groups {
    font-size: 0.8rem;
    color: var(--text-secondary);
  }
</style>
