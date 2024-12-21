import { join } from 'path';
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot';
import { MemoryDB as Database } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { isValidAddressFormat,getCoordinatesAndDistance } from './mapas';
import { format, isValid } from 'date-fns';
import { PrecioDistancia, PrecioPasajeros, PrecioTiempo } from './calculatedist';
import axios from 'axios'; 
import { debounce } from './debounce';
import { TFlow } from "@builderbot/bot/dist/types";


const PORT = process.env.PORT ?? 3009;
const userSessions = {}; // Objetos para almacenar sessiones del usuario





// Función para generar fechas
function generateNextWeekDates(): string[] {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + i);
        const day = String(nextDate.getDate()).padStart(2, '0');
        const month = String(nextDate.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexed
        const formattedDate = `${day}/${month}`;
        dates.push(formattedDate);
    }
    return dates;
}

// Función para obtener distancia usando Wit ai
async function getDistance(origin: string, destination: string): Promise<any[] | null> {
    try{
        const url = `https://api-distancias-habana.onrender.com/enviar?string1=${origin}&string2=${destination}`
        const response = await axios.get(url);
        if(response.status === 200){
            console.log(response.data);
            return [response.data.distancia, response.data.coordenadas1, response.data.coordenadas2];
        } else {
            console.error('Error en la respuesta:', response.status);
            return [null, null, null];
        }
    } 
        catch(error)
    {
        console.error('Error al obtener la distancia:', error);
        return [null, null, null];
    }
}
async function getNewDistance(coor1: number[], coor2: number[], destination: string) {
    try {
        if (!coor1 || !coor2 || !destination) {
            console.error('Faltan parámetros necesarios');
            return null;
        }

        // Convertir coordenadas a formato string
        const string1 = `${coor1[0]},${coor1[1]}`;
        const string2 = `${coor2[0]},${coor2[1]}`;

        const url = `https://api-distancias-habana.onrender.com/desviacion?string1=${string1}&string2=${string2}&string3=${encodeURIComponent(destination)}`;
        
        console.log('URL de la petición:', url);
        
        const response = await axios.get(url);
        
        if (response.status === 200) {
            return response.data.distancia;
        } else {
            console.error('Error en la respuesta:', response.status, response.data);
            return null;
        }
    } catch (error) {
        console.error('Error al obtener la distancia:', error);
        return null;
    }
}


// Función para generar horas en formato de 24 horas
function generateNextHours(): string[] {
    const hoursSet = new Set<string>(); // Usar un Set para evitar duplicados
    const randomHours = [];
    while (randomHours.length < 5) { // Generar hasta 5 horas aleatorias
        const hour = Math.floor(Math.random() * 24); // Genera una hora aleatoria entre 0 y 23
        const minute = Math.random() < 0.5 ? '00' : '30'; // Elige entre "00" y "30" minutos
        const formattedHour = `${String(hour).padStart(2, '0')}:${minute}`; // Formato HH:MM
        hoursSet.add(formattedHour); // Agrega la hora al Set
        if (hoursSet.size <= 5) { // Asegúrate de no exceder 5 horas únicas
            randomHours.push(formattedHour);
        }
    }
    return randomHours;
}


// Flujo para seleccionar la hora de recogida
const hours = generateNextHours(); 
const timeFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer(`¿A qué hora desea usted ser recogido? \n Escibalo de la manera que se muestra, o seleccine la conveniente:\n\n ` + 
               hours.map((time, index) => `${index + 1}. ${time} ⏰`).join('\n'), 
               { delay: 800, capture: true }, async (ctx, ctxfn) => {
        const userId = ctx.from;
        const userInput = ctx.body; // Captura la respuesta del usuario
        const str: string = userInput.toString(); // Convierte a string para validación

        try {
            // Verifica si la entrada es un formato válido de hora
            if (isValidTimeFormat(str)) {
                userSessions[userId].horaRecogida = str; // Almacena la hora de recogida en la variable global
                await ctxfn.flowDynamic(`Hora de recogida: ${str}. ¡Allí estaremos!`);
                
                //await ctxfn.gotoFlow(time2Flow);
            } else {
                const selection = parseInt(userInput); // Intenta convertir a número

                // Validar si la selección está dentro del rango permitido

                if (!isNaN(selection) && selection >= 1 && selection <= hours.length) {
                    userSessions[userId].horaRecogida = hours[selection - 1]; // Convertir selección a hora y almacenar en la variable global
                    await ctxfn.flowDynamic(`Hora de recogida: ${userSessions[userId].horaRecogida}. ¡Allí estaremos!`);
                   
                } else {
                    await ctxfn.flowDynamic("Selección no válida. Por favor, intente nuevamente.");
                    await ctxfn.gotoFlow(timeFlow);
                }
            }
        } catch (error) {
            console.error(error);
            await ctxfn.flowDynamic("Lo siento, hubo un error. Por favor, intenta nuevamente.");
        }
    })
    .addAnswer("¿Realizará viaje de regreso?",{ delay: 800, capture: true }, async (ctx, ctxfn) => {
     
        const user_Input = ctx.body;
        const input: string = user_Input.toString();
        if (input == 'si' || input === "Si" || input === "SI" || input === "sI" || input === "S" || input === "s" || input === "Sí" || input == "sí" || input == "Sip") {
                await ctxfn.gotoFlow(time2Flow);
        } 
        else if (input === "no" || input === "No" || input === "NO" || input === "nO" || input === "N" || input === "n" || input === "No" || input == "no" || input == "Nop")
        {
            await ctxfn.gotoFlow(zoneFlow);
        }
        else
        {
            await ctxfn.flowDynamic("No dijo que si,❄️ así que lo tomo como un no, sigamos.")
            await ctxfn.gotoFlow(zoneFlow);

        }
    });

    const hours2 = generateNextHours();

// Flujo para la hora de regreso
const time2Flow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer(`¿A qué hora desea usted ser recogido de vuelta? \n seleccione o escríbala:\n\n ` + 
               hours2.map((time, index) => `${index + 1}. ${time} ⏰`).join('\n'), 
               { delay: 800, capture: true }, async (ctx, ctxfn) => {
        const userId = ctx.from;
        const userInput = ctx.body; // Captura la respuesta del usuario
        const str: string = userInput.toString(); // Convierte a string para validación

        try {
            // Verifica si la entrada es un formato válido de hora
            if (isValidTimeFormat(str)) {
                userSessions[userId].horaRegreso = str; // Almacena la hora de regreso
                await ctxfn.flowDynamic(`Perfecto, le recogeremos a las ${str} de vuelta. ✅`);
               
                await ctxfn.gotoFlow(zoneFlow);
            } else {
                const selection = parseInt(userInput); // Intenta convertir a número

                 // Validar si la selección está dentro del rango permitido

                if (!isNaN(selection) && selection >= 1 && selection <= hours2.length) {
                    userSessions[userId].horaRegreso = hours2[selection - 1]; // Convertir selección a hora y almacenar en la variable global
                    await ctxfn.flowDynamic(`Perfecto, le recogeremos a las ${userSessions[userId].horaRegreso} de vuelta. ✅`);
                    userSessions[userId].costoViaje = 0.0;
                    userSessions[userId].costoViaje += await PrecioTiempo(userSessions[userId].horaRecogida, userSessions[userId].horaRegreso); 
                    await ctxfn.flowDynamic(`💲El costo de su servicio seria aproximadamente: 💲${userSessions[userId].costoViaje} cup.`);
                    await ctxfn.gotoFlow(zoneFlow);
                } else {
                    await ctxfn.flowDynamic("Selección no válida. Por favor, intente nuevamente.");
                    await ctxfn.gotoFlow(time2Flow);
                }
            }
        } catch (error) {
            console.error(error);
            await ctxfn.flowDynamic("Lo siento, hubo un error. Por favor, intenta nuevamente.");
        }
    });

// Flujo para seleccionar la dirección de recogida
const zoneFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("Ahora dígame desde dónde comenzará el viaje.🗺️")
    .addAnswer("Ejemplo:\n\n `calle, entreAVE1 - enreAVE2, *LOCALIDAD*, municipio  ` ", 
        { delay: 800, capture: true }, 
        async (ctx, ctxfn) => {
            const userId = ctx.from;
            userSessions[userId] = userSessions[userId] || {};
            userSessions[userId].recogida = ctx.body;
            
            if (isValidAddressFormat(userSessions[userId].recogida)) {
                await ctxfn.flowDynamic("¡Ok!.");
                await ctxfn.gotoFlow(destinationFlow);
            } else {
                await ctxfn.flowDynamic("😢Parece que has insertado mal la dirección. Intentémoslo de nuevo.");
                await ctxfn.gotoFlow(zoneFlow);
            }
    });

// Flujo para capturar el destino y calcular distancia
const destinationFlow = addKeyword<Provider, Database>(['borscht'])
.addAnswer("Por favor, inserte su destino.📍", 
    { delay: 800, capture: true }, 
    async (ctx, ctxfn) => {
        const userId = ctx.from;
        userSessions[userId].llegada = ctx.body;
        await ctxfn.flowDynamic("💡Buscando ruta, por favor espere...");
        
        if(!userSessions[userId].distance) {
            const [distance, coord1, coord2] = await getDistance(
                userSessions[userId].recogida, 
                userSessions[userId].llegada
            );
            
            if (distance !== null && distance !== 0 && distance !== undefined && !Number.isNaN(distance)) {
                userSessions[userId].distance = distance;
                userSessions[userId].coordenadas1 = coord1;
                userSessions[userId].coordenadas2 = coord2;
                userSessions[userId].costoViaje += await PrecioDistancia(distance)
                await ctxfn.flowDynamic(
                    `💲El costo de su servicio seria aproximadamente: 💲${userSessions[userId].costoViaje} cup.`
                );
                await ctxfn.gotoFlow(desvioQuestionFlow);
            } else {
                await ctxfn.flowDynamic("😢Lo siento, no pude calcular la ruta. Intenta nuevamente. \nNo olvide mencionar la localidad.");
                await ctxfn.gotoFlow(zoneFlow);
            }
        }
    });
const desvioQuestionFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("¿Realizará paradas?", {delay: 800,capture: true }, async (ctx,ctxfn) => {
        const val = ctx.body;
        if (val === "si" || val === "Si" || val === "SI" || val === "sI" || val === "S" || val === "s" || val === "Sí" || val == "sí" || val == "Sip") {
            await ctxfn.gotoFlow(newDistanceFlow);  
        }else if (val === "no" || val === "No" || val === "NO" || val === "nO" || val === "N" || val === "n" || val === "No" || val == "no" || val == "Nop") {
            
            await ctxfn.flowDynamic("Perfecto, sin desvío.");
            await ctxfn.gotoFlow(pasajerosFlow);
        } else {
            await ctxfn.flowDynamic("Lo siento, no entendí di Si o No");
            await ctxfn.gotoFlow(noDesvioFlow);
        }

    });

const noDesvioFlow = addKeyword<Provider, Database>(['jidskjl'])
.addAnswer("¿Realizará paradas?", {delay: 800,capture: true }, async (ctx,ctxfn) => {
    const val = ctx.body;
    if (val === "si" || val === "Si" || val === "SI" || val === "sI" || val === "S" || val === "s" || val === "Sí" || val == "sí" || val == "Sip") {
        await ctxfn.gotoFlow(newDistanceFlow);  
    } else if (val === "no" || val === "No" || val === "NO" || val === "nO" || val === "N" || val === "n" || val === "No" || val == "no" || val == "Nop") {
        
        await ctxfn.flowDynamic("Perfecto, sin desvío.");
        await ctxfn.gotoFlow(pasajerosFlow);
    } else {
        await ctxfn.flowDynamic("⚠️Lo siento, no entendí di Si o No");
        await ctxfn.gotoFlow(noDesvioFlow);
    }


});
    
// Flujo para seleccionar la fecha
const dateFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("💡Por favor, seleccione el día, escribalo, o 'Hoy'.:\n" + 
               generateNextWeekDates().map((date, index) => `${index + 1}. ${date} 🌞`).join('\n'), 
               { delay: 800, capture: true }, async (ctx, ctxfn) => {
        const userId = ctx.from;
        const userInput = ctx.body;
        const dates = generateNextWeekDates();
        
        // Función para validar el formato de fecha dd/mm
        const isValidDateFormat = (input: string): boolean => {
            const dateRegex = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])$/;
            if (!dateRegex.test(input)) return false;
            
            // Verificar si la fecha está en el array de fechas válidas
            return dates.includes(input);
        };

        if(userInput === "hoy" || userInput === "Hoy" || userInput === "HOY" || userInput === "H" || userInput === "h"){
            userSessions[userId].fecha = dates[0];
           
            await ctxfn.gotoFlow(timeFlow);
            return;
        }

        const selection = parseInt(userInput);
        
        if (selection >= 1 && selection <= dates.length) {
            userSessions[userId].fecha = dates[selection - 1];
            
            await ctxfn.gotoFlow(timeFlow);
            return;
        } 
        
        if (isValidDateFormat(userInput)) {
            userSessions[userId].fecha = userInput;
            await ctxfn.gotoFlow(timeFlow);
            return;
        }
        
        await ctxfn.flowDynamic("😢Selección no válida. Por favor, seleccione un número de la lista o escriba la fecha en formato dd/mm"); 
        await ctxfn.gotoFlow(dateFlow);
    });


// Flujo para calcular distancia del viaje y mostrar
const newDistanceFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("Dígame el destino de su desvío",
    {delay:800,capture: true},
    async (ctx, ctxfn) => {
        const userId = ctx.from;
        try {
            userSessions[userId].newDestination = ctx.body;
            await ctxfn.flowDynamic(`Calculando viaje...🚀`);
            
            userSessions[userId].distanceDesvio = await getNewDistance(
                userSessions[userId].coordenadas1,
                userSessions[userId].coordenadas2, 
                userSessions[userId].newDestination
            );

            const distance2 = userSessions[userId].distanceDesvio;

            if(distance2 === null || distance2 === undefined || distance2 === 0) {
                await ctxfn.flowDynamic("Parece que hubo un error.😢");
                await ctxfn.gotoFlow(newDistanceFlow);
            } else {
                userSessions[userId].costoViaje += await PrecioDistancia(distance2)
                await ctxfn.flowDynamic(`Se le sumará a su viaje 💲${userSessions[userId].costoViaje} cup por la nueva parada.`);
                await ctxfn.gotoFlow(newDistanceFlow2);
            }
        } catch (error) {
            console.error("Error en newDistanceFlow:", error);
            await ctxfn.flowDynamic("Ocurrió un error al calcular la distancia.😢 Intente nuevamente.");
            await ctxfn.gotoFlow(newDistanceFlow);
        }
    });
const newDistanceFlow2 = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("¿Hará otra parada?", {delay: 800,capture: true }, async (ctx,ctxfn) => {
        try {
            if(ctx.body === "si" || ctx.body === "Si" || ctx.body === "SI" || ctx.body === "sI" || ctx.body === "S" || ctx.body === "s" || ctx.body === "Sí" || ctx.body == "sí" || ctx.body == "Sip") {
                await ctxfn.gotoFlow(nuevaParadaFlow);
                return;
            } else if(ctx.body === "no" || ctx.body === "No" || ctx.body === "NO" || ctx.body === "nO" || ctx.body === "N" || ctx.body === "n" || ctx.body === "No" || ctx.body == "no" || ctx.body == "Nop") {
                await ctxfn.gotoFlow(pasajerosFlow);
                return;
            } else {
                await ctxfn.flowDynamic("⚠️Lo siento, no entendí di Si o No");
                await ctxfn.gotoFlow(newDistanceFlow2);
                return;
            }
        } catch (error) {
            console.error("Error en newDistanceFlow2:", error);
            await ctxfn.flowDynamic("😢Ocurrió un error al procesar su respuesta. Intente nuevamente.");
            await ctxfn.gotoFlow(newDistanceFlow2);
        }
    });

const nuevaParadaFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("Dígame la nueva parada", {delay: 800,capture: true }, async (ctx,ctxfn) => {
        const userId = ctx.from;
        try {
            userSessions[userId].newDestination = ctx.body;
            const [distance, coord1, coord2] = await getDistance(
                userSessions[userId].newDestination, 
                userSessions[userId].llegada
            );

            if(distance !== null && distance !== 0 && distance !== undefined) {
                userSessions[userId].coordenadas1 = coord1;
                userSessions[userId].distanceDesvio += distance;
                userSessions[userId].costoViaje += await PrecioDistancia(userSessions[userId].distanceDesvio);
                await ctxfn.flowDynamic(`Se le sumará a su viaje 💲${userSessions[userId].costoViaje} cup por la nueva parada.`);
                await ctxfn.gotoFlow(newDistanceFlow2);
            } else {
                await ctxfn.flowDynamic("⚠️No pude encontrar esa ubicación. Por favor, intente nuevamente.");
                await ctxfn.gotoFlow(newDistanceFlow2);
            }
        } catch (error) {
            console.error("Error en nuevaParadaFlow:", error);
            await ctxfn.flowDynamic("😢Ocurrió un error al procesar la nueva parada. Intente nuevamente.");
            await ctxfn.gotoFlow(newDistanceFlow2);
        }
    });

const isValidPassengerCount = (input) => {
    const num = parseInt(input);
    return !isNaN(num) && num > 0; 
};


const pasajerosFlow = addKeyword<Provider,Database>(['borscht'])
    .addAnswer("Ahora necesito saber cuántos pasajeros llevará #",
        {delay:800,capture: true},
        async (ctx, ctxfn) => {
            const userId = ctx.from;
            const input = ctx.body;
            try {
                if (!isValidPassengerCount(input)) {
                    await ctxfn.flowDynamic("⚠️Por favor, ingrese solo un número válido.");
                    return ctxfn.gotoFlow(pasajerosFlow);
                }
                
                userSessions[userId].cantidad_Pasajeros = parseInt(input);
                await ctxfn.flowDynamic(`Se le sumará a su viaje 💲${await PrecioPasajeros(userSessions[userId].cantidad_Pasajeros)} cup por los ${userSessions[userId].cantidad_Pasajeros} pasajeros.`);
                userSessions[userId].costoViaje += await PrecioPasajeros(userSessions[userId].cantidad_Pasajeros);
                await ctxfn.gotoFlow(descripcionFlow);
            } catch (error) {
                console.error("Error en pasajerosFlow:", error);
                await ctxfn.flowDynamic("Ocurrió un error al procesar la cantidad de pasajeros. Intente nuevamente.");
                await ctxfn.gotoFlow(pasajerosFlow);
            }
        });
const descripcionFlow = addKeyword<Provider,Database>(['borscht'])
    .addAnswer('Por último aclare en un sms; \n¿qué animales llevará?, \n¿habrán niños de menos de 3 años?, \n¿equipaje?,\n o cualquier punto que quiera aclarar', {delay:800,capture: true},
        async (ctx, ctxfn) => {
            const userId = ctx.from;
            const user_Input = ctx.body;
            try {
                userSessions[userId].descripcionAdicional = user_Input;
                
                if(userSessions[userId].descripcionAdicional) {
                    await ctxfn.flowDynamic(`Perfecto🎉, recuerde que los animales y el peso del equipaje le suman al costo. Hasta ahora es de $${userSessions[userId].costoViaje}.`);
                    
                    const message = `🌈Información del usuario:\n` +
                                    `Número: ${userId}\n`+
                                    `Veiculo: ${userSessions[userId].tipoVehiculo}\n`+
                                    `Fecha de recogida: ${userSessions[userId].fecha}\n`+
                                    `📍Salida: ${userSessions[userId].recogida}\n` +
                                    `📍Destino: ${userSessions[userId].llegada}\n` +
                                    `⏰Hora de Salida: ${userSessions[userId].horaRecogida}\n` +
                                    `⏰Hora de Regreso: ${userSessions[userId].horaRegreso}\n` +
                                    `Cantidad de pasajeros: ${userSessions[userId].cantidad_Pasajeros}\n` +
                                    `💰Costo total: ${userSessions[userId].costoViaje} cup\n` +
                                    `📊Descripción adicional: ${userSessions[userId].descripcionAdicional}\n` ;
                                    
                    
                    await ctxfn.flowDynamic('Espere a que el chófer le escriba para la confirmación de su viaje');
                    await ctxfn.flowDynamic(message);
                }
            } catch (error) {
                console.error("Error en descripcionFlow:", error);
                await ctxfn.flowDynamic("Ocurrió un error al procesar la descripción adicional. Intente nuevamente.");
            }
        });

// Flujo principal de bienvenida
const welcomeFlow = addKeyword<Provider, Database>(['taxi', 'taxy', 'Taxi', 'Taxy', 'tax', 'Tax', 'Tx','TAXI','Taxis','Taxis Habana','tasi','Tasi','Tasi Habana','Tasi Habana','Tasi Habana'],{sensitive: true})
    .addAnswer(`🚖 Hola, ha contactado con la agencia de taxis *La Tankería*.🌟`)
    .addAnswer("Para ayudarlo necesito la siguiente información:", {delay: 800}, async (ctx, ctxfn) => {
        const userId = ctx.from;
      
        await ctxfn.gotoFlow(veiculosFlow);
    });
const veiculosFlow = addKeyword<Provider, Database>(['borscht'])
    .addAnswer("¿Tomará carro (1) o moto (2)?", { delay: 800, capture: true }, async (ctx, ctxfn) => {
        const userId = ctx.from; // Identificador
        userSessions[userId] = userSessions[userId] || {}; // Inicializa la sesión
        const input = ctx.body;
        if(input === "1"||input === "carro" || input === "Carro" || input === "CARRO" || input === "Un carro" || input === "un carro" || input === "quiero un carro"||input === "quiero carro"||input === "Quiero carro"||input === "QUIERO UN CARRO" ){
            userSessions[userId].tipoVehiculo = "carro";
            userSessions[userId].bruto = 0
            
        }else if(input === "2"||input === "moto" || input === "Moto" || input === "MOTO" || input === "una moto" || input === "Una moto" || input === "quiero una moto"||input === "quiero moto"||input === "Quiero moto"||input === "QUIERO UNA MOTO"){
            userSessions[userId].tipoVehiculo = "moto";
            userSessions[userId].bruto = 0
           
        }else{
            await ctxfn.flowDynamic("No entendí, sea más específico.");
            userSessions[userId].bruto = 1
            await ctxfn.gotoFlow(veiculosFlow);
            ctxfn.endFlow();
            return;
        }
        
    })

    .addAnswer("¿Qué día le recogemos?", { delay: 800 }, async (ctx, ctxfn) => {
        const userId = ctx.from;
        if(userSessions[userId].bruto == 0){
            await ctxfn.gotoFlow(dateFlow); 
        }
    });

// Función para validar el formato de fecha
function isValidDateFormat(dateString: string): boolean {
    const datePattern = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])$/;
    
    if (!datePattern.test(dateString)) {
        return false; // No coincide con el formato
    }

    const [day, month] = dateString.split('/').map(Number);
    const dateObject = new Date(new Date().getFullYear(), month - 1, day); // Usar el año actual para la validación
    
    return dateObject.getDate() === day && dateObject.getMonth() === month - 1;
}

// Función para validar formato de hora en 24 horas
function isValidTimeFormat(time: string): boolean {
    const timePattern = /^(2[0-3]|[01]?[0-9]):([0-5][0-9])$/; 
    
    return timePattern.test(time);
}

function cleanupSessions() {
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
    setInterval(() => {
        const now = Date.now();
        Object.keys(userSessions).forEach(userId => {
            if (userSessions[userId].lastActivity && (now - userSessions[userId].lastActivity) > SESSION_TIMEOUT) {
                delete userSessions[userId];
            }
        });
    }, 9 * 60 * 1000); // Ejecutar cada 9 minutos
}

const main = async () => {
    cleanupSessions();
    const adapterFlow = createFlow([descripcionFlow,nuevaParadaFlow,newDistanceFlow2,veiculosFlow,desvioQuestionFlow,welcomeFlow, dateFlow,timeFlow,time2Flow,zoneFlow,destinationFlow,newDistanceFlow,noDesvioFlow,pasajerosFlow]); 
    const adapterProvider = createProvider(Provider); 
    const adapterDB = new Database(); 
    
    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    adapterProvider.server.post('/v1/messages', handleCtx(async (bot, req, res) => {
        const { number, message, urlMedia } = req.body;
        
        await bot.sendMessage(number, message, { media: urlMedia ?? null });
        
        return res.end('sended');
    }));

    httpServer(+PORT);
};

main();
