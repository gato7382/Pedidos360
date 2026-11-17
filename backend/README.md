# Pedidos360 backend para EP5

Backend Spring Boot 3.5.16 dividido en microservicios Java. Incluye catálogo y pedidos con PostgreSQL, eventos de pedido en Kafka, auditoría en Kafka y RabbitMQ con colas quorum y DLQ, reportes, administración de Kafka y administración de RabbitMQ.

## Requisitos locales

- Docker Desktop con Compose
- Java 21 y Maven 3.9 si se ejecuta fuera de Docker
- Una aplicación SPA y una API configuradas en Microsoft Entra ID

Copia `.env.example` a `.env`. El Tenant ID, Client ID, audiencia y scope corresponden a los valores confirmados para este proyecto. Cambia las contraseñas antes de usarlo en una instancia pública. El rol de aplicación `Admin` debe estar incluido en el access token de las cuentas autorizadas para administrar Kafka y RabbitMQ. Si conectas una base administrada en AWS, cambia `DB_URL` al endpoint PostgreSQL de RDS y configura sus credenciales en ese archivo.

Desde esta carpeta:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

La primera ejecución compila los cinco servicios Spring Boot y la interfaz Angular, luego levanta PostgreSQL, tres brokers Kafka con ZooKeeper, Kafka UI y un clúster RabbitMQ de tres nodos.

## Servicios

- Web Angular con MSAL y MSAL Interceptor en puerto 80
- API Gateway de aplicación Nginx en puerto 3000
- Catálogo en `/api/products`
- Pedidos en `/api/orders`
- Auditoría Kafka y RabbitMQ en `/api/audit`
- Reportes en `/api/reports`
- Administración de Kafka en `/api/admin/kafka`
- Administración de RabbitMQ en `/api/admin/rabbit`
- Kafka UI en el puerto 8080 con formulario de inicio de sesión. Las credenciales se definen en `.env`
- RabbitMQ Management en el puerto 15672, limitado a localhost de forma predeterminada
- PostgreSQL queda en la red interna de Docker

La aplicación web usa la URL del API Gateway si se define `API_BASE_URL`. Al dejarla vacía, las solicitudes pasan por Nginx local y llegan a los microservicios.

## Flujo de eventos

Orders persiste cada pedido y su evento en PostgreSQL en una misma transacción. Un publicador de outbox entrega el evento con `pedidoId` como clave de partición a `pedidos.eventos` y publica el mismo cambio al exchange `pedidos360.events` de RabbitMQ. Los eventos incluyen `eventId`, tipo, versión, fecha, pedido, cliente, total, actor, estado, items, canal, comuna y sucursal.

El grupo `audit-group` y el grupo `report-group` leen cada uno el tópico principal con su propio offset. El consumidor de auditoría también publica registros tipados en `audit.timeline`, que el grupo independiente `audit-timeline-group` consume y expone al frontend. Después de tres reintentos, un mensaje inválido pasa a la DLT del consumidor. Los IDs de evento hacen idempotentes las escrituras de auditoría y reportes.

Los cuatro tópicos de Kafka se crean al iniciar el servicio administrador:

| Tópico | Particiones | Retención | Política |
|---|---:|---:|---|
| `pedidos.eventos` | 3 | 7 días | delete |
| `pedidos.eventos.audit.dlt` | 3 | 14 días | delete |
| `pedidos.eventos.report.dlt` | 3 | 14 días | delete |
| `audit.timeline` | 3 | 30 días | delete |

En cada consumidor, la concurrencia es 3. La clave `pedidoId` mantiene los cambios del mismo pedido en la misma partición. El factor de réplica se configura en 3 para el compose multinodo.

## Endpoints principales

Todas las rutas `/api/**` requieren access token con issuer, audiencia y scope configurados en el archivo `.env`. Las rutas administrativas también requieren el app role `Admin`.

- `GET, POST /api/products`
- `GET, PUT, DELETE /api/products/{id}`
- `GET, POST /api/orders`
- `GET /api/orders/{id}`
- `PATCH /api/orders/{id}/state`
- `GET /api/audit/events`
- `GET /api/audit/rabbit-events`
- `GET /api/reports/summary`
- `GET /api/reports/events`
- `GET /api/reports/audit-timeline`
- `GET, POST, PUT, DELETE /api/admin/kafka/topics`
- `GET, DELETE /api/admin/kafka/groups`
- `GET /api/admin/kafka/groups/{groupId}/offsets`
- `GET, POST, DELETE /api/admin/rabbit/queues`
- `GET, POST, DELETE /api/admin/rabbit/exchanges`
- `POST, DELETE /api/admin/rabbit/bindings`

Para iniciar sesión con Angular, registra en Entra `http://localhost/redirect` en la plataforma **Aplicación de página única**. Para desarrollo independiente registra la dirección de retorno que corresponda a su puerto.

## AWS

Sigue [Despliegue en AWS](../DEPLOY-AWS.md) para configurar el HTTP API, su autorizador JWT, CORS y la conexión HTTPS al proxy de EC2. El proxy enruta `/api` al puerto local 3000 de Nginx. Los puertos de los brokers y de los paneles quedan en localhost de forma predeterminada.

Para conectar una base administrada, establece `DB_URL` al endpoint PostgreSQL de RDS y usa sus credenciales en `.env`. La base PostgreSQL local de Compose sirve para desarrollo y demostración.

No se incluye una dirección real de EC2 ni el identificador de API Gateway, así que esos recursos quedan para configurar con los valores de la cuenta.

El compose original de un broker y el código Node de prueba de carga se conservan en `../frontend-react` y `../legacy`.
