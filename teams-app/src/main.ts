import App from "./App.svelte";
import { mount } from "svelte";

// Import Fluent UI Web Components v3 - auto-registers with customElements
import "@fluentui/web-components/button.js";
import "@fluentui/web-components/spinner.js";
import "@fluentui/web-components/dialog.js";
import "@fluentui/web-components/dialog-body.js";
import "@fluentui/web-components/divider.js";
import "@fluentui/web-components/menu.js";
import "@fluentui/web-components/menu-item.js";
import "@fluentui/web-components/menu-button.js";
import "@fluentui/web-components/menu-list.js";
import "@fluentui/web-components/badge.js";
import "@fluentui/web-components/tooltip.js";
import "@fluentui/web-components/text-input.js";

// Set Fluent theme
import { setTheme } from "@fluentui/web-components";
import { webLightTheme } from "@fluentui/tokens";

setTheme(webLightTheme);

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
