// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibmF0aGFuc3NvIiwiYSI6ImNtN2NhbzIzNzBtaDAyanE4MXpnaXB0cDkifQ.Ui8OXW77Ix88IZU3TNGDaA';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

// Add bike lane data sources when the map loads
map.on('load', () => {
    const bikeRoutes = [
        {
            id: 'boston_route',
            url: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...',
            layerId: 'bike-lanes-boston'
        },
        {
            id: 'cambridge_route',
            url: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
            layerId: 'bike-lanes-cambridge'
        }
    ];
  
    bikeRoutes.forEach(route => {
        map.addSource(route.id, { type: 'geojson', data: route.url });
        map.addLayer({
            id: route.layerId,
            type: 'line',
            source: route.id,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': 'green',
                'line-width': 3,
                'line-opacity': 0.4
            }
        });
    });
});

// Initialize SVG overlay for station markers
const svg = d3.select('#map').append('svg');

// Helper function to convert station coordinates to pixel positions
function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

// Use Promise.all to wait for both station data (JSON) and traffic data (CSV) to load
const stationUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

Promise.all([
    d3.json(stationUrl),
    d3.csv(trafficUrl)
]).then(([stationData, trafficData]) => {
    console.log('Loaded Station JSON Data:', stationData);
    console.log('Loaded Traffic CSV Data:', trafficData);
  
    // Extract the stations array from the JSON data
    let stations = stationData.data.stations;
    console.log('Stations Array:', stations);
  
    // Save traffic data (trips)
    const trips = trafficData;
  
    // Calculate departures and arrivals using d3.rollup()
    const departures = d3.rollup(
        trips,
        v => v.length,
        d => d.start_station_id
    );
  
    const arrivals = d3.rollup(
        trips,
        v => v.length,
        d => d.end_station_id
    );
  
    // Update each station object with traffic properties
    // (Using station.short_name as the identifier – adjust if needed)
    stations = stations.map(station => {
        let id = station.short_name;
        station.arrivals = arrivals.get(id) ?? 0;
        station.departures = departures.get(id) ?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
    console.log('Updated Stations with Traffic:', stations);
  
    // Create a square root scale for marker sizes based on total traffic
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(stations, d => d.totalTraffic)])
        .range([0, 25]);
  
    // Call function to update station markers on the map
    updateStations(stations, radiusScale);
}).catch(error => {
    console.error('Error loading data:', error);
});
  
// Function to append station markers and update their positions
function updateStations(stations, radiusScale) {
    // Bind station data to circle elements in the SVG overlay
    const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', d => radiusScale(d.totalTraffic))  // Size marker based on total traffic
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)

        .each(function(d) {
            // Add <title> for browser tooltips
            d3.select(this)
              .append('title')
              .text(d => d.name)
              .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
          });
  
    // Function to update circle positions based on the current map view
    function updatePositions() {
        circles
            .attr('cx', d => getCoords(d).cx)
            .attr('cy', d => getCoords(d).cy);
    }
  
    // Initial position update when the map loads
    updatePositions();
  
    // Update positions during map interactions
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
}
