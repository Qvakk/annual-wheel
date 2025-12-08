<script lang="ts">
  import type { Activity } from "../types/activity";
  import { getActivityDuration, getWeekNumber } from "../types/activity";
  import type { ScopeFilters, Layer } from "../types/hierarchy";
  import { layersToScopeConfigs } from "../types/hierarchy";
  import { mockLayers } from "../data/mockData";
  import { getShortMonthNames, onLocaleChange, formatDate } from "../services/i18nService";

  // Props
  let { 
    activities = [],
    highlightedActivityId = null,
    scopeFilters = {},
    layers = mockLayers,
  }: { 
    activities: Activity[];
    highlightedActivityId?: string | null;
    scopeFilters?: ScopeFilters;
    layers?: Layer[];
  } = $props();

  // Convert layers to scope configs for rendering
  const scopeConfigs = $derived(layersToScopeConfigs(layers));

  // State
  let hoveredActivity = $state<Activity | null>(null);
  let tooltipPosition = $state({ x: 0, y: 0 });
  let rotationOffset = $state(0); // Rotation offset to bring highlighted activity into view
  let isMobileView = $state(false);
  
  // i18n: Get localized month names
  let MONTHS = $state(getShortMonthNames());
  
  // Subscribe to locale changes
  $effect(() => {
    const unsubscribe = onLocaleChange(() => {
      MONTHS = getShortMonthNames();
    });
    return unsubscribe;
  });

  // Check for mobile on mount
  $effect(() => {
    const checkMobile = () => {
      isMobileView = window.innerWidth <= 768;
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  });

  // Today's date for centering
  const today = new Date();
  
  // Constants
  const CENTER_X = 300;
  const CENTER_Y = 300;
  
  // Layout from outside to inside:
  // - Month labels (outermost)
  // - Month tick marks (big)
  // - Day tick marks (small)
  // - Week ring with week numbers
  // - Activity layers
  // - Center with year
  
  const OUTER_RADIUS = 280;
  const DAY_TICK_OUTER = OUTER_RADIUS;
  const DAY_TICK_INNER = OUTER_RADIUS - 8;
  const WEEK_RING_OUTER = DAY_TICK_INNER - 2;
  const WEEK_RING_INNER = WEEK_RING_OUTER - 20;
  const ACTIVITY_AREA_OUTER = WEEK_RING_INNER - 5;
  const INNER_RADIUS = 60;
  
  const MONTH_TICK_OUTER = OUTER_RADIUS + 12;
  const MONTH_LABEL_RADIUS = OUTER_RADIUS + 30;

  // Full year is 365 days
  const FULL_VIEW_DAYS = 365;

  // Calculate mobile viewBox centered on today
  // Today is at the top (12 o'clock position), so we zoom into the top portion
  const mobileViewBox = $derived(() => {
    // Zoom factor (1.25 = 25% zoom in - balanced view)
    const zoom = 1.25;
    const viewSize = 680 / zoom;
    // Center the view on the top of the wheel (where today is)
    // The wheel center is at 300,300 and today marker points up from center
    const x = CENTER_X - viewSize / 2;
    const y = -20; // Lower to show month labels at top
    return `${x} ${y} ${viewSize} ${viewSize}`;
  });

  // Always calculate for a full year to allow rotation
  const fullYearStartDate = $derived(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - FULL_VIEW_DAYS / 2);
    return start;
  });

  const fullYearEndDate = $derived(() => {
    const end = new Date(today);
    end.setDate(end.getDate() + FULL_VIEW_DAYS / 2);
    return end;
  });

  // Helper to get scope config by id from layers
  function getScopeConfigById(scopeId: string) {
    return scopeConfigs.find(s => s.id === scopeId) || { id: scopeId, label: scopeId, color: '#888888', ringIndex: 0 };
  }

  // Filter activities by scope visibility
  const filteredActivities = $derived(
    activities.filter((a) => scopeFilters[a.scope])
  );

  // Sort activities by scope ring (inner to outer) then by start date
  const sortedActivities = $derived(
    [...filteredActivities].sort((a, b) => {
      const scopeA = getScopeConfigById(a.scope);
      const scopeB = getScopeConfigById(b.scope);
      if (scopeA.ringIndex !== scopeB.ringIndex) {
        return scopeA.ringIndex - scopeB.ringIndex;
      }
      return a.startDate.getTime() - b.startDate.getTime();
    })
  );

  // Number of scope rings (dynamic based on layers)
  const SCOPE_RINGS = $derived(layers.length);

  // Generate scope ring background arcs with layer colors
  const scopeRingBackgrounds = $derived(() => {
    const totalRingSpace = ACTIVITY_AREA_OUTER - INNER_RADIUS - 10;
    const scopeRingThickness = totalRingSpace / (layers.length || 1);
    
    // Create a sorted copy (don't mutate the original)
    const sortedLayers = [...layers].sort((a, b) => a.ringIndex - b.ringIndex);
    
    return sortedLayers.map((layer, index) => {
      const innerR = INNER_RADIUS + 10 + index * scopeRingThickness;
      const outerR = innerR + scopeRingThickness - 1;
      // Create an annulus (ring) path - a donut shape
      // This ensures each ring only shows its own band, not covering others
      return {
        id: layer.id,
        color: layer.color,
        innerRadius: innerR,
        outerRadius: outerR,
        // Path for annulus: outer circle clockwise, then inner circle counter-clockwise
        path: `M ${CENTER_X} ${CENTER_Y - outerR} 
               A ${outerR} ${outerR} 0 1 1 ${CENTER_X} ${CENTER_Y + outerR}
               A ${outerR} ${outerR} 0 1 1 ${CENTER_X} ${CENTER_Y - outerR}
               M ${CENTER_X} ${CENTER_Y - innerR}
               A ${innerR} ${innerR} 0 1 0 ${CENTER_X} ${CENTER_Y + innerR}
               A ${innerR} ${innerR} 0 1 0 ${CENTER_X} ${CENTER_Y - innerR}
               Z`,
      };
    });
  });

  // Helper to convert hex to rgba for backgrounds
  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Calculate layer assignment based on scope and overlap within each scope ring
  const activityLayers = $derived(() => {
    const layerMap: Map<string, { scopeRing: number; subLayer: number }> = new Map();
    const maxSubLayers = 3; // Max overlapping activities per scope ring
    
    // Group by scope and handle overlaps within each scope
    scopeConfigs.forEach((scopeConfig) => {
      const scopeActivities = sortedActivities.filter((a) => a.scope === scopeConfig.id);
      const assigned: { activity: Activity; subLayer: number }[] = [];
      
      scopeActivities.forEach((activity) => {
        // Find the first available sub-layer where this activity doesn't overlap
        let subLayer = 0;
        for (let l = 0; l < maxSubLayers; l++) {
          const overlaps = assigned.some(
            (a) =>
              a.subLayer === l &&
              activity.startDate <= a.activity.endDate &&
              activity.endDate >= a.activity.startDate
          );
          if (!overlaps) {
            subLayer = l;
            break;
          }
          subLayer = l + 1;
        }
        subLayer = Math.min(subLayer, maxSubLayers - 1);
        assigned.push({ activity, subLayer });
        layerMap.set(activity.id, { scopeRing: scopeConfig.ringIndex, subLayer });
      });
    });
    
    return layerMap;
  });

  // Convert date to angle on the wheel
  // Today is always at the top (0 degrees in our coordinate system)
  // Past dates go counter-clockwise (negative angles), future dates go clockwise (positive angles)
  function dateToAngle(date: Date): number {
    // Calculate days difference from today (not from start date)
    const daysDiff = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    
    // Convert days to degrees - always use full year scale
    // Full circle = 365 days = 360 degrees
    const degreesPerDay = 360 / FULL_VIEW_DAYS;
    
    // Today is at 0 degrees (top), past is negative, future is positive
    return daysDiff * degreesPerDay;
  }

  // Convert angle to coordinates
  function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: CENTER_X + radius * Math.cos(radians),
      y: CENTER_Y + radius * Math.sin(radians),
    };
  }

  // Create arc path for activity
  function createArcPath(
    startAngleDeg: number,
    endAngleDeg: number,
    innerR: number,
    outerR: number
  ): string {
    const start1 = polarToCartesian(startAngleDeg, outerR);
    const end1 = polarToCartesian(endAngleDeg, outerR);
    const start2 = polarToCartesian(endAngleDeg, innerR);
    const end2 = polarToCartesian(startAngleDeg, innerR);
    
    const largeArc = endAngleDeg - startAngleDeg > 180 ? 1 : 0;
    
    return [
      `M ${start1.x} ${start1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${end1.x} ${end1.y}`,
      `L ${start2.x} ${start2.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${end2.x} ${end2.y}`,
      "Z",
    ].join(" ");
  }

  // Generate day tick marks - iterate through full year range
  const dayMarkers = $derived(() => {
    const markers: { angle: number; tickStart: { x: number; y: number }; tickEnd: { x: number; y: number }; isMonthStart: boolean; isToday: boolean }[] = [];
    const start = fullYearStartDate();
    const end = fullYearEndDate();
    
    // Iterate day by day through the full year range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const angle = dateToAngle(currentDate);
      
      const isMonthStart = currentDate.getDate() === 1;
      const isToday = currentDate.toDateString() === today.toDateString();
      const tickOuter = isMonthStart ? MONTH_TICK_OUTER : DAY_TICK_OUTER;
      const tickInner = isMonthStart ? DAY_TICK_INNER - 4 : DAY_TICK_INNER;
      
      const tickStart = polarToCartesian(angle, tickOuter);
      const tickEnd = polarToCartesian(angle, tickInner);
      
      // Show tick every 5 days, or if it's the 1st of month, or if it's today
      if (isMonthStart || isToday || currentDate.getDate() % 5 === 0) {
        markers.push({
          angle,
          tickStart,
          tickEnd,
          isMonthStart,
          isToday,
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return markers;
  });

  // Generate month labels - show for all months in the year
  const monthMarkers = $derived(() => {
    const markers: { angle: number; label: string; x: number; y: number; year: number; rotation: number }[] = [];
    const start = fullYearStartDate();
    const end = fullYearEndDate();
    
    // Iterate through months in the full year range
    const currentDate = new Date(start.getFullYear(), start.getMonth(), 15);
    
    while (currentDate <= end) {
      const angle = dateToAngle(currentDate);
      
      const labelPos = polarToCartesian(angle, MONTH_LABEL_RADIUS);
      const monthYear = currentDate.getFullYear();
      const showYear = monthYear !== today.getFullYear();
      
      // Calculate rotation for readability
      // Normalize angle to 0-360 range for rotation calculation
      let normalizedAngle = ((angle % 360) + 360) % 360;
      let rotation = angle;
      // If angle is between 90 and 270 (bottom half), flip the text
      if (normalizedAngle > 90 && normalizedAngle < 270) {
        rotation = angle + 180;
      }
      
      markers.push({
        angle,
        label: showYear ? `${MONTHS[currentDate.getMonth()]} '${String(monthYear).slice(-2)}` : MONTHS[currentDate.getMonth()],
        x: labelPos.x,
        y: labelPos.y,
        year: monthYear,
        rotation,
      });
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return markers;
  });

  // Generate week markers - iterate through full year
  const weekMarkers = $derived(() => {
    const markers: { weekNum: number; startAngle: number; endAngle: number; path: string; midAngle: number; year: number; isOdd: boolean }[] = [];
    const start = fullYearStartDate();
    const end = fullYearEndDate();
    
    // Start from the beginning of the week containing start date
    let currentDate = new Date(start);
    const dayOfWeek = currentDate.getDay();
    // Adjust to Monday
    if (dayOfWeek !== 1) {
      currentDate.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }
    
    while (currentDate <= end) {
      const weekNum = getWeekNumber(currentDate);
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const wStartAngle = dateToAngle(weekStart);
      const wEndAngle = dateToAngle(weekEnd);
      
      markers.push({
        weekNum,
        startAngle: wStartAngle,
        endAngle: wEndAngle,
        path: createArcPath(wStartAngle, wEndAngle, WEEK_RING_INNER, WEEK_RING_OUTER),
        midAngle: (wStartAngle + wEndAngle) / 2,
        year: weekStart.getFullYear(),
        isOdd: weekNum % 2 === 1,
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return markers;
  });

  // Generate activity arcs - organized by scope rings
  const activityArcs = $derived(() => {
    const layers = activityLayers();
    const start = fullYearStartDate();
    const end = fullYearEndDate();
    
    // Calculate ring dimensions
    // Each scope ring has space for up to 3 overlapping sub-layers
    const totalRingSpace = ACTIVITY_AREA_OUTER - INNER_RADIUS - 10;
    const scopeRingThickness = totalRingSpace / SCOPE_RINGS;
    const subLayerThickness = scopeRingThickness / 3; // 3 max sub-layers per scope
    
    // Minimum arc size in degrees (for single-day events to be visible)
    const minArcDegrees = 3;
    
    return sortedActivities.map((activity) => {
      // Check if activity overlaps with full year date range
      if (activity.endDate < start || activity.startDate > end) {
        return null;
      }
      
      const layerInfo = layers.get(activity.id) || { scopeRing: 0, subLayer: 0 };
      
      // Calculate radii based on scope ring (innermost = holidays) and sub-layer
      const scopeRingStart = INNER_RADIUS + 10 + layerInfo.scopeRing * scopeRingThickness;
      const innerR = scopeRingStart + layerInfo.subLayer * subLayerThickness;
      const outerR = innerR + subLayerThickness - 2; // Small gap between sub-layers
      
      let actStartAngle = dateToAngle(activity.startDate);
      let actEndAngle = dateToAngle(activity.endDate);
      
      // Ensure minimum arc size for visibility
      if (actEndAngle - actStartAngle < minArcDegrees) {
        const midAngle = (actStartAngle + actEndAngle) / 2;
        actStartAngle = midAngle - minArcDegrees / 2;
        actEndAngle = midAngle + minArcDegrees / 2;
      }
      
      return {
        activity,
        path: createArcPath(actStartAngle, actEndAngle, innerR, outerR),
        scopeRing: layerInfo.scopeRing,
        subLayer: layerInfo.subLayer,
        startAngle: actStartAngle,
        endAngle: actEndAngle,
      };
    }).filter(Boolean);
  });

  // Target rotation (will be smoothly animated to)
  let targetRotation = $state(0);

  // Calculate rotation offset when highlighted activity is hovered/selected
  // This rotates the wheel to bring the highlighted activity to a visible position
  $effect(() => {
    if (!highlightedActivityId) {
      // Reset rotation when no highlight
      targetRotation = 0;
      return;
    }

    const highlightedActivity = activities.find(a => a.id === highlightedActivityId);
    if (!highlightedActivity) {
      targetRotation = 0;
      return;
    }

    // Calculate the midpoint angle of the activity
    const actStartAngle = dateToAngle(highlightedActivity.startDate);
    const actEndAngle = dateToAngle(highlightedActivity.endDate);
    const midAngle = (actStartAngle + actEndAngle) / 2;

    // On mobile: only rotate if activity is outside visible area (roughly -70 to +70 degrees from top)
    // On desktop: rotate if activity is far from top (>90 degrees)
    const visibleRange = isMobileView ? 70 : 90;
    
    if (Math.abs(midAngle) > visibleRange) {
      // Rotate to bring midpoint closer to top
      // On mobile, bring it fully into view; on desktop, use gentler rotation
      const rotationFactor = isMobileView ? 1.0 : 0.85;
      targetRotation = -midAngle * rotationFactor;
    } else {
      targetRotation = 0;
    }
  });

  // Smooth transition to target rotation
  $effect(() => {
    rotationOffset = targetRotation;
  });

  // Today marker - a line at the top of the wheel
  const todayMarker = $derived(() => {
    const angle = dateToAngle(today);
    const tickStart = polarToCartesian(angle, INNER_RADIUS);
    const tickEnd = polarToCartesian(angle, OUTER_RADIUS + 5);
    return { angle, tickStart, tickEnd };
  });

  function handleMouseMove(event: MouseEvent, activity: Activity) {
    hoveredActivity = activity;
    tooltipPosition = { x: event.clientX, y: event.clientY };
  }

  function handleMouseLeave() {
    hoveredActivity = null;
  }

  function formatTooltipDate(date: Date): string {
    return formatDate(date, { day: "numeric", month: "short" });
  }
</script>

<div class="wheel-container" class:mobile-zoomed={isMobileView}>
  <svg
    viewBox={isMobileView ? mobileViewBox() : "-40 -40 680 680"}
    class="wheel-svg"
    class:rotating={rotationOffset !== 0}
  >
    <!-- Rotatable content group -->
    <g 
      class="wheel-content" 
      transform="rotate({rotationOffset}, {CENTER_X}, {CENTER_Y})"
    >
      <!-- Background circle -->
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={OUTER_RADIUS}
        fill="var(--surface-color)"
        stroke="var(--border-color)"
        stroke-width="1"
      />
      
      <!-- Week ring background -->
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={WEEK_RING_OUTER}
        fill="var(--week-ring-bg, #f0f0f0)"
        stroke="var(--border-color)"
        stroke-width="1"
      />
      
      <!-- Activity area background -->
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={WEEK_RING_INNER}
        fill="var(--surface-color)"
        stroke="var(--border-color)"
        stroke-width="1"
      />
      
      <!-- Scope ring backgrounds with layer colors (as annulus shapes) -->
      {#each scopeRingBackgrounds() as ring}
        <path
          d={ring.path}
          fill={hexToRgba(ring.color, 0.15)}
          fill-rule="evenodd"
        />
      {/each}
      
      <!-- Inner circle (center) -->
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={INNER_RADIUS}
        fill="var(--background-color)"
        stroke="var(--border-color)"
        stroke-width="1"
      />
      
      <!-- Year label in center (counter-rotate to stay upright) -->
      <text
        x={CENTER_X}
        y={CENTER_Y - 8}
        text-anchor="middle"
        dominant-baseline="middle"
        class="year-label"
        transform="rotate({-rotationOffset}, {CENTER_X}, {CENTER_Y})"
      >
        {today.getFullYear()}
      </text>
      <text
        x={CENTER_X}
        y={CENTER_Y + 14}
        text-anchor="middle"
        dominant-baseline="middle"
        class="today-label"
        transform="rotate({-rotationOffset}, {CENTER_X}, {CENTER_Y})"
      >
        {formatDate(today, { weekday: "short", day: "numeric", month: "short" })}
      </text>
    
    <!-- Week markers (ring outside activity area) -->
    {#each weekMarkers() as week}
      <path
        d={week.path}
        fill={week.isOdd ? "var(--week-bg-odd, #d8d8d8)" : "var(--week-bg, #e8e8e8)"}
        stroke="var(--border-color)"
        stroke-width="0.5"
        class="week-arc"
        class:week-odd={week.isOdd}
      />
      <!-- Show week number every week (counter-rotate to stay readable) -->
      {@const labelPos = polarToCartesian(week.midAngle, (WEEK_RING_INNER + WEEK_RING_OUTER) / 2)}
      <text
        x={labelPos.x}
        y={labelPos.y}
        text-anchor="middle"
        dominant-baseline="middle"
        class="week-label"
        transform="rotate({-rotationOffset}, {labelPos.x}, {labelPos.y})"
      >
        {week.weekNum}
      </text>
    {/each}
    
    <!-- Day tick marks (on outer edge) -->
    {#each dayMarkers() as marker}
      <line
        x1={marker.tickStart.x}
        y1={marker.tickStart.y}
        x2={marker.tickEnd.x}
        y2={marker.tickEnd.y}
        stroke={marker.isToday ? "var(--accent-color)" : marker.isMonthStart ? "var(--text-color)" : "var(--border-color)"}
        stroke-width={marker.isToday ? 3 : marker.isMonthStart ? 2 : 1}
        class="day-tick"
        class:month-start={marker.isMonthStart}
        class:today={marker.isToday}
      />
    {/each}
    
    <!-- Today marker line -->
    {#each [todayMarker()] as todayMark}
      <line
        x1={todayMark.tickStart.x}
        y1={todayMark.tickStart.y}
        x2={todayMark.tickEnd.x}
        y2={todayMark.tickEnd.y}
        stroke="var(--accent-color)"
        stroke-width="2"
        stroke-dasharray="4,2"
        class="today-marker"
      />
    {/each}
    
    <!-- Month labels (outermost, counter-rotate to stay readable) -->
    {#each monthMarkers() as marker}
      {@const counterRotation = -rotationOffset}
      <text
        x={marker.x}
        y={marker.y}
        text-anchor="middle"
        dominant-baseline="middle"
        class="month-label"
        transform="rotate({marker.rotation + counterRotation}, {marker.x}, {marker.y})"
      >
        {marker.label}
      </text>
    {/each}

    <!-- Activity arcs (rendered last so highlights appear on top) -->
    {#each activityArcs() as arc}
      {#if arc}
        {@const isHighlighted = highlightedActivityId === arc.activity.id}
        {@const isSmallArc = (arc.endAngle - arc.startAngle) < 10}
        {@const highlightColor = arc.activity.highlightColor || '#000000'}
        <path
          d={arc.path}
          fill={arc.activity.color}
          stroke={isHighlighted ? highlightColor : "var(--background-color)"}
          stroke-width={isHighlighted ? (isSmallArc ? 4 : 2) : 1}
          class="activity-arc"
          class:hovered={hoveredActivity?.id === arc.activity.id}
          class:highlighted={isHighlighted}
          onmousemove={(e) => handleMouseMove(e, arc.activity)}
          onmouseleave={handleMouseLeave}
          role="button"
          tabindex="0"
          aria-label={arc.activity.title}
        />
        {#if isHighlighted}
          <!-- Highlight outline rendered on top - larger for small arcs -->
          <path
            d={arc.path}
            fill="none"
            stroke={highlightColor}
            stroke-width={isSmallArc ? 5 : 3}
            class="activity-arc-highlight"
            pointer-events="none"
          />
        {/if}
      {/if}
    {/each}
    </g>
  </svg>
  
  <!-- Tooltip -->
  {#if hoveredActivity}
    <div
      class="tooltip"
      style="left: {tooltipPosition.x + 10}px; top: {tooltipPosition.y + 10}px;"
    >
      <div class="tooltip-title" style="border-left-color: {hoveredActivity.color}">
        {hoveredActivity.title}
      </div>
      <div class="tooltip-dates">
        {formatTooltipDate(hoveredActivity.startDate)} - {formatTooltipDate(hoveredActivity.endDate)}
      </div>
      {#if hoveredActivity.description}
        <div class="tooltip-description">{hoveredActivity.description}</div>
      {/if}
      <div class="tooltip-duration">
        {getActivityDuration(hoveredActivity)} days
      </div>
    </div>
  {/if}
</div>

<style>
  .wheel-container {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    overflow: hidden;
    --week-ring-bg: #f5f5f5;
    --week-bg: #e8e8e8;
  }

  :global([data-theme="dark"]) .wheel-container {
    --week-ring-bg: #333;
    --week-bg: #3d3d3d;
  }

  .wheel-svg {
    width: 100%;
    height: auto;
    display: block;
  }

  .wheel-content {
    transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  /* Counter-rotated text elements need matching smooth transition */
  .year-label,
  .today-label,
  .week-label,
  .month-label {
    transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
    will-change: transform;
  }

  .activity-arc-highlight {
    pointer-events: none;
  }

  .year-label {
    font-size: 1.5rem;
    font-weight: 700;
    fill: var(--text-color);
  }

  .today-label {
    font-size: 0.65rem;
    font-weight: 500;
    fill: var(--accent-color);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .month-label {
    font-size: 0.7rem;
    font-weight: 600;
    fill: var(--text-color);
  }

  .week-label {
    font-size: 0.45rem;
    fill: var(--text-secondary);
    font-weight: 500;
  }

  .week-arc {
    opacity: 0.7;
  }

  .day-tick {
    opacity: 0.6;
  }

  .day-tick.month-start {
    opacity: 1;
  }

  .day-tick.today {
    opacity: 1;
  }

  .today-marker {
    opacity: 0.8;
  }

  .activity-arc {
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s;
    opacity: 0.85;
  }

  .activity-arc:hover,
  .activity-arc.hovered {
    opacity: 1;
    filter: brightness(1.1);
  }

  .activity-arc.highlighted {
    opacity: 1;
    filter: brightness(1.15) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
  }

  .tooltip {
    position: fixed;
    background: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    max-width: 250px;
    pointer-events: none;
  }

  .tooltip-title {
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
    padding-left: 0.5rem;
    border-left: 3px solid;
  }

  .tooltip-dates {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .tooltip-description {
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .tooltip-duration {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--accent-color);
  }

  /* Mobile styles - larger text */
  @media (max-width: 768px) {
    .wheel-container.mobile-zoomed {
      /* Allow some overflow for panning */
      overflow: visible;
    }

    .wheel-content {
      /* Enable rotation animation on mobile too */
      transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .year-label {
      font-size: 2rem;
    }

    .today-label {
      font-size: 0.85rem;
    }

    .month-label {
      font-size: 0.95rem;
    }

    .week-label {
      font-size: 0.65rem;
    }
  }

  /* Small mobile */
  @media (max-width: 480px) {
    .year-label {
      font-size: 2.2rem;
    }

    .today-label {
      font-size: 0.9rem;
    }

    .month-label {
      font-size: 1rem;
    }

    .week-label {
      font-size: 0.7rem;
    }
  }
</style>
