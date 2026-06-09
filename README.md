# The Hearing Aid Doctor — Site Editor

A self-hosted website editor for The Hearing Aid Doctor, a multi-location audiology practice in Minnesota. Edit page content directly in the browser, manage SEO, blog posts, images, and pages — all without touching code.

## Files

| File | Purpose |
|------|---------|
| `server.js` | Node.js HTTP server — serves the public site and editor, handles saves, uploads, and page management |
| `index.html` | The public-facing website (hero, services, locations, reviews, contact form) |
| `editor.html` | The admin site editor UI — visual editor with panels for content, sections, media, SEO, blog, and forms |
| `seo.html` | Standalone advanced SEO editor — opened from within the main editor for deeper SEO control |

## Requirements

- Node.js (no npm packages required — uses only built-in modules)

## Setup

1. Place all four files in the same folder.
2. Start the server:
   ```
   node server.js
   ```
3. Open the editor: [http://localhost:3333/admin](http://localhost:3333/admin)
4. View the public site: [http://localhost:3333](http://localhost:3333)

## Login

Default credentials (change in `server.js`):

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `hearingdoctor2026` |

To change credentials, edit the `ED_USER` and `ED_PASS` constants near the top of `server.js`.

## Editor Features

**Visual Editing**
- Click any element on the live page preview to edit text, colors, font sizes, spacing, and links
- Enable/disable edit mode from the top bar
- Undo / redo history

**Sections**
- List, reorder, show/hide, and delete page sections
- Insert new preset sections (hero, contact form, services, etc.)

**Media**
- Upload and manage the site logo
- Upload images and insert them into specific sections
- Media gallery with all uploaded images

**Tools (dropdown)**
- **SEO Editor** — Edit title tag, meta description, keywords, Open Graph tags, Twitter Card, JSON-LD schema, robots.txt, XML sitemap, redirects, and run an SEO audit
- **Blog Manager** — Create, edit, and publish blog posts with a rich text editor
- **Pages Manager** — Create new pages (blank or from a template), switch between pages, delete pages
- **Form Submissions** — View and manage contact form submissions

**Save**
- Saves the current page HTML to disk
- Automatically backs up the previous version (last 15 backups kept in `backups/`)

## Server API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Public website |
| `/admin` | GET | Editor UI |
| `/ping` | GET | Health check |
| `/pages` | GET | List all HTML pages |
| `/images` | GET | List uploaded images |
| `/uploads/:file` | GET | Serve an uploaded file |
| `/save` | POST | Save HTML to a page file |
| `/upload` | POST | Upload an image |
| `/page/create` | POST | Create a new HTML page |
| `/page/delete` | POST | Delete a page (backed up first) |

## File Structure (after first run)

```
/
├── server.js
├── index.html        ← public site (edited in-place)
├── editor.html       ← admin editor UI
├── seo.html          ← advanced SEO editor
├── uploads/          ← uploaded images (auto-created)
└── backups/          ← automatic page backups (auto-created)
```
