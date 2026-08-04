# Progress Notes

## Technical Stack: Obsidian-style Graph View

**Status**: Live on bartwagener.com (commit fc07667, pushed 2026-02-15)

### Final implementation
- **D3.js force-directed graph** replacing the old icon-based grid
- **Monochrome color scheme** — single blue tone family matching the hero section, no colored categories
- **Full-width layout** — graph fills entire viewport width, only heading constrained to max-w-7xl
- **Transparent background** — uses theme `bg-bg` class, matches adjacent sections in both light and dark mode
- **Ambient drift** — nodes gently float via sinusoidal forces applied through D3's force simulation, kept alive at low alphaTarget(0.012). Pauses when tab is hidden.
- **Reactive H2 heading** — hovering/clicking a category node cross-fades the "Technical Stack" heading to show that category name (e.g., "SEO Tools"). Resets on mouse leave or background click.
- **Skill labels on highlight** — hidden by default, fade in when parent category (or sibling skill) is highlighted so users can read all skills in a group
- **Click to lock** — clicking a node locks the highlight; click again or click background to unlock
- **Drag** — nodes can be dragged, simulation reactivates during drag
- **Dark mode support** — all colors via CSS custom properties, MutationObserver updates D3 elements on toggle
- **No tooltip** — removed; heading replacement is cleaner and doesn't block subnodes
- **No legend** — removed for cleaner look
- **No background shapes** — removed rotating squares to avoid distraction from graph nodes

### Node sizes (current)
- Category nodes: r=8.8, collision radius 28
- Skill nodes: r=4.3, collision radius 12

### Files
- `layouts/partials/technical.html` — layout override (D3 graph)
- `content/technical.md` — plain string skill data (10 groups, ~48 skills)

### Data source
Skills are defined in `content/technical.md` front matter as `technical_groups` with `title` and `skills` (plain strings). Hugo injects via `{{ .Params.technical_groups | jsonify | safeJS }}`.
