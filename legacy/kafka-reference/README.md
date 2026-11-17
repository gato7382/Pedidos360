# Fuentes de Kafka conservados

Esta carpeta conserva:

- `original-kafka.zip`, copia del ZIP entregado con el material.
- `kafka/`, fuentes JavaScript extraídos sin `node_modules`.
- `docker-compose-single-broker.yml`, Compose original de ZooKeeper, Kafka y Kafka UI.

El frontend React conserva también `mock-publisher.js` y `audit-consumer.js`, que estaban en el directorio de la aplicación. El Compose principal de EP5 se encuentra en `../../backend/compose.yaml` y añade los servicios Spring Boot, persistencia y los clústeres.
