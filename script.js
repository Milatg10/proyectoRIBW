// Configuración de tu CouchDB Local
const DB_URL = "https://all-rats-enjoy.loca.lt/monumentos_app"; // ✅ BIEN
const authHeader = "Basic " + btoa("admin:admin1234");

let mapa = L.map('mapa').setView([39.475, -6.372], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
let capaRuta = L.layerGroup().addTo(mapa);
let capaMarcadores = L.layerGroup().addTo(mapa);

// --- FUNCIÓN PARA CARGAR LOS PARKINGS AL INICIO ---
async function cargarParkings() {
    try {
        const query = {
            "selector": { "_id": { "$regex": "^aparcamientos" } }
        };
        const res = await fetch(`${DB_URL}/_find`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json'}, 
            body: JSON.stringify(query)
        });
        const data = await res.json();
        const select = document.getElementById('parking');
        select.innerHTML = ""; // Limpiamos el HTML estático

        data.docs.forEach(p => {
            const opt = document.createElement('option');
            // Usamos las coordenadas WGS84 que vienen en tus propiedades
            opt.value = `${p.properties.wgs84_x},${p.properties.wgs84_y}`;
            opt.textContent = p.properties.etiqueta || p.properties.denominaci;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Error cargando parkings:", e); }
}

// Ejecutamos la carga inicial
cargarParkings();

// --- LÓGICA DE BÚSQUEDA DE MONUMENTOS ---
document.getElementById('btn-generar').addEventListener('click', async () => {
    const [lon, lat] = document.getElementById('parking').value.split(',').map(parseFloat);
    
    capaRuta.clearLayers();
    capaMarcadores.clearLayers();
    L.marker([lat, lon]).addTo(capaMarcadores).bindPopup("<b>Parking Seleccionado</b>").openPopup();

    try {
        // Consulta Mango: Buscamos monumentos en un radio cuadrado (Bounding Box)
        const radio = 0.01;
        const query = {
            "selector": {
                "_id": { "$regex": "^toponimia_monumentos" },
                "geometry.coordinates.0": { "$gte": lon - radio, "$lte": lon + radio },
                "geometry.coordinates.1": { "$gte": lat - radio, "$lte": lat + radio }
            }
        };

        const res = await fetch(`${DB_URL}/_find`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json'}, 
            body: JSON.stringify(query)
        });
        const data = await res.json();
        const monumentos = data.docs;

        if (monumentos.length === 0) {
            document.getElementById('lista-ruta').innerHTML = "<li>No hay monumentos cerca en la BD.</li>";
            return;
        }

        // Dibujar en el mapa y lista
        const lista = document.getElementById('lista-ruta');
        lista.innerHTML = "";
        const puntosRuta = [[lat, lon]];

        monumentos.forEach(m => {
            const mLat = m.geometry.coordinates[1];
            const mLon = m.geometry.coordinates[0];
            const nombre = m.properties.nombre;

            lista.innerHTML += `<li><b>${m.properties.clase}</b>: ${nombre}</li>`;
            L.marker([mLat, mLon]).addTo(capaMarcadores).bindPopup(nombre);
            puntosRuta.push([mLat, mLon]);
        });

        L.polyline(puntosRuta, {color: 'red'}).addTo(capaRuta);
        mapa.fitBounds(puntosRuta);

    } catch (e) { alert("Error al conectar con CouchDB"); }
});