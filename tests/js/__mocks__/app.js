// Minimal stub of ComfyUI's scripts/app.js for the Vitest harness.
// Extension-module tests import `app` without a real frontend.

/** Settings written by the extension, inspectable from tests. */
const settings = new Map();

export const app = {
  registeredExtensions: [],
  registerExtension(ext) {
    this.registeredExtensions.push(ext);
  },
  graph: {
    _nodes: [],
    setDirtyCanvas() {},
  },
  extensionManager: {
    setting: {
      get: (id) => settings.get(id),
      set: (id, value) => {
        settings.set(id, value);
      },
    },
  },
  /** Test helper: reset the graph and settings between cases. */
  __reset(nodes = []) {
    this.graph._nodes = nodes;
    settings.clear();
  },
};
