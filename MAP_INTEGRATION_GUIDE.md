# Map Integration Guide for Summary Page

## Overview
The interactive Nigeria security map is now fully integrated into the summary page, showing real-time affected areas with color-coded severity levels.

## How It Works

### 1. **Data Flow**
```
Backend API (/api/state-severity) 
  ↓
Fetches incident data from news feeds
  ↓
Calculates severity per state (mild/moderate/severe)
  ↓
Summary Page JavaScript
  ↓
Applies color coding to map paths
```

### 2. **Color Coding**
- 🟡 **Yellow (#ffd700)** - Mild severity (0-4 incidents)
- 🟠 **Orange (#ff8c00)** - Moderate severity (5-9 incidents)
- 🔴 **Red (#dc143c)** - Severe severity (10+ incidents)

### 3. **Key Components**

#### Backend (`server.js`)
- `/api/state-severity` - Returns severity data for all states
- State-to-ID mapping (e.g., 'NG-KD' for Kaduna)
- Incident counting and severity calculation

#### Frontend (`summary-template.html`)
- `loadMap(severityData)` - Main function that:
  1. Creates SVG container
  2. Fetches paths from index.html
  3. Applies severity classes
  4. Adds hover effects and tooltips

### 4. **Features**

✅ Real-time data fetching from API
✅ Responsive SVG map (adapts to screen size)
✅ Hover effects showing state details
✅ Color-coded severity visualization
✅ Tooltips with incident counts
✅ Smooth transitions and animations

## Usage

### On the Summary Page

The map automatically loads when you access the summary dashboard:

```javascript
// Called automatically during page load
await loadMap(severity);
```

### Interaction

- **Hover over states** - See incident count and severity level
- **View chart below** - Shows top 10 most affected states
- **Affected states list** - Displays all affected states as chips

## API Response Format

```json
{
  "NG-KD": { "count": 8, "severity": "moderate" },
  "NG-BO": { "count": 12, "severity": "severe" },
  "NG-ZA": { "count": 3, "severity": "mild" }
}
```

## Customization

### Change Color Scheme

Edit the CSS in `summary-template.html`:
```css
.severity-mild { fill: #ffd700 !important; }      /* Change yellow */
.severity-moderate { fill: #ff8c00 !important; }  /* Change orange */
.severity-severe { fill: #dc143c !important; }    /* Change red */
```

### Add More States

Add state paths to index.html's SVG, and ensure `NG-XX` ID format matches server state codes.

### Modify Severity Thresholds

In `server.js`, update the thresholds:
```javascript
if (count >= 10) severity = 'severe';      // Adjust threshold
else if (count >= 5) severity = 'moderate'; // Adjust threshold
```

## Technical Details

### SVG Path Integration
- Paths are fetched from index.html's `#map-container svg`
- Each `<path>` element has an ID (e.g., `id="NG-KD"`)
- Classes are dynamically added based on severity

### State ID Mapping
```javascript
const STATE_NAME_MAP = {
  'NG-AB': 'Abia', 'NG-AD': 'Adamawa', ...
}
```

### Rendering Process
1. Create empty SVG container
2. Fetch original paths from index.html
3. Clone paths to new SVG
4. Apply severity styling
5. Add interactivity (hover, tooltips)

## Troubleshooting

### Map Not Showing?
1. Check `/api/state-severity` returns data
2. Verify index.html SVG is accessible
3. Check browser console for errors
4. Ensure state ID format matches (NG-XX)

### Colors Not Applying?
1. Verify CSS classes are correct
2. Check severity calculation logic
3. Inspect element to see applied classes
4. Clear browser cache

### No Incidents Detected?
1. Check `/api/news` has data
2. Verify state keywords in server.js
3. Check incident filtering logic
4. Review news source connectivity

## Integration with PDF Reports

The same map data is used in PDF generation:
- Function: `getMapSvgWithSeverity()` in server.js
- Output: Static SVG with applied severity colors
- Usage: Embedded in PDF reports

## Future Enhancements

- Click state to drill down into incidents
- Time-series animation showing trend
- Export map as image
- Custom severity thresholds per user
- Real-time WebSocket updates
