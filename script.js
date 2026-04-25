// Configuración de tu CouchDB Local
const DB_URL = "https://mortuary-shorthand-trilogy.ngrok-free.dev";
const USER = "admin";
const PASS = "admin1234";
const authHeader = "Basic " + btoa(USER + ":" + PASS);

// 2. INICIALIZAR EL MAPA (Centrado en Cáceres)
let mapa = L.map('mapa').setView([39.475, -6.372], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(mapa);

let capaRuta = L.layerGroup().addTo(mapa);
let capaMarcadores = L.layerGroup().addTo(mapa);

// 3. LA LÓGICA AL PULSAR EL BOTÓN
document.getElementById('btn-generar').addEventListener('click', async () => {
    const selectStr = document.getElementById('parking').value;
    const [lonStr, latStr] = selectStr.split(',');
    const parkingLon = parseFloat(lonStr);
    const parkingLat = parseFloat(latStr);

    // Limpiamos el mapa para la nueva ruta
    capaRuta.clearLayers();
    capaMarcadores.clearLayers();
    document.getElementById('lista-ruta').innerHTML = 'Buscando en la base de datos de tu amiga... ⏳';

    // Ponemos la chincheta del parking
    L.marker([parkingLat, parkingLon]).addTo(capaMarcadores)
      .bindPopup("<b>🚗 Tu Aparcamiento</b>").openPopup();

    try {
        // 4. PREPARAMOS LA CONSULTA ESPACIAL (Mango Query / Bounding Box)
        // Buscamos en un radio de aprox 1km
        const radio = 0.01; 
        const min_lon = parkingLon - radio;
        const max_lon = parkingLon + radio;
        const min_lat = parkingLat - radio;
        const max_lat = parkingLat + radio;
        
        const consultaMango = {
            "selector": {
                "geometry.coordinates.0": { "$gte": min_lon, "$lte": max_lon },
                "geometry.coordinates.1": { "$gte": min_lat, "$lte": max_lat }
            },
            "limit": 50
        };

        // 5. HACEMOS LA LLAMADA A COUCHDB (A través de Ngrok)
        const respuesta = await fetch(`${DB_URL}/_find`, {
            method: 'POST',
            headers: { 
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(consultaMango)
        });

        if (!respuesta.ok) throw new Error("Error de conexión con CouchDB. ¿Está encendido el Ngrok?");
        
        const datos = await respuesta.json();
        const monumentos = datos.docs; // Aquí están los JSON reales de la BD

        if(monumentos.length === 0) {
            document.getElementById('lista-ruta').innerHTML = '<li>No se han encontrado monumentos en esta zona en la Base de Datos.</li>';
            return;
        }

        // 6. ALGORITMO "VECINO MÁS CERCANO" PARA ORDENAR LA RUTA
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

        // 7. PINTAMOS EL RESULTADO
        pintarRuta(rutaOrdenada, parkingLat, parkingLon);

    } catch (error) {
        console.error(error);
        document.getElementById('lista-ruta').innerHTML = `<li style="color:red"><b>Error:</b> ${error.message} <br><br><i>(Dile a tu amiga que revise si el túnel Ngrok sigue abierto y si el CORS está en '*')</i></li>`;
    }
});

// Función auxiliar para dibujar la línea en el mapa
function pintarRuta(rutaOrdenada, parkingLat, parkingLon) {
    const lista = document.getElementById('lista-ruta');
    lista.innerHTML = ''; 
    const puntosRutaMapa = [[parkingLat, parkingLon]];

    rutaOrdenada.forEach((m) => {
        let lat = m.geometry.coordinates[1];
        let lon = m.geometry.coordinates[0];
        let nombre = m.nombre; // <-- Cogemos el nombre de vuestro JSON real

        lista.innerHTML += `<li><b>${nombre}</b></li>`;
        L.marker([lat, lon]).addTo(capaMarcadores).bindPopup(nombre);
        puntosRutaMapa.push([lat, lon]);
    });

    L.polyline(puntosRutaMapa, {color: 'red', weight: 4}).addTo(capaRuta);
    mapa.fitBounds(puntosRutaMapa);
}