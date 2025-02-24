/* global mapboxgl, d3 */

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibmF0aGFuc3NvIiwiYSI6ImNtN2NhbzIzNzBtaDAyanE4MXpnaXB0cDkifQ.Ui8OXW77Ix88IZU3TNGDaA';

// Global helper function to format time in HH:MM AM/PM
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes based on minutes since midnight
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

// Global helper function to compute station traffic based on trips
function computeStationTraffic(stations, trips) {
  // Compute departures using d3.rollup()
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );
  // Compute arrivals using d3.rollup()
  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );
  // Update each station with calculated traffic values
  return stations.map((station) => {
    let id = station.short_name;
    station.departures = departures.get(id) ?? 0;
    station.arrivals = arrivals.get(id) ?? 0;
    station.totalTraffic = station.departures + station.arrivals;
    return station;
  });
}

// Global helper function to compute minutes since midnight for a given Date
function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// Function to filter trips based on the selected time filter
function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1 
    ? trips // If no filter is applied (-1), return all trips
    : trips.filter((trip) => {
        // Convert trip start and end times to minutes since midnight
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        // Include trips that started or ended within 60 minutes of the selected time
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
    });
}

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

map.on('load', async () => {
  // Add bike lane data sources
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

  // Select UI elements for the time filter
  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  // Data URLs
  const stationUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const trafficUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

  // Load station JSON data and traffic CSV data (with date parsing)
  const [stationData, trips] = await Promise.all([
    d3.json(stationUrl),
    d3.csv(trafficUrl, (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    })
  ]);

  console.log('Loaded Station JSON Data:', stationData);
  console.log('Loaded Traffic CSV Data:', trips);

  // Extract stations from the JSON data (adjust the property access as needed)
  let stations = stationData.data.stations;

  // Compute station traffic using the full set of trips
  stations = computeStationTraffic(stations, trips);
  console.log('Updated Stations with Traffic:', stations);

  // Create a square root scale for marker sizes based on total traffic
  const radiusScale = d3.scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]); // Default range when no filtering is applied

  // Initialize SVG overlay for station markers
  const svg = d3.select('#map').append('svg');

  // Create a quantize scale for station flow:
  // Maps a continuous ratio [0, 1] to discrete values: 0, 0.5, and 1.
  let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  // Define a variable to hold the circle selection so that it can be updated later
  let circles;

  // Helper function to convert station coordinates to pixel positions
  function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
  }

  // Function to update station markers on the map (visualization logic)
  function updateStations(stations, radiusScale) {
    circles = svg.selectAll('circle')
      .data(stations, (d) => d.short_name) // Use station short_name as the key
      .join('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      // Instead of directly setting fill here, we assign the departure ratio as a CSS variable.
      .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic))
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .each(function(d) {
        // Add a <title> for browser tooltips
        d3.select(this)
          .append('title')
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });

    // Update circle positions based on the current map view
    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)
        .attr('cy', d => getCoords(d).cy);
    }

    // Initial update and subsequent updates during map interactions
    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
  }

  // Initially render station markers using all trips
  updateStations(stations, radiusScale);

  // Function to update the scatterplot (filtering logic separated from visualization)
  function updateScatterPlot(timeFilter) {
    // Dynamically adjust the circle size scale range based on filtering
    timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
    
    // Get only the trips that match the selected time filter
    const filteredTrips = filterTripsbyTime(trips, timeFilter);
    
    // Recompute station traffic based on the filtered trips
    const filteredStations = computeStationTraffic(stations, filteredTrips);
    
    // Update the scatterplot by adjusting the radius and CSS variable of circles
    circles = circles
      .data(filteredStations, (d) => d.short_name) // Ensure D3 tracks elements correctly
      .join('circle')
      .attr('r', d => radiusScale(d.totalTraffic))
      // Update the departure ratio used for color
      .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic))
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8);
  }

  // Function to update the time display and filter data based on the slider's value
  function updateTimeDisplay() {
    let timeFilter = Number(timeSlider.value); // Get slider value (minutes since midnight)

    if (timeFilter === -1) {
      selectedTime.textContent = '';          // Clear time display
      anyTimeLabel.style.display = 'block';     // Show "(any time)"
    } else {
      selectedTime.textContent = formatTime(timeFilter); // Display formatted time
      anyTimeLabel.style.display = 'none';      // Hide "(any time)"
    }
    
    // Call updateScatterPlot to reflect the changes on the map
    updateScatterPlot(timeFilter);
  }

  // Bind the slider's input event to updateTimeDisplay so it updates in real-time
  timeSlider.addEventListener('input', updateTimeDisplay);
  // Initial call to set the display correctly
  updateTimeDisplay();
});
