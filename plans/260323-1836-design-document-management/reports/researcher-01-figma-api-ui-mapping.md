# Figma Integration & UI Component Mapping Research

**Date:** 2026-03-23 | **Status:** Complete

---

## 1. Figma Embed API - Read-Only Design Embedding

### Key Findings
- **Live Embed Kit** (recommended): Share → Public Embed → Copy iframe code. Auto-updates with design changes.
- **Embed API with OAuth**: Requires client-id query param. Enables prototype navigation, page/frame jumping via postMessage.
- **oEmbed Support**: Via Embedly third-party provider for blog/CMS integration.

### Limitations
- **No layer-level click detection** inside embedded frames. Embeds are stripped-down, non-interactive versions.
- **Cannot programmatically detect clicks on specific design components** within the embed.
- Embed API only supports: NAVIGATE_FORWARD, NAVIGATE_BACKWARD, RESTART actions.
- Cross-origin restrictions via postMessage security model.

### Code Example (Embed API)
```html
<iframe
  id="embed-frame"
  src="https://embed.figma.com/proto/{FILE_KEY}?node-id=XXX&embed-host=share&client-id={CLIENT_ID}"
  allowfullscreen
></iframe>

<script>
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://www.figma.com') return;
  console.log('Proto event:', event.data);
});
</script>
```

**Tradeoff:** Live embeds keep designs in sync but lose click granularity for mapping.

---

## 2. Figma REST API - Component Metadata Extraction

### Key Endpoints

#### GET /v1/files/{key}
Returns full file JSON with component metadata.

```
Response structure:
{
  "document": { /* node tree */ },
  "components": Map<nodeId, ComponentMetadata>,
  "componentSets": Map<nodeId, ComponentSetMetadata>,
  "styles": Map<nodeId, StyleMetadata>,
  "version": "string"
}
```

#### GET /v1/files/{key}/nodes?ids={nodeId}
Fetch specific node subtrees. Supports:
- `geometry=paths`: Returns full vector path data
- `depth=N`: Limit tree depth (1=pages, 2=page + top-level objects)
- Can batch multiple node IDs

### Node Position & Bounds
Every node includes:
- **x, y**: Absolute position on canvas
- **width, height**: Core dimensions
- **absoluteBoundingBox**: Includes transforms (rotation, scale)
- **absoluteRenderBounds**: Includes shadows, strokes

### Component Instance Structure
```javascript
{
  "id": "node-id",
  "type": "INSTANCE",
  "componentId": "component-node-id",  // Points to main component
  "x": 0, "y": 0,
  "width": 100, "height": 100,
  "children": [ /* child nodes */ ]
}
```

### Limitations
- **Rate limits**: Tier 1 endpoint (slower).
- **OAuth required**: Need file_content:read scope.
- **No real-time updates**: REST API, not WebSocket.

---

## 3. Bi-directional Mapping: Design ↔ Table

### Recommended Approach: SVG Overlay Hotspots

**Why SVG > Canvas:**
- DOM-integrated: Each hotspot is an interactive element (event listeners, CSS classes).
- Responsive: Use viewBox + preserveAspectRatio for scaling.
- Maintainable: Coordinates auto-adjust with image resize.

### Architecture Flow
1. **Export** Figma frame as PNG/SVG via REST API: `/v1/files/{key}/images?ids={frameId}`
2. **Parse** API response to get node bounds (x, y, width, height)
3. **Generate SVG overlay** with `<rect>` or `<polygon>` hotspots at Figma coordinates
4. **Normalize coordinates** to image viewBox (0,0,imageWidth,imageHeight)
5. **Attach click handlers** to map hotspot → database row

### Code Snippet (React)
```jsx
function DesignWithHotspots({ frameId, nodes, onHotspotClick }) {
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    // Fetch Figma image export
    fetch(`/api/figma/export?nodeId=${frameId}`)
      .then(r => r.json())
      .then(data => setImageUrl(data.url));
  }, [frameId]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <img src={imageUrl} style={{ width: '100%', display: 'block' }} />
      <svg
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%'
        }}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {nodes.map(node => (
          <rect
            key={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            fill="transparent"
            stroke="rgba(0,0,255,0.2)"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
            onClick={() => onHotspotClick(node)}
          />
        ))}
      </svg>
    </div>
  );
}
```

### Responsiveness (Mobile/Tablet/PC)
- SVG scales via CSS `width: 100%`
- viewBox preserves aspect ratio automatically
- Click coordinates auto-scale via SVG coordinate system
- **Works across all devices** with no recalculation needed

---

## 4. React Image Hotspot Libraries

### Top Options

#### react-image-hotspots
- **Repo:** [filipecorrea/react-image-hotspots](https://github.com/filipecorrea/react-image-hotspots)
- **Features:** Zoom controls, responsive hotspots, custom content
- **License:** MIT
- **State:** Actively maintained

#### react-image-hotspot (Alternative)
- **Repo:** [LiamMartens/react-image-hotspot](https://github.com/LiamMartens/react-image-hotspot)
- **Lighter:** Minimal dependency footprint
- **API:** Simpler (src, value, onChange props)

### Evaluation
Both libraries are viable. **react-image-hotspots** has more features (zoom, better responsiveness). **react-image-hotspot** is lighter but less flexible.

**Recommendation:** Use custom SVG approach (as above) for full control. Pre-built libs trade flexibility for convenience.

---

## 5. Google Stitch & Sites Integration

### Google Stitch (AI-Powered Design Tool)
- **What:** AI UI generator (May 2025 release) that creates multi-screen prototypes from text/URL
- **Export:** Native export to Google AI Studio (for adding Gemini API calls, interactivity)
- **Model Context Protocol (MCP):** Bridges Stitch to local tools/databases
- **Status:** Enterprise rollout in Feb 2026 with team collaboration, API endpoints

### Google Sites Embedding
- **No native REST API** for design extraction (unlike Figma)
- **Embed via iframe only:** Limited to sharing published site URLs
- **Not suitable** for component mapping / metadata extraction

### Verdict
Stitch supports design-to-code workflows but **lacks fine-grained component metadata API** like Figma. For this project, **Figma is the primary integration**, Stitch is future-proofing for AI-generated UI workflows.

---

## 6. Implementation Roadmap

| Component | Solution | Tradeoff |
|-----------|----------|----------|
| Read-only embed | Figma Live Embed Kit (iframe) | No click granularity inside embed |
| Component metadata | Figma REST API (`/v1/files/{key}`) | Requires OAuth, rate-limited |
| Hotspot mapping | SVG overlay on exported image | Static image, requires re-export on design change |
| Responsiveness | SVG viewBox + CSS scaling | Works across all device sizes |
| Libraries | Custom SVG or react-image-hotspots | Custom = control, lib = convenience |

---

## 7. Unresolved Questions

1. **Real-time sync:** Should design changes auto-update embedded preview? (Requires polling or WebSocket)
2. **Hotspot persistence:** How to track hotspot changes when Figma design evolves? (Node IDs stable?)
3. **Bi-directional save:** Can table row edits push changes back to Figma? (Requires Figma REST API write scope, not available for read-only)
4. **Multi-frame mapping:** Should each document support multiple design frames? (Scope expansion)

---

## Sources

- [Figma Embed API Docs](https://developers.figma.com/docs/embeds/embed-api/)
- [Figma REST API File Endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/)
- [Figma Node Properties](https://developers.figma.com/docs/plugins/api/node-properties/)
- [react-image-hotspots](https://github.com/filipecorrea/react-image-hotspots)
- [react-image-hotspot](https://github.com/LiamMartens/react-image-hotspot)
- [Google Stitch AI UI Design Tool](https://developers.googleblog.com/stitch-a-new-way-to-design-uis/)
- [SVG Responsive Overlays](https://dev.to/damjess/responsive-svg-image-overlays-4bni)
- [SVG Hotspots Patterns](https://dev.to/jamesthomson/svg-tricks-kickass-hotspots-904)
