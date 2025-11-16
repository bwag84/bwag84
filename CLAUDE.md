# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Hugo static site for Bart Wagener's professional portfolio, using the **CareerCanvas** theme - a modern, responsive theme with Tailwind CSS. The site is multilingual-capable (English/Dutch) and features sections for about, skills, experience, technical stack, blog, and contact.

## Development Commands

### Initial setup
```bash
npm install  # Install PostCSS, Tailwind, and build dependencies
```

### Running the development server
```bash
npm run dev
# or
hugo server -D
```
Server runs at `http://localhost:1313`. The `-D` flag includes draft content.

### Building for production
```bash
npm run build:css && npm run build
```
Output is in `public/` directory. CSS must be built first because Tailwind generates final CSS from used classes.

## Site Architecture

This is a configuration-driven Hugo site where most customization happens in `hugo.toml`, not code files.

### Content Structure
- `content/about.md` - About section with profile and introduction
- `content/skills.md` - Skills section with category-based skill cards
- `content/experience.md` - Work experience timeline
- `content/technical.md` - Technical stack/tools section
- `content/blog/` - Blog posts (markdown files with front matter)
  - `_index.md` - Blog section configuration
  - Individual posts as `.md` files

### Configuration System
The theme uses a three-tier color system in `hugo.toml`:
1. **Base colors** (`[params.colors.base]`) - Hex values (single source of truth)
2. **Semantic colors** (`[params.colors.semantic]`) - References to base colors
3. **Section colors** - Component-specific colors (hero, skills, experience, contact, navigation, etc.)

This eliminates 90% of color repetition. Change colors by either:
- Modifying semantic references (e.g., `primary = "purple_500"`)
- Updating base hex values (e.g., `blue_500 = "#8b5cf6"`)

### Theme as Submodule
The CareerCanvas theme is installed as a git submodule in `themes/careercanvas/`. To update:
```bash
git submodule update --remote themes/careercanvas
```

### Layout Override System
Custom layouts go in `layouts/` to override theme defaults:
- `layouts/partials/` - Custom partial templates
- Theme layouts remain in `themes/careercanvas/layouts/`

## Content Management

### Creating blog posts
```bash
hugo new content blog/your-post-name.md
```
Or manually create in `content/blog/` with front matter:
```yaml
---
title: "Your Title"
date: 2025-01-15
draft: false
description: "SEO description"
tags: ["SEO", "Technical SEO"]
---
```

### Image galleries
Place images in `static/images/your-gallery/` and use shortcode:
```markdown
{{< gallery dir="images/your-gallery" >}}
```

### Adding static files
- Images: `static/images/`
- PDFs/resumes: `static/files/`
- Reference in markdown as `/images/filename.png` (not `static/images/`)

## Key Configuration Patterns

### Personal information
Set in `[params]` section of `hugo.toml`:
- `name`, `tagline`, `hero_location`, `hero_description`
- `email`, `profile_image`, `location`
- Social URLs: `linkedin_url`, `github_url`
- Resume paths: `resume_url_en`, `resume_label`

### Navigation menu
Defined as `[[menu.main]]` arrays with `name`, `url`, and `weight` for ordering.

### Social icons
Defined as `[[params.social]]` arrays with `icon` (Font Awesome name) and `url`.

### Pexels background images
Configure queries in `[params.pexels]` for section backgrounds:
```toml
[params.pexels]
  queries = ["seo", "digital marketing", "analytics"]
```

## Build System

The site uses Tailwind CSS with PostCSS:
- Source CSS: `assets/css/main.css` (if customizing)
- Built CSS: `static/css/main.css` (generated)
- Config: `tailwind.config.js`, `postcss.config.js`

The theme ships with pre-built CSS, so `npm run build:css` is only needed if:
1. Adding custom Tailwind classes in layouts
2. Modifying Tailwind configuration
3. Building for production deployment

## Multilingual Support

The theme supports English/French by default. Current site uses `en-nl` language code. Translation strings are in `i18n/en.toml`. To add translations:
1. Create `i18n/nl.toml` for Dutch
2. Add language-specific content with filename suffixes (e.g., `about.nl.md`)
3. Configure `[languages]` in `hugo.toml`

## Important Notes

- **Never edit theme files directly** - Use `hugo.toml` for colors, `layouts/` for template overrides, and `static/` for assets
- **Color customization** is entirely config-based via `[params.colors]` sections - no CSS editing needed
- **Draft content** (`draft: true`) only appears with `hugo server -D`, not in production builds
- **Git submodule** must be initialized after cloning: `git submodule update --init --recursive`
- **Background processes** - Check for running Hugo servers before starting new ones to avoid port conflicts

## Reference Documentation

- Theme docs: `themes/careercanvas/README.md`
- Color customization: `themes/careercanvas/COLOR_CUSTOMIZATION.md`
- Blog guide: `BLOG_GUIDE.md`
- Content checklist: `CONTENT_REPLACEMENT_CHECKLIST.md`
