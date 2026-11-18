# Pedidos360

Implementación para la entrega EP5. La interfaz de trabajo que usa la pauta es Angular con Microsoft Entra ID. El backend está dividido en servicios Spring Boot y conserva el flujo previo de pruebas con Node.js y Kafka.

## Carpetas

- `frontend-angular/` contiene la interfaz activa de Pedidos360, el guard de navegación y el interceptor MSAL para pedir el scope `access_as_user`.
- `docker-compose.yml` levanta la infraestructura compartida: RabbitMQ, Kafka con ZooKeeper y Kafka UI. `backend/compose.yaml` levanta PostgreSQL, los microservicios y Angular sobre la red de esa infraestructura.
- `frontend-react/` conserva el starter anterior React/MSAL con sus pantallas, `mock-publisher.js` y `audit-consumer.js`. Se mantiene como material previo; la app EP5 se ejecuta desde `frontend-angular/`.
- `legacy/kafka-reference/` conserva el ZIP original de Kafka, los fuentes JavaScript sin `node_modules` y el Compose de un broker.

## Inicio rápido

Para desarrollar en Angular, abre una terminal en `frontend-angular/` y ejecuta `npm ci` una vez y luego `npm start`. Abre `http://localhost:4200`; este servidor es solo para desarrollo en tu PC. En **Microsoft Entra → Registros de aplicaciones → Pedidos360-SPA → Autenticación → Aplicación de página única**, agrega `http://localhost:4200/redirect` para ese modo de desarrollo. La configuración incluye el ID de Pedidos360-SPA y el scope delegado `access_as_user` de la API.

Con Docker Desktop abierto, inicia primero la infraestructura desde la raíz del proyecto:

```bash
docker compose up -d
```

Luego, desde `backend/`, configura el entorno y levanta la aplicación:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Los dos Compose comparten la red Docker de la infraestructura. No levantes otros clústeres Kafka/RabbitMQ desde un segundo Compose a la vez.

- Para la ejecución Docker local, abre `http://localhost` y entra con tu cuenta de Microsoft. Crea un producto, crea un pedido y revisa el evento en Auditoría y Reportes.
- Kafka UI está en `http://localhost:8080`; en el Compose de infraestructura queda limitado a localhost.
- RabbitMQ Management está en `http://localhost:15672`. Para un clúster nuevo de la demo, usuario `admin` y contraseña `admin`. La auditoría consume mensajes de pedidos en segundo plano.
- Nginx sirve Angular en el puerto 80 y enruta la API por el puerto 3000. Para AWS, usa API Gateway como URL HTTPS estable del navegador; no abras la IPv4 de EC2 en el puerto de desarrollo `4200`.

## Despliegue

Consulta [Despliegue en AWS](DEPLOY-AWS.md) para servir la SPA y la API mediante el Invoke URL HTTPS de API Gateway. La IPv4 dinámica de EC2 se usa solo en las integraciones de Gateway. El Compose incluye PostgreSQL con un volumen persistente y admite una conexión PostgreSQL externa mediante `DB_URL`.
