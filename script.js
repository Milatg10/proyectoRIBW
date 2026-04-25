// Configuración de tu CouchDB Local
const DB_URL = "http://127.0.0.1:5984/monumentos_app";
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

    // 1. Limpiar el mapa y la lista antes de generar la nueva ruta
    capaRuta.clearLayers();
    capaMarcadores.clearLayers();
    document.getElementById('lista-ruta').innerHTML = 'Calculando ruta óptima...';

    // Añadir el marcador del parking
    L.marker([parkingLat, parkingLon]).addTo(capaMarcadores)
      .bindPopup("<b>🚗 Tu Aparcamiento</b>").openPopup();

    try {
        // Buscamos en un radio de aprox 1km alrededor del parking (+- 0.01 grados)
        // 2. Definir el Bounding Box (bbox)
        const radio = 0.01; 
        const min_lon = parkingLon - radio;
        const max_lon = parkingLon + radio;
        const min_lat = parkingLat - radio;
        const max_lat = parkingLat + radio;
        
        // 3. Petición POST a CouchDB nativo (Mango Query)
        // Sustituye a GeoCouch buscando qué coordenadas entran en la caja
        const consultaMango = {
            "selector": {
                "geometry.coordinates.0": { "$gte": min_lon, "$lte": max_lon },
                "geometry.coordinates.1": { "$gte": min_lat, "$lte": max_lat }
            },
            "limit": 50 // Límite de monumentos a devolver
        };

        const respuesta = await fetch(`${DB_URL}/_find`, {
            method: 'POST',
            headers: { 
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(consultaMango)
        });

        if (!respuesta.ok) throw new Error("Error conectando con CouchDB");
        
        const datosGeo = await respuesta.json();
        // OJO: CouchDB devuelve 'docs', no 'rows' como hacía GeoCouch
        const monumentos = datosGeo.docs;

        // 4. LÓGICA DE NEGOCIO: Algoritmo "Vecino Más Cercano"
        // Ordenamos los monumentos devueltos por GeoCouch para hacer una ruta lógica
        let rutaOrdenada = [];
        let puntoActual = { lat: parkingLat, lon: parkingLon };
        let pendientes = [...monumentos];

        while(pendientes.length > 0) {
            // Buscar el más cercano al punto actual
            let indexMasCercano = 0;
            let distanciaMinima = Infinity;

            for(let i=0; i < pendientes.length; i++) {
                // GeoCouch devuelve [lon, lat]
                let mLat = pendientes[i].geometry.coordinates[1];
                let mLon = pendientes[i].geometry.coordinates[0];
                
                // Calculo de distancia básica (Pitágoras es suficiente para distancias tan cortas)
                let dist = Math.pow(mLat - puntoActual.lat, 2) + Math.pow(mLon - puntoActual.lon, 2);
                if(dist < distanciaMinima) {
                    distanciaMinima = dist;
                    indexMasCercano = i;
                }
            }

            // Añadir el ganador a la ruta y quitarlo de pendientes
            let siguientePunto = pendientes.splice(indexMasCercano, 1)[0];
            rutaOrdenada.push(siguientePunto);
            // Actualizar mi posición
            puntoActual = {
                lat: siguientePunto.geometry.coordinates[1], 
                lon: siguientePunto.geometry.coordinates[0]
            };
        }

        // 5. PINTAR RESULTADOS EN LA INTERFAZ
        pintarRuta(rutaOrdenada, parkingLat, parkingLon);

    } catch (error) {
        console.error(error);
        document.getElementById('lista-ruta').innerHTML = '<li style="color:red">Error: Asegúrate de que CouchDB está encendido y el CORS habilitado.</li>';
    }
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