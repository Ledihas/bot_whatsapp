import express from 'express';
import cron from 'node-cron';
import { exec } from 'child_process';

const app = express();

app.get('/', (req, res) => {
    res.send('¡Hola, mundo!');
});

// Programar la tarea para que se ejecute cada 24 horas
cron.schedule('0 0 * * *', () => {
    console.log('Reiniciando la aplicación...');
    exec('npm run start', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error al reiniciar la aplicación: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error: ${stderr}`);
            return;
        }
        console.log(`Salida: ${stdout}`);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});