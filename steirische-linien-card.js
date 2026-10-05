const STEIRISCHE_LINIEN_DOMAIN = 'steirische_linien';

// All departure sensors of the integration, grouped by station name
function findStationSensors(hass) {
  const stations = new Map();
  Object.keys(hass.states).forEach(entityId => {
    if (!entityId.startsWith('sensor.')) return;
    const attributes = hass.states[entityId].attributes;
    const registryEntry = hass.entities && hass.entities[entityId];
    const fromIntegration = registryEntry
      ? registryEntry.platform === STEIRISCHE_LINIEN_DOMAIN
      : 'available_lines' in attributes;
    if (!fromIntegration || !attributes.station) return;
    if (!stations.has(attributes.station)) stations.set(attributes.station, []);
    stations.get(attributes.station).push(entityId);
  });
  stations.forEach(ids => ids.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  return new Map([...stations.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// Entity ids shown by the card: all sensors of the selected stations, or sensor_1 … sensor_7
function getCardEntities(hass, config) {
  if (Array.isArray(config.stations)) {
    const stations = findStationSensors(hass);
    return config.stations.flatMap(station => stations.get(station) || []);
  }
  const entities = [];
  for (let i = 1; i <= 7; i++) {
    entities.push(config[`sensor_${i}`] || `sensor.transit_departure_${i}`);
  }
  return entities;
}

class SteirischeLinienCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    
    if (!this.content) {
      this.innerHTML = `
        <ha-card>
          <div class="card-content">
            <div class="departures-container"></div>
          </div>
        </ha-card>
        <style>
          .departures-container {
            padding: 0;
          }
          .departure-row {
            display: flex;
            align-items: center;
            padding: 4px 0;
            border-bottom: 1px solid var(--divider-color);
          }
          .departure-row:first-child {
            padding-top: 0;
          }
          .departure-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }
          .line-badge {
            min-width: 30px;
            height: 24px;
            background-color: var(--primary-color);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            font-weight: bold;
            margin-right: 12px;
            padding: 0 4px;
          }
          .destination {
            flex: 1;
            color: var(--primary-text-color);
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .time-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            margin-left: 12px;
          }
          .minutes {
            font-size: 18px;
            font-weight: bold;
            color: var(--primary-text-color);
          }
          .minutes-label {
            font-size: 12px;
            color: var(--secondary-text-color);
            margin-left: 2px;
          }
          .delayed {
            color: var(--error-color);
          }
          .scheduled {
            color: var(--warning-color);
          }
          .status-indicator {
            font-size: 10px;
            margin-top: 2px;
            font-weight: 500;
          }
          .no-departures {
            padding: 20px;
            text-align: center;
            color: var(--secondary-text-color);
          }
          @media (max-width: 400px) {
            .destination {
              font-size: 12px;
            }
            .line-badge {
              min-width: 40px;
              height: 25px;
              font-size: 14px;
            }
          }
        </style>
      `;
      this.content = this.querySelector(".departures-container");
    }

    this.updateDepartures();
  }

  updateDepartures() {
    if (!this._hass || !this.config) return;

    let departures = [];
    
    // Collect the departure sensors of the selected stations
    getCardEntities(this._hass, this.config).forEach((entityId, i) => {
      const entity = this._hass.states[entityId];
      
      if (entity && entity.state !== 'unavailable' && entity.state !== 'unknown') {
        const attributes = entity.attributes;
        
        if (attributes.line) {
          departures.push({
            line: attributes.line,
            station: attributes.station || '',
            destination: attributes.destination || 'Unknown',
            minutes: parseInt(entity.state) || 0,
            time: attributes.departure_time || '',
            isDelayed: attributes.is_delayed || false,
            isScheduled: attributes.is_scheduled || false,
            index: i
          });
        }
      }
    });

    // Sort by minutes
    departures.sort((a, b) => a.minutes - b.minutes);

    // Limit to configured number of departures
    const maxDepartures = this.config.departure_count || 7;
    departures = departures.slice(0, maxDepartures);

    // Render departures
    if (Array.isArray(this.config.stations) && this.config.stations.length === 0) {
      this.content.innerHTML = '<div class="no-departures">Keine Station ausgewählt</div>';
      return;
    }
    if (departures.length === 0) {
      this.content.innerHTML = '<div class="no-departures">Keine Abfahrten verfügbar</div>';
      return;
    }

    this.content.innerHTML = departures.map(dep => {
      let statusClass = '';
      let statusText = '';
      
      if (dep.isDelayed) {
        statusClass = 'delayed';
        statusText = 'VERSPÄTET';
      } else if (dep.isScheduled) {
        statusClass = 'scheduled';
        statusText = 'FAHRPLAN';
      }

      let lineColor = '';
      // Priority: line color for this station > station color > line color for all stations
      const lineColors = this.config.line_colors || [];
      const stationLineConfig = lineColors.find(lc => lc.station !== undefined && lc.station === dep.station && lc.line === dep.line);
      const stationConfig = (this.config.station_colors || []).find(sc => sc.station === dep.station);
      const colorConfig = lineColors.find(lc => lc.station === undefined && lc.line === dep.line);
      const color = (stationLineConfig && stationLineConfig.color) || (stationConfig && stationConfig.color) || (colorConfig && colorConfig.color);
      if (color) {
        lineColor = `style="background-color: ${this.escapeHtml(color)}"`;
      }

      return `
        <div class="departure-row">
          <div class="line-badge" ${lineColor}>${this.escapeHtml(dep.line)}</div>
          <div class="destination">${this.escapeHtml(dep.destination)}</div>
          <div class="time-info">
            <div class="minutes ${statusClass}">
              ${dep.minutes}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = config;
  }

  getCardSize() {
    return 3;
  }

  static getConfigElement() {
    return document.createElement("steirische-linien-card-editor");
  }

  static getStubConfig(hass) {
    // New cards show all stations of the integration
    return {
      stations: hass ? [...findStationSensors(hass).keys()] : []
    };
  }
}

// Card Editor (uses plain HTML inputs so it does not depend on Home Assistant internal components)
class SteirischeLinienCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  // Stations of the configured sensors with their available lines
  getStations() {
    const stations = new Map();
    getCardEntities(this._hass, this._config).forEach(entityId => {
      const entity = this._hass.states[entityId];
      if (!entity) return;
      const attributes = entity.attributes;
      const station = attributes.station || '';
      if (!stations.has(station)) stations.set(station, new Set());
      const lines = stations.get(station);
      (attributes.available_lines || []).forEach(line => lines.add(line));
      if (attributes.line) lines.add(attributes.line);
    });
    // Keep lines that already have a color, even if they are not departing right now
    (this._config.line_colors || []).forEach(lc => {
      if (lc.station !== undefined && stations.has(lc.station) && lc.line) {
        stations.get(lc.station).add(lc.line);
      }
    });
    return [...stations.entries()].map(([station, lines]) => ({
      station,
      lines: [...lines].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }));
  }

  render() {
    if (!this._hass || !this._config) return;

    const stations = this.getStations();
    const allStations = [...findStationSensors(this._hass).keys()];
    const selectedStations = Array.isArray(this._config.stations)
      ? this._config.stations
      : stations.map(s => s.station);

    // Prevent re-rendering if already rendered with same config and stations
    const configString = JSON.stringify(this._config) + JSON.stringify(stations) + JSON.stringify(allStations);
    if (this._lastConfigString === configString) return;
    this._lastConfigString = configString;

    const lineColors = this._config.line_colors || [];
    const stationColors = this._config.station_colors || [];
    const globalLineColors = lineColors.filter(lc => lc.station === undefined);

    this.innerHTML = `
      <div class="card-config">
        <div class="config-section">
          <h3 class="section-title">Stations</h3>
          <p class="section-description">Choose the stations whose departures are shown in this card.</p>
          ${allStations.length === 0 ? `
            <p class="section-description">No stations found. Set up the Steiermark Öffis integration in Station Departures mode (version 1.2.4 or newer).</p>
          ` : allStations.map((station, index) => `
            <label class="color-row">
              <input type="checkbox" class="station-select" data-index="${index}" ${selectedStations.includes(station) ? 'checked' : ''}>
              <span class="name">${this.escapeHtml(station)}</span>
            </label>
          `).join('')}
        </div>

        <div class="config-section">
          <h3 class="section-title">Colors</h3>
          <p class="section-description">Tick a station or line and pick a color. A line color for a station takes priority over the station color.</p>
          ${stations.length === 0 ? `
            <p class="section-description">Select at least one station above.</p>
          ` : stations.map(({ station, lines }, s) => {
            const sc = stationColors.find(c => c.station === station);
            return `
              <div class="station">
                ${station ? `
                  <div class="color-row station-row">
                    <input type="checkbox" class="enabled" data-kind="station" data-station="${s}" ${sc ? 'checked' : ''} title="Use a color for the whole station">
                    <span class="name">${this.escapeHtml(station)}</span>
                    <input type="color" class="color" data-kind="station" data-station="${s}" value="${sc ? sc.color : '#2196F3'}" title="Station color">
                  </div>
                ` : ''}
                ${lines.length === 0 ? `<p class="section-description">No lines known yet.</p>` : ''}
                ${lines.map((line, l) => {
                  const lc = lineColors.find(c => c.station === station && c.line === line);
                  const gc = globalLineColors.find(c => c.line === line);
                  return `
                    <div class="color-row line-row">
                      <input type="checkbox" class="enabled" data-kind="line" data-station="${s}" data-line="${l}" ${lc ? 'checked' : ''} title="Use a color for this line">
                      <span class="badge" style="background-color: ${this.escapeHtml((lc && lc.color) || (sc && sc.color) || (gc && gc.color) || 'var(--primary-color)')}">${this.escapeHtml(line)}</span>
                      <span class="name">Line ${this.escapeHtml(line)}</span>
                      <input type="color" class="color" data-kind="line" data-station="${s}" data-line="${l}" value="${lc ? lc.color : '#2196F3'}" title="Line color">
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>

        ${globalLineColors.length ? `
          <div class="config-section">
            <h3 class="section-title">Line Colors for all Stations</h3>
            <p class="section-description">Configured in YAML without a station.</p>
            ${globalLineColors.map(lc => `
              <div class="color-row">
                <span class="badge" style="background-color: ${this.escapeHtml(lc.color || '')}">${this.escapeHtml(lc.line || '')}</span>
                <span class="name">Line ${this.escapeHtml(lc.line || '')}</span>
                <button class="remove" data-line="${this.escapeHtml(lc.line || '')}" title="Remove">×</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <style>
        .config-section { margin-bottom: 24px; }
        .section-title { margin: 0 0 8px 0; font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
        .section-description { margin: 0 0 12px 0; color: var(--secondary-text-color); font-size: 14px; }
        .station { border: 1px solid var(--divider-color); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
        .color-row { display: flex; gap: 10px; align-items: center; min-height: 36px; }
        .station-row { font-weight: 500; border-bottom: 1px solid var(--divider-color); margin-bottom: 4px; padding-bottom: 4px; }
        .name { flex: 1; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .badge {
          min-width: 30px; height: 24px; padding: 0 4px; border-radius: 4px;
          color: white; font-weight: bold; display: flex; align-items: center; justify-content: center;
        }
        .color { width: 48px; height: 28px; border: none; padding: 0; background: none; cursor: pointer; }
        .remove {
          width: 28px; height: 28px; border: 1px solid var(--divider-color); border-radius: 4px;
          background: var(--card-background-color); color: var(--secondary-text-color); cursor: pointer;
        }
        .remove:hover { color: var(--error-color); border-color: var(--error-color); }
      </style>
    `;

    const fireChanged = () => {
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
    };

    this.querySelectorAll('.station-select').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        const selected = allStations.filter((station, index) =>
          this.querySelector(`.station-select[data-index="${index}"]`).checked);
        // The station selection replaces the manually configured sensors
        const config = { ...this._config, stations: selected };
        for (let i = 1; i <= 7; i++) delete config[`sensor_${i}`];
        this._config = config;
        fireChanged();
      });
    });

    const selector = (kind, s, l) =>
      `[data-kind="${kind}"][data-station="${s}"]` + (l === undefined ? '' : `[data-line="${l}"]`);

    const update = (kind, s, l) => {
      const station = stations[s].station;
      const enabled = this.querySelector(`.enabled${selector(kind, s, l)}`).checked;
      const color = this.querySelector(`.color${selector(kind, s, l)}`).value;
      if (kind === 'station') {
        const colors = (this._config.station_colors || []).filter(sc => sc.station !== station);
        if (enabled) colors.push({ station, color });
        this._config = { ...this._config, station_colors: colors };
      } else {
        const line = stations[s].lines[l];
        const colors = (this._config.line_colors || []).filter(lc => !(lc.station === station && lc.line === line));
        if (enabled) colors.push({ line, station, color });
        this._config = { ...this._config, line_colors: colors };
      }
      fireChanged();
    };

    this.querySelectorAll('.enabled').forEach(checkbox => {
      const { kind, station, line } = checkbox.dataset;
      checkbox.addEventListener('change', () => update(kind, station, line));
    });

    this.querySelectorAll('.color').forEach(colorInput => {
      const { kind, station, line } = colorInput.dataset;
      colorInput.addEventListener('change', (e) => {
        e.stopPropagation();
        // Picking a color enables it
        this.querySelector(`.enabled${selector(kind, station, line)}`).checked = true;
        update(kind, station, line);
      });
      colorInput.addEventListener('click', (e) => e.stopPropagation());
      colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    this.querySelectorAll('.remove').forEach(button => {
      button.addEventListener('click', () => {
        const colors = (this._config.line_colors || []).filter(lc => !(lc.station === undefined && lc.line === button.dataset.line));
        this._config = { ...this._config, line_colors: colors };
        fireChanged();
      });
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  get hass() {
    return this._hass;
  }
}

// Guard against the card being loaded twice (e.g. an old resource still registered)
if (!customElements.get('steirische-linien-card')) {
  customElements.define('steirische-linien-card', SteirischeLinienCard);
  customElements.define('steirische-linien-card-editor', SteirischeLinienCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "steirische-linien-card",
    name: "Steiermark Öffi Card",
    description: "Display transit departures from Steiermark Öffis",
    preview: false,
    documentationURL: "https://github.com/FluxLP/steiermark-oeffis-card"
  });
} else {
  console.warn('Steiermark Öffi Card: steirische-linien-card is already defined. Remove old card resources (e.g. PH_Steiermark_Oeffi_Card) under Settings → Dashboards → Resources.');
}
