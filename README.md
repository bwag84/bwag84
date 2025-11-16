# Bart Wagener - Professional Portfolio

A Hugo static site for Bart Wagener's professional portfolio, using the **CareerCanvas** theme. This site is automatically deployed to GitHub Pages.

🌐 **Live Site:** https://bwag84.github.io/bwag84/

## 🚀 Quick Start

### Prerequisites
- [Hugo Extended](https://gohugo.io/installation/) (v0.128.0 or later)
- [Node.js](https://nodejs.org/) and npm
- Git

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/bwag84/bwag84.git
   cd bwag84
   ```

2. **Initialize the theme submodule**
   ```bash
   git submodule update --init --recursive
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   hugo server -D
   ```

   Visit http://localhost:1313 to view the site.

## ⚙️ Initial GitHub Pages Setup

**Important:** This is a one-time setup required after pushing to GitHub for the first time.

If you see a 404 error when visiting your site, you need to enable GitHub Actions as the deployment source:

1. **Go to repository settings:**
   - Visit: https://github.com/bwag84/bwag84/settings/pages

2. **Change the deployment source:**
   - Under "Build and deployment" section
   - Find the **"Source"** dropdown (may be set to "Deploy from a branch")
   - Click the dropdown and select **"GitHub Actions"**
   - It saves automatically

3. **Trigger the first deployment:**
   - Go to the "Actions" tab: https://github.com/bwag84/bwag84/actions
   - Click on "Deploy Hugo site to Pages" workflow on the left sidebar
   - Click the "Run workflow" button (top right, green button)
   - Click the green "Run workflow" button in the dropdown

4. **Wait for deployment:**
   - Watch the workflow run (takes 1-2 minutes)
   - Once it completes with a green checkmark ✓, your site is live

5. **Visit your site:**
   - Go to: https://bwag84.github.io/bwag84/

**Note:** You only need to do this once. After the initial setup, every push to `main` will automatically trigger deployments.

## 📝 Making Updates

### Updating Content

All content is managed through markdown files and configuration:

- **Personal Info:** Edit `hugo.toml` - name, tagline, email, social links, etc.
- **About Section:** Edit `content/about.md`
- **Skills:** Edit `content/skills.md`
- **Experience:** Edit `content/experience.md`
- **Technical Stack:** Edit `content/technical.md`
- **Blog Posts:** Add/edit files in `content/blog/`

### Adding a New Blog Post

```bash
hugo new content blog/your-post-title.md
```

Or manually create a file in `content/blog/` with front matter:

```yaml
---
title: "Your Post Title"
date: 2025-01-15
draft: false
description: "SEO description for the post"
tags: ["SEO", "Digital Marketing"]
---

Your content here...
```

### Adding Custom Images

Place images in `static/images/` and reference them as `/images/filename.png` in your content.

## 🔄 Deploying Updates

The site automatically deploys to GitHub Pages when you push to the `main` branch.

### Step-by-Step Deployment

1. **Make your changes** (edit content, add blog posts, update config, etc.)

2. **Test locally**
   ```bash
   npm run dev
   ```
   Verify everything looks good at http://localhost:1313

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "Your descriptive commit message"
   ```

4. **Push to GitHub**
   ```bash
   git push origin main
   ```

5. **Automatic deployment**
   - GitHub Actions will automatically build and deploy your site
   - Check the "Actions" tab in your GitHub repository to monitor progress
   - Site will be live at https://bwag84.github.io/bwag84/ in 1-2 minutes

## 🎨 Customization

### Colors
The theme uses a three-tier color system in `hugo.toml`:
- **Base colors:** Hex values (single source of truth)
- **Semantic colors:** References to base colors
- **Section colors:** Component-specific colors

Change colors by editing the `[params.colors]` section in `hugo.toml`.

### Layout Overrides
Custom layouts go in `layouts/` to override theme defaults:
- `layouts/partials/hero.html` - Hero section
- `layouts/partials/contact.html` - Contact section
- `layouts/partials/footer.html` - Footer

Theme layouts remain in `themes/careercanvas/layouts/`.

## 🛠️ Build Commands

```bash
# Development server with drafts
npm run dev

# Production build
npm run build:css && npm run build

# Update theme
git submodule update --remote themes/careercanvas
```

## 📁 Project Structure

```
.
├── .github/workflows/   # GitHub Actions for deployment
├── content/            # All content (markdown files)
│   ├── about.md
│   ├── skills.md
│   ├── experience.md
│   ├── technical.md
│   └── blog/          # Blog posts
├── layouts/           # Custom layout overrides
│   └── partials/
├── static/            # Static assets (images, files)
│   ├── images/
│   └── files/
├── themes/            # Theme (git submodule)
│   └── careercanvas/
├── hugo.toml          # Main configuration file
└── package.json       # Node dependencies
```

## 🔧 Troubleshooting

### GitHub Pages Not Updating

1. Check the "Actions" tab in your GitHub repo for errors
2. Ensure GitHub Pages is enabled:
   - Go to Settings → Pages
   - Source should be "GitHub Actions"

### Submodule Not Loading

```bash
git submodule update --init --recursive
```

### Build Errors

```bash
# Clear Hugo cache
hugo mod clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📚 Documentation

- **Project Guide:** See `CLAUDE.md` for detailed development instructions
- **Theme Docs:** `themes/careercanvas/README.md`
- **Color Customization:** `themes/careercanvas/COLOR_CUSTOMIZATION.md`
- **Blog Guide:** `BLOG_GUIDE.md`

## 📄 License

This portfolio site is personal property of Bart Wagener.

## 🤝 Contact

- **Email:** bartwagener@gmail.com
- **LinkedIn:** https://linkedin.com/in/bartwagener
- **GitHub:** https://github.com/bwag84
