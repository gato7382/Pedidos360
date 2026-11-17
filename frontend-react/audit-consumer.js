import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'pedidos360-audit-service',
  brokers: ['localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'audit-group' });

async function run() {
  await consumer.connect();
  console.log(
    '🎧 Consumidor de Auditoría conectado y escuchando en el tópico "pedidos.eventos"...'
  );

  await consumer.subscribe({
    topic: 'pedidos.eventos',
    fromBeginning: true
  });

  let contador = 0;
  const startTime = Date.now();

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      contador++;
      const payload = JSON.parse(message.value.toString());

      if (contador % 1000 === 0 || contador === 5000) {
        console.log(
          `📥 [Procesado ${contador}/5000] Evento ID: ${payload.eventId} | Pedido: ${payload.pedidoId} | Estado: ${payload.estadoNuevo}`
        );
      }

      if (contador === 5000) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(
          `\n✅ ¡ÉXITO TOTAL! Se procesaron los 5.000 eventos de auditoría en ${totalTime} segundos.`
        );
      }
    }
  });
}

run().catch(console.error);