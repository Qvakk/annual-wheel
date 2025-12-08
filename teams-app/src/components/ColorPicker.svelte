<script lang="ts">
  // Props
  let {
    value = "#0078D4",
    onchange,
  }: {
    value: string;
    onchange?: (color: string) => void;
  } = $props();

  // Local state for RGB values
  let hexInput = $state("");
  let showPicker = $state(false);

  // Keep hexInput in sync with value prop
  $effect(() => {
    hexInput = value;
  });

  // Predefined color palette
  const presetColors = [
    "#0078D4", "#D13438", "#107C10", "#8764B8",
    "#FF8C00", "#008272", "#E3008C", "#7A7574",
    "#4F6BED", "#C239B3", "#00B294", "#FFB900",
    "#038387", "#8E8CD8", "#E74856", "#0099BC",
  ];

  // Parse hex to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 120, b: 212 };
  }

  // Convert RGB to hex
  function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((x) => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    }).join("");
  }

  // Get RGB values from current hex
  let rgb = $derived(hexToRgb(value));

  // Update color
  function updateColor(newHex: string) {
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      hexInput = newHex;
      onchange?.(newHex);
    }
  }

  function handleRgbChange(component: "r" | "g" | "b", val: number) {
    const newRgb = { ...rgb, [component]: val };
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    updateColor(newHex);
  }

  function handleHexInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let val = input.value;
    
    // Auto-add # if missing
    if (val && !val.startsWith("#")) {
      val = "#" + val;
    }
    
    hexInput = val;
    
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onchange?.(val);
    }
  }

  function selectPreset(color: string) {
    hexInput = color;
    onchange?.(color);
  }
</script>

<div class="color-picker-container">
  <button
    type="button"
    class="color-preview"
    style="background-color: {value}"
    onclick={() => (showPicker = !showPicker)}
    aria-label="Select color"
  >
    <span class="color-hex">{value.toUpperCase()}</span>
  </button>

  {#if showPicker}
    <div class="picker-dropdown">
      <div class="picker-section">
        <span class="picker-label">Preset Colors</span>
        <div class="preset-grid">
          {#each presetColors as color}
            <button
              type="button"
              class="preset-swatch"
              class:selected={value.toUpperCase() === color.toUpperCase()}
              style="background-color: {color}"
              onclick={() => selectPreset(color)}
              aria-label="Select {color}"
            ></button>
          {/each}
        </div>
      </div>

      <div class="picker-section">
        <span class="picker-label">Custom Color</span>
        
        <div class="hex-input-row">
          <span class="input-label">HEX</span>
          <input
            type="text"
            class="hex-input"
            value={hexInput}
            oninput={handleHexInput}
            maxlength="7"
            placeholder="#000000"
          />
        </div>

        <div class="rgb-inputs">
          <div class="rgb-input-group">
            <span class="input-label">R</span>
            <input
              type="number"
              class="rgb-input"
              value={rgb.r}
              oninput={(e) => handleRgbChange("r", parseInt((e.target as HTMLInputElement).value) || 0)}
              min="0"
              max="255"
            />
          </div>
          <div class="rgb-input-group">
            <span class="input-label">G</span>
            <input
              type="number"
              class="rgb-input"
              value={rgb.g}
              oninput={(e) => handleRgbChange("g", parseInt((e.target as HTMLInputElement).value) || 0)}
              min="0"
              max="255"
            />
          </div>
          <div class="rgb-input-group">
            <span class="input-label">B</span>
            <input
              type="number"
              class="rgb-input"
              value={rgb.b}
              oninput={(e) => handleRgbChange("b", parseInt((e.target as HTMLInputElement).value) || 0)}
              min="0"
              max="255"
            />
          </div>
        </div>

        <!-- Native color picker as fallback -->
        <div class="native-picker-row">
          <span class="input-label">Picker</span>
          <input
            type="color"
            class="native-picker"
            value={value}
            oninput={(e) => updateColor((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      <button
        type="button"
        class="close-picker"
        onclick={() => (showPicker = false)}
      >
        Done
      </button>
    </div>
  {/if}
</div>

<style>
  .color-picker-container {
    position: relative;
    display: inline-block;
  }

  .color-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    min-width: 140px;
    transition: border-color 0.15s;
  }

  .color-preview:hover {
    border-color: var(--accent-color);
  }

  .color-hex {
    font-family: monospace;
    font-size: 0.875rem;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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
    padding: 1rem;
    min-width: 280px;
    margin-top: 0.25rem;
  }

  .picker-section {
    margin-bottom: 1rem;
  }

  .picker-section:last-of-type {
    margin-bottom: 0.5rem;
  }

  .picker-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.25rem;
  }

  .preset-swatch {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
  }

  .preset-swatch:hover {
    transform: scale(1.15);
  }

  .preset-swatch.selected {
    border-color: var(--text-color);
    box-shadow: 0 0 0 2px var(--surface-color), 0 0 0 4px var(--text-color);
  }

  .hex-input-row,
  .native-picker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .rgb-inputs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .rgb-input-group {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .input-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    min-width: 28px;
  }

  .hex-input {
    flex: 1;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.875rem;
    background: var(--background-color);
    color: var(--text-color);
  }

  .rgb-input {
    width: 50px;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.875rem;
    background: var(--background-color);
    color: var(--text-color);
  }

  .hex-input:focus,
  .rgb-input:focus {
    outline: 2px solid var(--accent-color);
    outline-offset: 1px;
  }

  .native-picker {
    width: 40px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
  }

  .close-picker {
    width: 100%;
    padding: 0.5rem;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.15s;
  }

  .close-picker:hover {
    background: var(--accent-color);
    filter: brightness(1.1);
  }
</style>
