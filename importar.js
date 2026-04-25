const nano = require('nano')('http://admin:admin1234@127.0.0.1:5984');
const db = nano.db.use('monumentos_app');
const monumentos = require('./monumentos.json');
const parkings = require('./aparcamientos.json');

async function subirTodo() {
    // Combinamos ambos arrays
    const todos = [...monumentos, ...aparcamientos];
    await db.bulk({ docs: todos });
    console.log("¡Datos subidos!");
}
subirTodo();