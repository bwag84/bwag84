# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Hugo static site for Bart Wagener's professional portfolio, deployed to **bartwagener.com** via GitHub Pages. Uses the **CareerCanvas** theme (git submodule in `themes/careercanvas/`) with Tailwind CSS.

## Development Commands

```bash
npm install                          # Initial setup
npm run dev                          # Dev server at localhost:1313 (includes drafts)
hugo new content blog/post-name.md   # Create new blog post
npm run build:css && npm run build   # Production build (CSS must build first)
```

## Deployment

Pushes to `main` automatically deploy via GitHub Actions (`.github/workflows/hugo.yml`). The workflow runs `npm ci` then `hugo --gc --minify` and deploys to GitHub Pages. Hugo version pinned to 0.128.0 in the workflow.

## Architecture

This is a **configuration-driven** site. Most customization happens in `hugo.toml`, not code files.

### Key Principle: Never Edit Theme Files Directly

- **Colors**: Change via `[params.colors]` in `hugo.toml` (three-tier system: base hex values → semantic references → section-specific colors)
- **Layout overrides**: Place in `layouts/` to override theme defaults (Hugo's lookup order)
- **Static assets**: Place in `static/` (images, PDFs, etc.)

### Current Layout Overrides

Five partials in `layouts/partials/` override theme defaults: `hero.html`, `about.html`, `experience.html`, `contact.html`, `footer.html`.

### Content Structure

Content pages (`content/about.md`, `content/skills.md`, `content/experience.md`, `content/technical.md`) use YAML front matter with structured data that the theme templates render. Blog posts live in `content/blog/`.

### Build Pipeline

Tailwind CSS with PostCSS processes only used utility classes. The theme ships pre-built CSS, so `npm run build:css` is only needed when adding custom Tailwind classes in layouts, modifying `tailwind.config.js`, or building for production. The Tailwind content scan covers `content/`, `layouts/`, and `themes/careercanvas/layouts/` and `assets/`.

### Theme Submodule

```bash
git submodule update --init --recursive  # Required after cloning
git submodule update --remote themes/careercanvas  # Pull theme updates
```

## Color System

The three-tier color architecture in `hugo.toml`:
1. **Base colors** (`[params.colors.base]`) - Hex values (single source of truth)
2. **Semantic colors** (`[params.colors.semantic]`) - References to base color names (e.g., `primary = "blue_500"`)
3. **Section colors** - Component-specific colors (hero, skills, experience, contact, navigation, etc.)

Change the entire site's accent by updating semantic references (e.g., `primary = "purple_500"`) or by changing the base hex values themselves.

## Important Notes

- **Draft content** (`draft: true`) only appears with `-D` flag, not in production builds
- **Static file paths**: Reference as `/images/filename.png` in markdown (not `static/images/`)
- **Port conflicts**: Check for running Hugo servers before starting new ones
- **Image galleries**: Use `{{</* gallery dir="images/your-gallery" */>}}` shortcode

## Reference Documentation

- `themes/careercanvas/COLOR_CUSTOMIZATION.md` - Detailed color system docs
- `BLOG_GUIDE.md` - Blog post creation and management
- `CONTENT_REPLACEMENT_CHECKLIST.md` - Content migration tracking
