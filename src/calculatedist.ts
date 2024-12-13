import axios from 'axios';

const WIT_ACCESS_TOKEN = 'I5V2NGQ75QN7FVXHL4GFDAJRG4QMB7AH'; //  token de acceso

export async function getDistance(origin: string, destination: string): Promise<number | null> {
    try {
        const response = await axios.get(`https://api.wit.ai/message`, {
            params: {
                q: `${origin} to ${destination}`,
                v: '20220901' // Usa la versión actual de la API
            },
            headers: {
                'Authorization': `Bearer ${WIT_ACCESS_TOKEN}`
            }
        });

        // Procesar la respuesta para extraer la distancia
        const entities = response.data.entities;
        if (entities && entities.distance && entities.distance[0]) {
            return parseFloat(entities.distance[0].value); // Devuelve la distancia en km
        } else {
            console.error('No se encontró información sobre la distancia');
            return null;
        }
    } catch (error) {
        console.error('Error al llamar a Wit.ai:', error);
        return null;
    }
}

export async function PrecioDistancia(distance:number):Promise<number | null> {
    // Cincuenta pesos por km
    const precio = distance * 50;
    return precio;
}
export async function PrecioPasajeros(pasajeros:number): Promise<number | null> {
    // Diez pesos por pasajero
    const precio = pasajeros * 10;
    return precio;
}
function parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
export async function PrecioTiempo(hora1:string, hora2:string): Promise<number | null> {
    let tiempo = parseTime(hora1) - parseTime(hora2);
    if(tiempo < 0) {
        tiempo += 24 * 60;
    }
    tiempo = tiempo / 60;
// Diez pesos por hora
    const precio = tiempo * 10;
    return Math.round(precio);
}