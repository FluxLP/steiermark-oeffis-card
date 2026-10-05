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
    
    // Collect all 7 departure sensors
    for (let i = 1; i <= 7; i++) {
      const entityId = this.config[`sensor_${i}`] || `sensor.transit_departure_${i}`;
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
    }

    // Sort by minutes
    departures.sort((a, b) => a.minutes - b.minutes);

    // Limit to configured number of departures
    const maxDepartures = this.config.departure_count || 7;
    departures = departures.slice(0, maxDepartures);

    // Render departures
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

      // Get custom color: station color takes priority over line color
      let lineColor = '';
      const stationConfig = (this.config.station_colors || []).find(sc => sc.station === dep.station);
      const colorConfig = (this.config.line_colors || []).find(lc => lc.line === dep.line);
      const color = (stationConfig && stationConfig.color) || (colorConfig && colorConfig.color);
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

  static getStubConfig() {
    return {
      sensor_1: "sensor.transit_departure_1",
      sensor_2: "sensor.transit_departure_2",
      sensor_3: "sensor.transit_departure_3",
      sensor_4: "sensor.transit_departure_4",
      sensor_5: "sensor.transit_departure_5",
      sensor_6: "sensor.transit_departure_6",
      sensor_7: "sensor.transit_departure_7"
    };
  }
}

// Card Editor
class SteirischeLinienCardEditor extends HTMLElement {
  constructor() {
    super();
    // Material Design Icon for add
    this.addIcon = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";
  }

  setConfig(config) {
    this._config = config;
    this.render();
  }

  render() {
    if (!this.hass || !this._config) return;
    
    const stations = this.getStations();

    // Prevent re-rendering if already rendered with same config and stations
    const configString = JSON.stringify(this._config) + JSON.stringify(stations);
    if (this._lastConfigString === configString) return;
    this._lastConfigString = configString;

    const lineColors = this._config.line_colors || [];
    const stationColors = this._config.station_colors || [];

    this.innerHTML = `
      <div class="card-config">
        <div class="config-section">
          <h3 class="section-title">Display Configuration</h3>
          <p class="section-description">Choose how many departures to display</p>
          <ha-select
            id="departure_count"
            label="Number of departures"
          >
            ${[1, 2, 3, 4, 5, 6, 7].map(n => `
              <mwc-list-item value="${n}">${n} departure${n > 1 ? 's' : ''}</mwc-list-item>
            `).join('')}
          </ha-select>
        </div>
        
        <div class="config-section">
          <h3 class="section-title">Station Colors</h3>
          <p class="section-description">Color the line badges by the station they depart from (takes priority over line colors)</p>
          ${stations.length === 0 ? `
            <p class="section-description">No stations found. Update the Steiermark Öffis integration so the sensors provide a station attribute.</p>
          ` : stations.map((station, index) => {
            const sc = stationColors.find(c => c.station === station);
            return `
              <div class="station-color-row">
                <input
                  type="checkbox"
                  class="station-color-enabled"
                  data-index="${index}"
                  ${sc ? 'checked' : ''}
                  title="Use a color for this station"
                />
                <span class="station-name">${this.escapeHtml(station)}</span>
                <input
                  type="color"
                  class="station-color"
                  data-index="${index}"
                  value="${sc && sc.color ? sc.color : '#2196F3'}"
                  title="Choose color"
                />
              </div>
            `;
          }).join('')}
        </div>

        <div class="config-section">
          <h3 class="section-title">Line Colors</h3>
          <p class="section-description">Set custom colors for specific line numbers</p>
        </div>
        
        <div id="line-colors-container">
          ${lineColors.map((lc, index) => `
            <div class="line-color-row" data-index="${index}">
              <ha-textfield
                class="line-filter"
                label="Line Number"
                placeholder="e.g., 64"
                data-index="${index}"
              ></ha-textfield>
              <input
                type="color"
                class="line-color"
                value="${lc.color || '#2196F3'}"
                title="Choose color"
              />
              <button
                class="remove-line-color"
                data-index="${index}"
                title="Remove"
              >×</button>
            </div>
          `).join('')}
        </div>
        
        <ha-button
          id="add-line-color"
          raised
        ><ha-icon .path="${this.addIcon}"></ha-icon>Add Line Color</ha-button>
      </div>
      <style>
        .card-config {
          padding: 0;
        }
        .config-section {
          margin-bottom: 24px;
        }
        .section-title {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .section-description {
          margin: 0 0 16px 0;
          color: var(--secondary-text-color);
          font-size: 14px;
        }
        ha-textfield {
          width: 100%;
          margin-bottom: 16px;
          display: block;
        }
        ha-select {
          width: 100%;
          display: block;
        }
        .line-color-row {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          align-items: center;
          height: 56px;
        }
        .station-color-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          align-items: center;
          height: 40px;
        }
        .station-name {
          flex: 1;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .station-color {
          width: 60px;
          height: 100%;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          outline: 1px solid var(--outline-color);
        }
        .line-filter {
          flex: 1;
          min-width: 150px;
          max-width: 50%;
          margin-bottom: 0;
        }
        .line-color {
          width: 60px;
          height: 100%;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          outline: 1px solid var(--outline-color);
          position: relative;
        }
        .line-color:focus {
          outline: 2px solid var(--primary-color);
        }
        ha-button {
          margin-top: 16px;
        }
        ha-button ha-icon {
          margin-right: 8px;
        }
        .remove-line-color {
          width: 32px;
          height: 32px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--secondary-text-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
        }
        .remove-line-color:hover {
          color: var(--error-color);
          border-color: var(--error-color);
        }
        #add-line-color {
          margin-top: 8px;
          padding-bottom: 16px;
        }
      </style>
    `;
    
    // Set values immediately after creating elements
    const departureSelect = this.querySelector('#departure_count');
    if (departureSelect) {
      departureSelect.value = (this._config.departure_count || 7).toString();
    }
    
    // Set line filter values
    lineColors.forEach((lc, index) => {
      const lineInput = this.querySelector(`.line-filter[data-index="${index}"]`);
      if (lineInput) {
        lineInput.value = lc.line || '';
      }
    });

    // Add event listener for departure count
    const departureCount = this.querySelector('#departure_count');
    if (departureCount) {
      departureCount.addEventListener('change', (e) => {
        this._config = {
          ...this._config,
          departure_count: parseInt(e.target.value)
        };
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
      });
    }

    // Station colors
    const updateStationColor = (index) => {
      const station = stations[index];
      const enabled = this.querySelector(`.station-color-enabled[data-index="${index}"]`).checked;
      const color = this.querySelector(`.station-color[data-index="${index}"]`).value;
      const stationColors = (this._config.station_colors || []).filter(sc => sc.station !== station);
      if (enabled) {
        stationColors.push({ station, color });
      }
      this._config = { ...this._config, station_colors: stationColors };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
    };

    this.querySelectorAll('.station-color-enabled').forEach(checkbox => {
      checkbox.addEventListener('change', () => updateStationColor(parseInt(checkbox.dataset.index)));
    });

    this.querySelectorAll('.station-color').forEach(colorInput => {
      colorInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const index = parseInt(colorInput.dataset.index);
        // Picking a color enables it for this station
        this.querySelector(`.station-color-enabled[data-index="${index}"]`).checked = true;
        updateStationColor(index);
      });
      colorInput.addEventListener('click', (e) => e.stopPropagation());
      colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    // Add line color button
    const addButton = this.querySelector('#add-line-color');
    addButton.addEventListener('click', () => {
      const lineColors = [...(this._config.line_colors || [])];
      lineColors.push({ line: '', color: '#2196F3' });
      this._config = { ...this._config, line_colors: lineColors };
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
      this.render();
    });

    // Line color inputs
    this.querySelectorAll('.line-color-row').forEach(row => {
      const index = parseInt(row.dataset.index);
      
      const lineInput = row.querySelector('.line-filter');
      lineInput.addEventListener('change', (e) => {
        const lineColors = [...(this._config.line_colors || [])];
        lineColors[index] = { ...lineColors[index], line: e.target.value };
        this._config = { ...this._config, line_colors: lineColors };
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
      });

      const colorInput = row.querySelector('.line-color');
      colorInput.addEventListener('change', (e) => {
        e.stopPropagation();
        const lineColors = [...(this._config.line_colors || [])];
        lineColors[index] = { ...lineColors[index], color: e.target.value };
        this._config = { ...this._config, line_colors: lineColors };
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
      });
      
      // Prevent color picker from closing when clicking inside
      colorInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      colorInput.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      const removeButton = row.querySelector('.remove-line-color');
      removeButton.addEventListener('click', () => {
        const lineColors = [...(this._config.line_colors || [])];
        lineColors.splice(index, 1);
        this._config = { ...this._config, line_colors: lineColors };
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
        this.render();
      });
    });
  }

  // Distinct station names of the sensors configured in this card
  getStations() {
    const stations = [];
    for (let i = 1; i <= 7; i++) {
      const entityId = this._config[`sensor_${i}`] || `sensor.transit_departure_${i}`;
      const entity = this._hass && this._hass.states[entityId];
      const station = entity && entity.attributes.station;
      if (station && !stations.includes(station)) {
        stations.push(station);
      }
    }
    return stations;
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

customElements.define('steirische-linien-card', SteirischeLinienCard);
customElements.define('steirische-linien-card-editor', SteirischeLinienCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "steirische-linien-card",
  name: "Steiermark Öffi Card",
  description: "Display transit departures from Steirische Linien",
  preview: false,
  documentationURL: "https://github.com/FluxLP/steiermark-oeffis-card"
});