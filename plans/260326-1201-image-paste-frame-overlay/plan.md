---
title: "Image Paste & Frame Overlay System"
description: "Support PNG/JPG paste alongside SVG and add Figma-like frame drawing overlay for component creation"
status: done
priority: P1
effort: 12h
branch: feat/v2.29
tags: [design-doc, frontend, backend, image, overlay, canvas]
created: 2026-03-26
---

# Image Paste & Frame Overlay System

## Goal
Extend the design screen to accept PNG/JPG images (not just SVG) and provide a canvas overlay where users draw rectangles to define components with ID, name, and description -- Figma-style annotation.

## Current State
- Clipboard handler (`use-clipboard-svg-paste.ts`) only accepts SVG
- Viewer (`design-frame-interactive-svg.tsx`) renders SVG via innerHTML, click-maps components by `svgElementId`
- Backend `screens` table stores `svg_content` (TEXT), `svg_layers` (JSON), `frame_width`/`frame_height`
- Component model already has `position` JSON field (`{x, y, width, height}`) -- unused for SVG-click flow but perfect for frame overlay

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Image paste support (backend + frontend) | done | 4h | [phase-01](./phase-01-image-paste-support.md) |
| 2 | Frame overlay canvas (draw rectangles) | done | 5h | [phase-02](./phase-02-frame-overlay-canvas.md) |
| 3 | Frame-to-component integration | done | 3h | [phase-03](./phase-03-frame-component-integration.md) |

## Key Decisions
- **Reuse `svg_content` field** for image data URLs (base64). Add `content_type` column ("svg" | "image") to distinguish rendering mode. Avoids schema explosion.
- **Canvas overlay** uses HTML5 Canvas positioned absolutely over the image/SVG container. No external lib needed.
- **Component `position` field** already exists. Frame rectangles map 1:1 to component position.
- **No file upload service** needed -- base64 in DB is acceptable for design screenshots (typically <2MB).

## Dependencies
- No new npm packages required (Canvas API is native)
- Backend migration for `content_type` column on `screens` table
- Frontend: modify 5 existing files, create 2 new components

## Risk
- Large base64 images could bloat DB. Mitigation: enforce max 5MB limit on paste.
- Canvas coordinate math must account for zoom/scroll of the container.
