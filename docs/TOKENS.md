# `filename_prefix` token reference

Verified 2026-07 against a live ComfyUI install, not from memory. Two
independent substitution passes run over a `filename_prefix`, in different
places, at different times — which is the single fact that explains most
confusing behaviour.

## Where each token is substituted

| Pass | Runs in | When | Tokens |
|---|---|---|---|
| **Frontend** | `applyTextReplacements` | At prompt submit, before the graph reaches the server | `%date:<fmt>%`, `%<Node>.<widget>%` |
| **Backend** | `folder_paths.get_save_image_path` | At save time, once the image exists | `%width%` `%height%` `%year%` `%month%` `%day%` `%hour%` `%minute%` `%second%` |

**The frontend pass is opt-in per save node.** `applyTextReplacements` runs
only because a save node wraps its widget's `serializeValue` to call it — core
`SaveImage` does, and VHS does it in `VHS.core.js`. A save node that does *not*
opt in leaves a literal `%Node.widget%` in the filename. Grepping
`folder_paths.py` alone suggests the whole feature is unimplemented; it isn't,
it just lives in the frontend.

Consequences worth knowing:

- **`%width%`/`%height%` cannot be previewed.** The image does not exist when
  you are editing the prefix. This pack shows `?width?` rather than inventing
  a number.
- **A node-reference token is resolved against the graph you submit.** Rename
  the node afterwards and the token silently stops resolving — the literal
  `%old-title.seed%` is written into the filename. The builder flags this.
- **Only the backend list works if the frontend pass is bypassed** (an API
  client posting a raw prompt does no frontend substitution).

## Date format (`%date:<fmt>%`)

Frontend-side. The format grammar is the regex
`dd?|MM?|hh?|mm?|ss?|yyy?y?`, applied left to right.

| Token | Meaning | Example (2026-07-05 14:30:52) |
|---|---|---|
| `yyyy` | 4-digit year | `2026` |
| `yy` | 2-digit year | `26` |
| `MM` / `M` | Month, padded / unpadded | `07` / `7` |
| `dd` / `d` | Day, padded / unpadded | `05` / `5` |
| `hh` / `h` | Hour, **24-hour**, padded / unpadded | `14` |
| `mm` / `m` | Minute | `30` |
| `ss` / `s` | Second | `52` |

Every token is zero-padded to **its own length**, so `d` gives `5` and `dd`
gives `05`.

Two quirks, mirrored deliberately by this pack:

- **There is no 12-hour token.** `hh` is always 24-hour.
- **`yyy` and a bare `y` pass through literally.** The regex matches them but
  the replacer handles only `yy` and `yyyy`, so they render as the letters
  themselves. Diverging from this would make the preview disagree with the
  actual filename.

Any character that is not a format token is copied verbatim, so `-`, `_`, `/`
and `.` are all safe separators.

## Node reference (`%<Node>.<widget>%`)

Frontend-side. Node matching has a **precedence order** that is easy to get
wrong:

1. Nodes whose `Node name for S&R` property equals the name — this defaults to
   the node's class, and **survives a retitle**.
2. Only if that matches nothing, nodes whose **title** equals the name.

So a `KSampler` you renamed to `my sampler` is reachable as *both*
`%KSampler.seed%` and `%my sampler.seed%`.

```
%Empty Latent Image.width%     → the class name, no rename needed
%wan-sampler-high.sampler%     → a node retitled to a short handle
```

Practical notes:

- **Retitle the nodes you reference.** `%wan-sampler-high.sampler%` is far
  more readable than the class name, and survives adding a second sampler.
- **Duplicate names are ambiguous.** Multiple matches resolve to the first;
  the frontend warns in the console. The builder badges these `duplicate title`.
- **The name is split on `.` and must yield exactly two parts.** A node title
  containing a dot (`Wan 2.2 sampler`) is therefore **unreferenceable** — the
  token stays literal and the console warns `Invalid replacement pattern`.
  Keep referenced titles dot-free.

### Substituted values are sanitized

The resolved value has `/ ? < > \ : * | "` and control characters each replaced
with `_` before it is spliced in. Two consequences:

- **A substituted value can never create a subfolder.** Wan's fused scheduler
  value `dpm++_sde/beta` lands as `dpm++_sde_beta`. Only a literal `/` typed
  into the template makes a directory.
- **`.` is *not* sanitized**, so `%LoadImage.image%` yields `photo.jpg` and
  puts a file extension in the middle of the name:
  `…_photo.jpg_final_00001_.png`. The builder warns when a token resolves to a
  value ending in a known extension.

## Subfolders

A `/` in the prefix creates a subfolder under `output/`:

```
renders/%date:yyyy-MM-dd%/%date:hhmmss%_%seed.seed%
└─ folder ─┘└── dated folder ──┘└─── filename ───┘
```

ComfyUI refuses to save outside the output directory, so a leading `/` or a
`..` segment is an error — the builder flags both.

## Filename suffix

The backend appends `_00001_` (a per-prefix counter) and the extension. You
never write these yourself; the builder's preview shows them greyed into the
example so the final shape is clear.

## Worked example

```
renders/%date:yyyy-MM-dd%/%date:hhmmss%_%wan-sampler-high.sampler%_%wan-sampler-high.scheduler%_s%seed.seed%_%steps.value%steps
```

produces

```
renders/2026-07-05/143052_euler_simple_s123456_20steps_00001_.png
```

This is the pattern the pack's golden test is pinned to.
