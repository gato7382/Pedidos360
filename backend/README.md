# Pedidos360 backend para EP5

Backend Spring Boot 3.5.16 dividido en microservicios Java. Este Compose levanta PostgreSQL, los cinco microservicios y Angular. Kafka, ZooKeeper, Kafka UI y el clúster RabbitMQ se levantan por separado desde `../docker-compose.yml`; ambos proyectos se comunican por la red Docker compartida `pedidos360-ep5-infra_default`.

## Requisitos locales

- Docker Desktop con Compose
- Java 21 y Maven 3.9 si se ejecuta fuera de Docker
- Una aplicación SPA y una API configuradas en Microsoft Entra ID

Copia `.env.example` a `.env`. El Tenant ID, Client ID, audiencia y scope corresponden a los valores confirmados para este proyecto. Cambia las contraseñas antes de usarlo en una instancia pública. El rol de aplicación `Admin` debe estar incluido en el access token de las cuentas autorizadas para administrar Kafka y RabbitMQ. Si conectas una base administrada en AWS, cambia `DB_URL` al endpoint PostgreSQL de RDS y configura sus credenciales en ese archivo.

Primero, desde la carpeta raíz del proyecto, levanta la infraestructura:

```bash
cd ..
docker compose up -d
```

Después, desde esta carpeta, configura el entorno de aplicación y levanta los servicios:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

La primera ejecución compila los cinco servicios Spring Boot y la interfaz Angular. PostgreSQL usa un volumen persistente. No inicies Kafka/RabbitMQ desde este Compose: ya están definidos en el Compose de la raíz y duplicarlos causa conflictos de puertos.

## Servicios

- Web Angular con MSAL y MSAL Interceptor en puerto 80
- API Gateway de aplicación Nginx en puerto 3000
- Catálogo en `/api/products`
- Pedidos en `/api/orders`
- Auditoría Kafka y RabbitMQ en `/api/audit`
- Reportes en `/api/reports`
- Administración de Kafka en `/api/admin/kafka`
- Administración de RabbitMQ en `/api/admin/rabbit`
- Kafka UI en el puerto 8080; pertenece al Compose de la raíz.
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

Sigue [Despliegue en AWS](../DEPLOY-AWS.md) para configurar el HTTP API, su autorizador JWT y la conexión al proxy Nginx de EC2. En la instancia, levanta primero `../docker-compose.yml` y luego este Compose de aplicación. El proxy sirve Angular por el puerto 80 y enruta `/api` por el puerto 3000. Los puertos de los brokers y los paneles quedan en localhost de forma predeterminada.

Para conectar una base administrada, establece `DB_URL` al endpoint PostgreSQL de RDS y usa sus credenciales en `.env`. La base PostgreSQL local de Compose sirve para desarrollo y demostración.

No se incluye una dirección real de EC2 ni el identificador de API Gateway, así que esos recursos quedan para configurar con los valores de la cuenta.

El compose original de un broker y el código Node de prueba de carga se conservan en `../frontend-react` y `../legacy`.
