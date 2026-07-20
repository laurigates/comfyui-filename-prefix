# comfyui-filename-prefix

Build filename_prefix from live workflow variables, or pick from saved presets.

> Part of a family of mobile-first ComfyUI usability packs
> ([gallery-loader](https://github.com/laurigates/comfyui-gallery-loader),
> [sampler-info](https://github.com/laurigates/comfyui-sampler-info)):
> touch-friendly HTML modals that replace clunky native LiteGraph
> controls, detected by widget name, additive and non-clobbering.

## Install

```sh
cd <ComfyUI>/custom_nodes
git clone https://github.com/laurigates/comfyui-filename-prefix
cd comfyui-filename-prefix
bun install
bun run build      # emit web/dist/ (served by ComfyUI)
```

Restart ComfyUI; hard-refresh the browser tab (Ctrl+Shift+R / Cmd+Shift+R).

## What it does

Tapping a `filename_prefix` widget normally gives you a bare text box. ComfyUI
supports a genuinely useful token syntax in that box — dated subfolders, values
pulled straight out of your workflow's nodes — but nothing surfaces it, so most
prefixes stay at whatever the workflow shipped with:

```
WanVideoWrapper_I2V        →  WanVideoWrapper_I2V_00042_.png
```

…and every run lands in one flat pile, indistinguishable from the last.

This pack replaces the text box with a builder:

**Build** — a palette of every variable the **open workflow** actually offers,
read live from the graph. Tap `wan-sampler-high › sampler` to insert
`%wan-sampler-high.sampler%`; the preview under the field shows the filename
you'll actually get, resolved against current widget values:

```
nsfw/%date:yyyy-MM-dd%/%date:hhmmss%_%wan-sampler-high.sampler%_s%seed.seed%
    ↓
nsfw/2026-07-05/143052_euler_s123456_00001_.png
```

**Presets** — save a prefix you like and pick it in one tap on the next
workflow. Presets are stored in ComfyUI's per-user settings, which live
**server-side**, so the ones you save at the desktop are there on your phone.

It also catches the failure mode that makes these prefixes risky: rename a node
and its token silently stops resolving, writing a literal `%steps.value%` into
every filename from then on. Any token the open graph can't resolve is flagged
before you apply it.

Widgets are matched by name and the enhancement is additive — the native
control remains the fallback, and serialized workflows are untouched.

See [`docs/TOKENS.md`](docs/TOKENS.md) for the full token reference, including
which tokens are substituted by the frontend and which by the backend (the
distinction explains most surprising behaviour).

<!-- Hero screenshot: add the containerized screenshot pipeline with the
     `comfyui-screenshot-pipeline` skill (`just screenshots`), then embed the
     committed docs/*.png here with an italic caption, like the sibling packs. -->

## Compatibility

- ComfyUI: modern Vue frontend (`comfyui-frontend-package >= 1.40`) for the
  `widget.onPointerDown` interception hook.
- Frontend changes take effect after `bun run build` + a browser hard-refresh —
  no ComfyUI restart.

## License

MIT — see `LICENSE`.
