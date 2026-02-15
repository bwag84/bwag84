# Progress Notes

## Technical Stack: Obsidian-style Graph View

**Status**: V2 — redesigned per visual feedback

### What changed in V2
- **Background**: Removed `#0d1117` hardcoded background; section now uses theme `bg-bg` class (dark blue in dark mode, white in light mode) — transparent, matching other page sections
- **Full width**: Graph container is now outside the `max-w-7xl` wrapper, fills the entire viewport width
- **Monochrome nodes**: Removed colored category palette (`CAT_COLORS`); all nodes use a single blue tone matching the hero's rotating square color (`--color-primary` family)
  - Category nodes: r=7, subtle filled dots with thin stroke
  - Skill nodes: r=3, small dots
- **Background effects**: Added 5 CSS-animated rotating outlined squares (`.tech-shape`) matching the hero section's geometric background
- **Legend removed**: No more color legend below the graph
- **Tooltips on all nodes**: Hover any node to see description
  - Skill nodes: show name + parent category
  - Category nodes: show name + skill count
- **Light/dark mode**: All colors defined via CSS custom properties on `#technical` and `.dark #technical`; MutationObserver updates D3 elements when dark mode toggles

### Files changed
- `layouts/partials/technical.html` — Complete rewrite

### What to verify
- [ ] Visual review at `localhost:1313/#technical` in dark mode
- [ ] Visual review in light mode
- [ ] Toggle dark/light — graph colors update immediately
- [ ] Hover skill nodes → tooltip shows "Name / Category"
- [ ] Hover category nodes → tooltip shows "Name / N skills"
- [ ] Click to lock, click again to unlock, click background to reset
- [ ] Drag nodes → simulation reactivates
- [ ] Rotating background squares visible and subtle
- [ ] Mobile (~375px) — no overflow, still usable
- [ ] Production build: `hugo --gc --minify` succeeds ✅
