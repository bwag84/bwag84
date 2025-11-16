# Blog Guide

## Your Blog is Ready!

Your blog is now live at `/blog/` with three sample posts based on your real SEO experience.

## Sample Blog Posts Created

1. **Building SEO Processes from Scratch in a Large Organization** (Jan 2025)
   - Based on your FedEx experience
   - Topics: Process building, enterprise SEO, TeSSC, education

2. **Machine Learning for SEO Before ChatGPT Was a Thing** (Nov 2024)
   - Based on your Action experience
   - Topics: ML for product descriptions, innovation, AI in SEO

3. **International SEO Strategy: Beyond Translation** (Oct 2024)
   - Based on your international SEO work
   - Topics: Localization, hreflang, multi-market SEO

## How to Create New Blog Posts

### Quick Method
Create a new file in `content/blog/` with this format:

```markdown
---
title: "Your Post Title"
date: 2025-01-15
draft: false
description: "Brief description for SEO"
tags: ["SEO", "Technical SEO", "Analytics"]
---

## Your Heading

Your content here...
```

### Using Hugo Command
```bash
hugo new blog/your-post-name.md
```

Then edit the file in `content/blog/your-post-name.md`

## Blog Post Structure

### Front Matter (Required)
- **title**: The post title
- **date**: Publication date (YYYY-MM-DD)
- **draft**: Set to `false` to publish, `true` to hide
- **description**: SEO meta description
- **tags**: Categories/topics (optional)

### Content Tips
- Use markdown formatting
- Add headings with `##` and `###`
- Include lists, code blocks, images
- Keep paragraphs short for readability
- Add internal links to other posts

## Managing Posts

### Publish a Post
Set `draft: false` in the front matter

### Hide a Post
Set `draft: true` in the front matter

### Delete a Post
Remove the file from `content/blog/`

### Edit a Post
Edit the markdown file in `content/blog/`

## SEO Tips for Your Blog

Based on your expertise, here are reminders:

1. **Keyword Research**: Target specific SEO topics
2. **Meta Descriptions**: Write compelling descriptions
3. **Internal Linking**: Link to your experience/skills sections
4. **Tags**: Use consistent tags for categorization
5. **URLs**: Hugo creates SEO-friendly URLs from titles
6. **Images**: Add alt text when you include images
7. **Update Dates**: Consider updating old posts with fresh content

## Blog Ideas Based on Your Experience

Topics you could write about:

- "How to Fix Hreflang Implementation Issues"
- "Building a Technical SEO Steering Committee"
- "Programmatic Content Creation for City-to-City Keywords"
- "Managing 1,500+ Google My Business Locations"
- "Implementing Server-Side Rendering for SEO"
- "SEO Training: How to Spread Awareness in Large Organizations"
- "From Agency to In-House: Lessons Learned"
- "Agile Marketing for SEO Teams"
- "Enterprise SEO Tool Selection: Conductor vs Others"
- "Local SEO at Scale with Yext and Uberall"

## Adding Images to Blog Posts

1. Create image folder: `static/images/blog/`
2. Add your image there
3. Reference in post:
```markdown
![Alt text](/images/blog/your-image.jpg)
```

## Navigation

Blog is in your main navigation menu between "Tech Stack" and "Contact"

## Viewing Your Blog

Visit: http://localhost:1313/blog/

---

**Pro Tip**: You can use your blog to showcase your SEO expertise and share the knowledge you've built over 10+ years in the field!
