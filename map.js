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

map.on('load', () => { 
    // Add bike lane data source
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    // Add a layer to visualize the bike lanes
    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route', // Match the source ID
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': 'green', // Change color to blue for better visibility
            'line-width': 3,
            'line-opacity': 0.4
        }
    });
});
