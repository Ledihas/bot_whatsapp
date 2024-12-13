import fetch from 'node-fetch';

// Interfaz para las coordenadas
interface Coordinates {
    lat: string;
    lon: string;
}

// Interfaz para la respuesta de Nominatim
interface NominatimResponse {
    lat: string;
    lon: string;
}

// Interfaz para la respuesta de OpenRouteService
interface OpenRouteServiceResponse {
    routes: Array<{
        summary: {
            length: number; // Longitud en metros
        };
    }>;
}

// Tu clave API de OpenRouteService
const ORS_API_KEY = '5b3ce3597851110001cf62485bbf2a848cdb4e8aa8159263fbbe2e41'; // Reemplaza con tu clave API

// Función para geocodificar una dirección
async function geocodeAddress(address: string): Promise<Coordinates | null> {
    const baseUrl = 'https://nominatim.openstreetmap.org/search';
    const params = new URLSearchParams({
        q: address,
        format: 'json',
        addressdetails: '1',
    });

    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Error en la solicitud: ${response.statusText}`);
        }

        const data = await response.json() as NominatimResponse[];
        if (data.length > 0) {
            return { lat: data[0].lat, lon: data[0].lon };
        } else {
            console.error("No se encontraron resultados para la dirección proporcionada.");
            return null;
        }
    } catch (error) {
        console.error("Error al geocodificar la dirección:", error);
        return null;
    }
}

// Función para obtener la distancia por carretera entre dos coordenadas
async function getDistanceByRoad(coord1: Coordinates, coord2: Coordinates): Promise<number | null> {
    const baseUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
    
    try {
        const response = await fetch(`${baseUrl}?start=${coord1.lon},${coord1.lat}&end=${coord2.lon},${coord2.lat}`, {
            headers: {
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error en la solicitud a OpenRouteService: ${response.statusText}`);
        }

        const data = await response.json() as OpenRouteServiceResponse;

        // Verificar si hay rutas en la respuesta
        if (data.routes && data.routes.length > 0) {
            return data.routes[0].summary.length / 1000; // Convertir metros a kilómetros
        } else {
            console.error("No se encontraron rutas entre los puntos proporcionados.");
            return null;
        }
    } catch (error) {
        console.error("Error al obtener la distancia por carretera:", error);
        return null;
    }
}

// Función principal para obtener coordenadas y calcular distancia
export async function getCoordinatesAndDistance(address1: string, address2: string): Promise<string> {
    const coord1 = await geocodeAddress(address1);
    const coord2 = await geocodeAddress(address2);

    if (coord1 && coord2) {
        const distance = await getDistanceByRoad(coord1, coord2);
        
        if (distance !== null) {
            console.log(`Coordenadas de "${address1}":`, coord1);
            console.log(`Coordenadas de "${address2}":`, coord2);
            console.log(`Distancia por carretera entre los dos puntos: ${distance.toFixed(2)} km`);
            const resp:string = `Distancia por carretera entre los dos puntos: ${distance.toFixed(2)} km` 
            return resp;
        } else {
            const str = "No se pudo calcular la distancia por carretera.";
            return str;
        }
    } else {
        
        return "No se pudieron obtener las coordenadas para una o ambas direcciones."
    }
}

export async function isValidAddressFormat(address: string): Promise<boolean> {
    // Expresión regular para validar el formato:
    // "calle, entreAVE1 - entreAVE2, municipio, provincia"
    const addressPattern = /^[^,]+,\s*[^-]+-\s*[^,]+,\s*[^,]+,\s*[^,]+$/;

    return addressPattern.test(address);
}

