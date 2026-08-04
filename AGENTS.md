# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

Six partials in `layouts/partials/` override theme defaults: `hero.html`, `about.html`, `experience.html`, `technical.html`, `contact.html`, `footer.html`.

### Technical Stack Graph (Most Complex Override)

`layouts/partials/technical.html` is a self-contained D3.js v7 force-directed graph (loaded from CDN). Data comes from `content/technical.md` front matter (`technical_groups` with `title` and `skills` arrays), injected via `{{ .Params.technical_groups | jsonify | safeJS }}`. The graph uses CSS custom properties for theming and a `MutationObserver` to react to dark mode toggles. See `PROGRESS.md` for detailed implementation notes and design decisions.

### Content Structure

Content pages (`content/about.md`, `content/skills.md`, `content/experience.md`, `content/technical.md`) use YAML front matter with structured data that the theme templates render. Blog posts live in `content/blog/`.

### Build Pipeline

Tailwind CSS with PostCSS processes only used utility classes. The theme ships pre-built CSS, so `npm run build:css` is only needed when adding custom Tailwind classes in layouts or modifying `tailwind.config.js`. The Tailwind content scan covers `content/`, `layouts/`, and `themes/careercanvas/layouts/` and `assets/`. Note: the CI workflow does **not** run `build:css` — it only runs `hugo --gc --minify`. If you add new Tailwind classes, run `npm run build:css` locally and commit the output (`static/css/main.css`).

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
- `PROGRESS.md` - Implementation notes and design decisions for recent features


<claude-mem-context>
# Memory Context

# [canvas] recent context, 2026-08-04 2:06pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 9 obs (2,674t read) | 26,339t work | 90% savings

### May 10, 2026
96 3:52p 🔵 GSD version check detected available update
97 3:53p 🔵 Changelog fetch failed during GSD update process
98 " 🔵 CHANGELOG.md does not contain expected version headers
99 " 🔵 Version mismatch between npm package and CHANGELOG
100 " ✅ GSD v1.41.0 changelog extracted for update review
103 3:54p 🟣 GSD updated from v1.40.0 to v1.41.1
104 " ✅ GSD update cache cleared and finalized
S37 Verify Hugo site from bwag84/bwag84 repository is running and deployed (May 10 at 3:55 PM)
S36 Execute gsd-update to check for and install available GSD updates from v1.40.0 to latest (May 10 at 3:55 PM)
S38 Check if Hugo site from bwag84/bwag84 repository runs; evaluate deployment options beyond GitHub Pages (May 10 at 3:56 PM)
S39 Migration plan for Hugo site deployment from GitHub Pages to Hostinger VPS; awaiting VPS credentials to proceed with implementation (May 10 at 4:00 PM)
S40 Attempt VPS pre-flight diagnostics for Hugo migration; SSH connection timeout requires Hostinger configuration verification (May 10 at 4:03 PM)
105 4:04p 🔵 VPS SSH connectivity test returns no output
S41 Continuing VPS SSH connectivity troubleshooting; requesting Hostinger firewall configuration verification and verbose SSH diagnostics (May 10 at 4:05 PM)
106 4:06p ✅ Migration documentation created: GitHub Pages → Hostinger VPS
S42 Create comprehensive migration documentation for GitHub Pages → Hostinger VPS deployment (May 10 at 4:06 PM)
**Investigated**: Hugo site repository structure; Hugo version pinning (0.128.0) in GitHub workflows; Node.js/Tailwind/PostCSS build pipeline; Nginx static site serving requirements; Let's Encrypt SSL setup; DNS migration at TransIP.nl; deploy script automation

**Learned**: Certbot SSL certificate issuance requires DNS to already point to VPS before running (Let's Encrypt ACME challenge will fail otherwise); Hugo extended version necessary for CSS preprocessing; site built into /var/www/bartwagener.com/public/; deploy script enables push-to-live workflow without manual SSH commands

**Completed**: MIGRATION.md documentation created with complete 8-step deployment guide; includes Hugo v0.128.0 installation, Node.js v20 setup, repository cloning, Nginx configuration, SSL setup, deploy script template, DNS migration procedure with TTL optimization, cleanup steps, and troubleshooting section

**Next Steps**: Resolve SSH connectivity issue to VPS (72.62.58.207) by checking Hostinger firewall/port configuration; once SSH access confirmed, execute Step 1 (Hugo installation) through Step 6 (deploy script setup); prepare for DNS migration once site is live on HTTP; run certbot after DNS cutover to avoid ACME challenge failures


Access 26k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>