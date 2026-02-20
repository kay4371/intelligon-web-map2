// // Initialize the map
// const map = L.map('map-container').setView([9.0820, 8.6753], 6);

// // Add OpenStreetMap tiles
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// }).addTo(map);

// let statesLayer;
// let highlightedState = null;

// // Function to highlight a state
// function highlightState(feature) {
//     // Reset previous highlight if any
//     if (highlightedState) {
//         statesLayer.resetStyle(highlightedState);
//     }
    
//     // Highlight the new state
//     statesLayer.setStyle({
//         weight: 2,
//         color: '#666',
//         dashArray: '',
//         fillOpacity: 0.7
//     });
    
//     if (feature) {
//         statesLayer.setFeatureStyle(feature.id, {
//             fillColor: '#FF5733',
//             fillOpacity: 0.9,
//             weight: 3,
//             color: '#FF0000',
//             dashArray: ''
//         });
        
//         highlightedState = feature;
//         document.getElementById('info-panel').textContent = 
//             `Selected State: ${feature.properties.name}`;
//     } else {
//         document.getElementById('info-panel').textContent = 
//             'Click on a state or use the button above';
//     }
// }

// // Function to highlight a random state
// function highlightRandomState() {
//     fetch('/api/states')
//         .then(response => response.json())
//         .then(data => {
//             const randomIndex = Math.floor(Math.random() * data.features.length);
//             const randomState = data.features[randomIndex];
//             highlightState(randomState);
            
//             // Zoom to the state with some padding
//             map.fitBounds(L.geoJSON(randomState.geometry).getBounds(), {
//                 padding: [50, 50]
//             });
//         });
// }

// // Load and display Nigerian states
// fetch('/api/states')
//     .then(response => response.json())
//     .then(data => {
//         statesLayer = L.geoJSON(data, {
//             style: {
//                 fillColor: '#6DA5C0',
//                 weight: 1,
//                 opacity: 1,
//                 color: 'white',
//                 fillOpacity: 0.7
//             },
//             onEachFeature: (feature, layer) => {
//                 // Add popup with state name
//                 layer.bindPopup(`<b>${feature.properties.name}</b>`);
                
//                 // Add click event
//                 layer.on({
//                     click: () => highlightState(feature),
//                     mouseover: (e) => {
//                         e.target.setStyle({
//                             weight: 3,
//                             color: '#666',
//                             fillOpacity: 0.9
//                         });
//                     },
//                     mouseout: (e) => {
//                         // Don't reset style if this is the highlighted state
//                         if (!highlightedState || highlightedState.id !== feature.id) {
//                             statesLayer.resetStyle(e.target);
//                         }
//                     }
//                 });
//             }
//         }).addTo(map);
        
//         // Fit map to show all of Nigeria
//         map.fitBounds(statesLayer.getBounds());
//     });

// // Add event listener to the highlight button
// document.getElementById('highlight-btn').addEventListener('click', highlightRandomState);



// document.addEventListener('DOMContentLoaded', () => {
//     fetchACLEDData();
//     fetchNewsData();
//   });
  
//   async function fetchACLEDData() {
//     try {
//       const res = await fetch('/api/acled');
//       const data = await res.json();
  
//       // Example: Log to console and show counts per state
//       console.log('ACLED incidents by state:', data);
  
//       const output = document.getElementById('acled-output');
//       if (output) {
//         output.innerHTML = Object.entries(data).map(([state, events]) => (
//           `<li><strong>${state}</strong>: ${events.length} incidents</li>`
//         )).join('');
//       }
//     } catch (err) {
//       console.error('Failed to fetch ACLED data:', err);
//     }
//   }
  
//   async function fetchNewsData() {
//     try {
//       const res = await fetch('/api/news');
//       const news = await res.json();
  
//       const newsOutput = document.getElementById('news-output');
//       if (newsOutput) {
//         newsOutput.innerHTML = news.slice(0, 5).map(item => (
//           `<li><a href="${item.link}" target="_blank">${item.title}</a> - <em>${item.pubDate}</em></li>`
//         )).join('');
//       }
//     } catch (err) {
//       console.error('Failed to fetch news:', err);
//     }
//   }
  

// === Initialize the map ===
// const map = L.map('map-container').setView([9.0820, 8.6753], 6);

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     attribution: '&copy; OpenStreetMap contributors'
// }).addTo(map);

// let statesLayer;
// let highlightedLayer = null;

// === Load and render Nigerian states ===
fetch('/api/states')
    .then(res => res.json())
    .then(data => {
        statesLayer = L.geoJson(data, {
            style: {
                fillColor: '#6DA5C0',
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.7
            },
            onEachFeature: (feature, layer) => {
                const stateName = feature.properties.name;

                layer.bindPopup(`<b>${stateName}</b>`);

                layer.on({
                    click: () => {
                        highlightLayer(layer);
                        document.getElementById('info-panel').textContent = `Selected State: ${stateName}`;
                    },
                    mouseover: function () {
                        this.setStyle({
                            weight: 2,
                            color: '#666',
                            fillOpacity: 0.9
                        });
                    },
                    mouseout: function () {
                        if (this !== highlightedLayer) {
                            statesLayer.resetStyle(this);
                        }
                    }
                });
            }
        }).addTo(map);

        map.fitBounds(statesLayer.getBounds());
    });

// === Function to highlight a clicked or random state ===
function highlightLayer(layer) {
    if (highlightedLayer) {
        statesLayer.resetStyle(highlightedLayer);
    }

    highlightedLayer = layer;

    layer.setStyle({
        fillColor: '#FF5733',
        fillOpacity: 0.9,
        weight: 3,
        color: '#FF0000',
        dashArray: ''
    });

    layer.bringToFront();
}

// === Highlight a random state when button is clicked ===
function highlightRandomState() {
    if (!statesLayer) return;
    const layers = Object.values(statesLayer._layers);
    const random = layers[Math.floor(Math.random() * layers.length)];
    highlightLayer(random);
    map.fitBounds(random.getBounds(), { padding: [30, 30] });
    document.getElementById('info-panel').textContent = `Randomly highlighted: ${random.feature.properties.name}`;
}

document.getElementById('highlight-btn').addEventListener('click', highlightRandomState);

// === Fetch ACLED data and update UI ===
async function fetchACLEDData() {
    try {
        const res = await fetch('/api/acled');
        const data = await res.json();

        const output = document.getElementById('acled-output');
        if (!output) return;

        output.innerHTML = Object.entries(data).map(
            ([state, events]) =>
                `<li><strong>${state}</strong>: ${events.length} incidents</li>`
        ).join('');
    } catch (err) {
        console.error('Failed to fetch ACLED data:', err);
        const output = document.getElementById('acled-output');
        if (output) {
            output.innerHTML = '<li>Error loading incidents. Please check the server.</li>';
        }
    }
}

// === Fetch breaking news and update UI ===
async function fetchNewsData() {
    try {
      const res = await fetch('/api/news');
      const news = await res.json();
  
      const newsOutput = document.getElementById('news-output');
      if (!newsOutput) return;
  
      if (!Array.isArray(news) || news.length === 0) {
        newsOutput.innerHTML = '<li>No news headlines available at the moment.</li>';
        return;
      }
  
      // Sort by timestamp (descending)
      news.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
      newsOutput.innerHTML = news.slice(0, 10).map(item => `
        <li style="margin-bottom:12px;">
          <strong>${item.title}</strong><br>
          <a href="${item.link}" target="_blank">Read full article</a><br>
          <small>${item.timestamp} — ${item.source}</small><br>
          <p>${item.summary || ''}</p>
        </li>
      `).join('');
    } catch (err) {
      console.error('❌ Failed to fetch news:', err);
      const newsOutput = document.getElementById('news-output');
      if (newsOutput) {
        newsOutput.innerHTML = '<li>Error loading news. Please try again later.</li>';
      }
    }
  }
  
  // Initial load
  document.addEventListener('DOMContentLoaded', () => {
    fetchNewsData();
  });
