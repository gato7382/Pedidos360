import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

const kafka = new Kafka({
  clientId: 'pedidos360-publisher',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

async function run() {
  await producer.connect();
  console.log('🚀 Conectado a Kafka. Iniciando envío de 5.000 eventos...');

  const startTime = Date.now();
  const totalMensajes = 5000;
  const batchSize = 500;

  for (let i = 0; i < totalMensajes; i += batchSize) {
    const messages = [];

    for (let j = 0; j < batchSize; j++) {
      const num = i + j + 1;
      const pedidoId = `PED-MKOR-${String(num).padStart(6, '0')}`;

      const evento = {
        eventId: uuidv4(),
        tipo: 'PEDIDO_CREADO',
        version: 2,
        fecha: new Date().toISOString(),
        pedidoId: pedidoId,
        clienteId: `CLI-${Math.floor(Math.random() * 1000)}`,
        total: 19470,
        actor: {
          usuarioId: 'CLI-0397',
          rol: 'CLIENTE'
        },
        estadoAnterior: null,
        estadoNuevo: 'CREADO',
        items: [
          {
            productoId: 'PRD-002',
            nombre: 'Pizza Pepperoni',
            categoria: 'PIZZAS',
            cantidad: 1,
            precioUnitario: 11490
          }
        ],
        canal: 'APP',
        comuna: 'Providencia',
        sucursalId: 'SUC-01'
      };

      messages.push({
        key: pedidoId,
        value: JSON.stringify(evento)
      });
    }

    await producer.send({
      topic: 'pedidos.eventos',
      messages: messages
    });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `✅ ¡ÉXITO! Se enviaron ${totalMensajes} eventos al tópico 'pedidos.eventos' en ${durationSec} segundos.`
  );

  await producer.disconnect();
}

run().catch(console.error);