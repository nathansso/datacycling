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
});

// Load station data
const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
d3.json(jsonurl).then(jsonData => {
    console.log('Loaded JSON Data:', jsonData);
    const stations = jsonData.data.stations;
    console.log('Stations Array:', stations);
    updateStations(stations);
}).catch(error => {
    console.error('Error loading JSON:', error);
});

// Initialize SVG overlay
const svg = d3.select('#map').append('svg');

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);
    const { x, y } = map.project(point);
    return { cx: x, cy: y };
}

function updateStations(stations) {
    const circles = svg.selectAll('circle')
        .data(stations)
        .enter()
        .append('circle')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .attr('stroke', 'white')
        .attr('stroke-width', 1)
        .attr('opacity', 0.8);

    function updatePositions() {
        circles
            .attr('cx', d => getCoords(d).cx)
            .attr('cy', d => getCoords(d).cy);
    }

    updatePositions();
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
    map.on('moveend', updatePositions);
}
