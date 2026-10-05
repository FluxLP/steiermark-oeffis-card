<img src="logo.png" alt="Steiermark Öffi Card Logo" width="160" align="right">

# Steiermark Öffi Card - Home Assistant Lovelace Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

A beautiful, customizable Lovelace card for displaying real-time public transit departure information from the [Steiermark Öffis Integration](https://github.com/FluxLP/steiermark-oeffis).

This is a fork of the original [PH_Steiermark_Oeffi_Card](https://github.com/gregor-autischer/PH_Steiermark_Oeffi_Card) by Gregor Autischer, extended with station colors for cards that combine several stations.

![Card Preview](preview_image.png)

## Features

- 🎨 **Clean, modern design** - Compact display with line badges and departure minutes
- 🎯 **Real-time status indicators** - Color-coded departure times indicate data source and delays
- 🔢 **Configurable departure count** - Display 1-7 departures
- 🌈 **Custom line colors** - Assign specific colors to transit lines
- 🚏 **Station colors** - Color line badges by the station they depart from (useful when combining sensors of several stations in one card)
- ⚡ **Visual configuration UI** - Easy setup through Home Assistant's UI

## Prerequisites

This card requires the [Steiermark Öffis Integration](https://github.com/FluxLP/steiermark-oeffis) to be installed and configured first. The integration provides the sensor entities that this card displays.

## Installation

A installation tutorial is available on YouTube (Video in German!): https://youtu.be/SNTVm_d8RSk

### Option 1: HACS (Recommended)

1. Ensure [HACS](https://hacs.xyz/) is installed
2. Add this repository as a custom repository:
   - HACS → Frontend → Menu → Custom repositories
   - Repository: `https://github.com/FluxLP/steiermark-oeffis-card`
   - Category: `Dashboard`
3. Click "Install"
4. Add the resource (if not automatically added):
   - Settings → Dashboards → Resources → Add Resource
   - URL: `/hacsfiles/steiermark-oeffis-card/steirische-linien-card.js`
   - Type: JavaScript Module
5. Restart Home Assistant

### Option 2: Manual Installation

1. Download `steirische-linien-card.js` from the [latest release](https://github.com/FluxLP/steiermark-oeffis-card/releases)
2. Copy it to your Home Assistant `config/www/` directory
3. Add the resource:
   - Settings → Dashboards → Resources → Add Resource
   - URL: `/local/steirische-linien-card.js`
   - Type: JavaScript Module
4. Restart Home Assistant

## Configuration

### Using the Visual Editor

1. **Add the card** to your dashboard:
   - Edit Dashboard → Add Card → Search "Steiermark Öffi"
   - Or Manual card → Type: `custom:steirische-linien-card`

2. **Configure options** through the visual editor:
   - **Stations**: Tick the stations whose departures are shown. The card finds the sensors of each station automatically, no entity IDs needed.
   - **Colors**: All stations of the configured sensors and their lines are listed automatically. Tick a station or a line and pick a color.

### YAML Configuration

#### Basic Configuration

```yaml
type: custom:steirische-linien-card
```

This will display all 7 departures with default styling.

#### Advanced Configuration

```yaml
type: custom:steirische-linien-card
departure_count: 5  # Number of departures to show (1-7, default: 7)
line_colors:        # Custom colors for specific lines
  - line: "64"
    color: "#FF5722"
  - line: "40"
    color: "#4CAF50"
  - line: "33"
    color: "#2196F3"
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stations` | array | all stations | Station names whose departures are shown (sensors are found automatically) |
| `departure_count` | number | 7 | Number of departures to display (YAML only) |
| `line_colors` | array | [] | Custom colors for specific transit lines |
| `station_colors` | array | [] | Colors per station; takes priority over `line_colors` |
| `sensor_1` … `sensor_7` | string | `sensor.transit_departure_1` … `_7` | Sensors to display (only used without `stations`) |

#### Line Colors Configuration

Each line color entry requires:
- `line`: The line number/name as a string (e.g., "64", "5E")
- `color`: Hex color code (e.g., "#FF5722")
- `station` (optional): Only apply the color to departures from this station

Color priority: line color for a station → station color → line color without station.

#### Station Colors Configuration

If you combine departures of several stations in one card, you can color the line badges by station. The visual editor lists all stations of the configured sensors automatically.

Each station color entry requires:
- `station`: The station name exactly as shown in the sensor's `station` attribute (Developer Tools → States)
- `color`: Hex color code

```yaml
type: custom:steirische-linien-card
stations:
  - "Graz Jakominiplatz"
  - "Graz Hauptbahnhof"
station_colors:
  - station: "Graz Jakominiplatz"
    color: "#FF9800"
  - station: "Graz Hauptbahnhof"
    color: "#4CAF50"
```

Line colors per station:

```yaml
line_colors:
  - line: "16"
    station: "Graz Hauptbahnhof"
    color: "#2196F3"
```

This requires the integration version 1.2.4 or newer (attributes `station` and `available_lines`).

### Troubleshooting: card shows the old name "PH Steiermark Oeffi Card"

The old card is still registered as a resource and is loaded first. Remove `/hacsfiles/PH_Steiermark_Oeffi_Card/steirische-linien-card.js` under **Settings → Dashboards → Resources** (three-dot menu, top right), uninstall the old card in HACS and reload the browser.

## Display Features

### Departure Information

Each departure shows:
- **Line badge** - Transit line number with custom color (if configured)
- **Destination** - Direction/final stop
- **Minutes** - Time until departure

### Status Indicators

Minutes are color-coded to indicate data quality:
- **Black** - Live departure time (real-time data available)
- **Orange** - Scheduled departure time (no real-time data available)  
- **Red** - Delayed departure (live data showing delay from schedule)

## Examples

### Minimal Setup

Just add the card with default settings:

```yaml
type: custom:steirische-linien-card
```

### Custom Colors for Specific Lines

```yaml
type: custom:steirische-linien-card
departure_count: 5
line_colors:
  - line: "64"
    color: "#E91E63"  # Pink
  - line: "40"
    color: "#4CAF50"  # Green
  - line: "5"
    color: "#FF9800"  # Orange
```

### Single Departure Display

For a minimal widget showing only the next departure:

```yaml
type: custom:steirische-linien-card
departure_count: 1
```

### Full Configuration

```yaml
type: custom:steirische-linien-card
departure_count: 7
line_colors:
  - line: "64"
    color: "#F44336"
  - line: "40"
    color: "#4CAF50"
  - line: "33"
    color: "#2196F3"
  - line: "5"
    color: "#FF9800"
  - line: "7"
    color: "#9C27B0"
```

## Styling

The card uses Home Assistant's theme variables for consistent appearance:
- `--primary-color` - Default line badge color
- `--primary-text-color` - Main text color
- `--secondary-text-color` - Secondary information
- `--divider-color` - Row separators
- `--error-color` - Delayed departures (red)
- `--warning-color` - Scheduled-only data (orange)

## Troubleshooting

### Card not appearing

1. Clear browser cache
2. Verify the resource is added correctly in Dashboard settings
3. Check browser console for errors (F12)
4. Ensure the integration is installed and sensors are working

### No departures shown

1. Verify the integration is configured and running
2. Check that sensor entities exist (`sensor.transit_departure_1` through `sensor.transit_departure_7`)
3. Ensure sensors have valid data in Developer Tools → States

### Colors not applying

1. Ensure line names match exactly (case-sensitive)
2. Use valid hex color codes (e.g., "#FF5722")
3. Try refreshing the page after configuration changes

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/FluxLP/steiermark-oeffis-card.git
cd steiermark-oeffis-card

# The card is a single JavaScript file - no build process required
# Make your changes to steirische-linien-card.js

# Test in Home Assistant by copying to www folder
cp steirische-linien-card.js /config/www/
```

### Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Credits

This card is designed to work with the [Steiermark Öffis Integration](https://github.com/FluxLP/steiermark-oeffis) for Home Assistant.

Based on the original [PH_Steiermark_Oeffi_Card](https://github.com/gregor-autischer/PH_Steiermark_Oeffi_Card) by Gregor Autischer.
