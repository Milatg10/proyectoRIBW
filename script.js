// Configuración de tu CouchDB Local
const DB_URL = "https://mortuary-shorthand-trilogy.ngrok-free.dev";
const USER = "admin";
const PASS = "admin1234";
// Creamos la cabecera de autenticación Básica (Base64)
const authHeader = "Basic " + btoa(USER + ":" + PASS);

// Inicializar el mapa centrado en Cáceres
let mapa = L.map('mapa').setView([39.475, -6.372], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(mapa);

// Variables para guardar las capas del mapa (líneas y chinchetas) y borrarlas al recalcular
let capaRuta = L.layerGroup().addTo(mapa);
let capaMarcadores = L.layerGroup().addTo(mapa);

document.getElementById('btn-generar').addEventListener('click', async () => {
    const selectStr = document.getElementById('parking').value;
    const [lonStr, latStr] = selectStr.split(',');
    const parkingLon = parseFloat(lonStr);
    const parkingLat = parseFloat(latStr);

    capaRuta.clearLayers();
    capaMarcadores.clearLayers();
    
    L.marker([parkingLat, parkingLon]).addTo(capaMarcadores)
      .bindPopup("<b>🚗 Tu Aparcamiento</b>").openPopup();

    // =========================================================
    // MODO PRUEBA: Datos simulados sin conectar a CouchDB
    // =========================================================
    const monumentos = [
        { geometry: { coordinates: [-6.370, 39.474] }, value: "Torre de Bujaco" },
        { geometry: { coordinates: [-6.371, 39.474] }, value: "Concatedral" },
        { geometry: { coordinates: [-6.373, 39.473] }, value: "Iglesia de San Mateo" }
    ];

    // Lógica del "Vecino Más Cercano"
    let rutaOrdenada = [];
    let puntoActual = { lat: parkingLat, lon: parkingLon };
    let pendientes = [...monumentos];

    while(pendientes.length > 0) {
        let indexMasCercano = 0;
        let distanciaMinima = Infinity;

        for(let i=0; i < pendientes.length; i++) {
            let mLat = pendientes[i].geometry.coordinates[1];
            let mLon = pendientes[i].geometry.coordinates[0];
            
            let dist = Math.pow(mLat - puntoActual.lat, 2) + Math.pow(mLon - puntoActual.lon, 2);
            if(dist < distanciaMinima) {
                distanciaMinima = dist;
                indexMasCercano = i;
            }
        }

        let siguientePunto = pendientes.splice(indexMasCercano, 1)[0];
        rutaOrdenada.push(siguientePunto);
        puntoActual = {
            lat: siguientePunto.geometry.coordinates[1], 
            lon: siguientePunto.geometry.coordinates[0]
        };
    }

    // Pintamos la ruta en el mapa
    pintarRuta(rutaOrdenada, parkingLat, parkingLon);
});

function pintarRuta(rutaOrdenada, parkingLat, parkingLon) {
    const lista = document.getElementById('lista-ruta');
    lista.innerHTML = ''; // Limpiar
    
    // Preparar puntos para la línea del mapa (empezando en el parking)
    const puntosRutaMapa = [[parkingLat, parkingLon]];

    rutaOrdenada.forEach((m) => {
        let lat = m.geometry.coordinates[1];
        let lon = m.geometry.coordinates[0];
        let nombre = m.value; // Lo que configuramos en el 'emit' del Design Document

        // Añadir a la lista HTML
        lista.innerHTML += `<li><b>${nombre}</b></li>`;

        // Añadir chincheta al mapa
        L.marker([lat, lon]).addTo(capaMarcadores).bindPopup(nombre);
        
        // Añadir a la línea
        puntosRutaMapa.push([lat, lon]);
    });

    // Dibujar la línea roja conectando los puntos
    L.polyline(puntosRutaMapa, {color: 'red', weight: 4}).addTo(capaRuta);
    
    // Ajustar el zoom del mapa para que se vea toda la ruta
    mapa.fitBounds(puntosRutaMapa);
}