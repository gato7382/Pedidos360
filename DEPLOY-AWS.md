# Publicar Pedidos360 con API Gateway y EC2

La app Angular se publica como archivos estáticos en Nginx, puerto 80. Ese mismo servidor Nginx también enruta `/api/*` a los microservicios. Por eso API Gateway necesita una sola integración HTTP a EC2:80; las rutas del API Gateway separan la web y la API para aplicar autorización a esta última. El puerto 4200 pertenece a `ng serve` en el computador de desarrollo y no se usa en EC2.

## 1. Usar los dos Compose sin duplicar infraestructura

`../docker-compose.yml` levanta ZooKeeper, Kafka, Kafka UI y RabbitMQ. `backend/compose.yaml` levanta solo PostgreSQL, los microservicios y Angular y se conecta a la red Docker `pedidos360-ep5-infra_default`. Así los dos archivos Compose pueden correr a la vez sin duplicar ni volver a publicar los mismos puertos.

Antes de reemplazar el Compose antiguo en EC2, detén solo los contenedores del proyecto de aplicación desde `backend/` (esto no borra volúmenes ni toca el clúster `pedidos360-ep5-infra`):

```bash
cd /home/ubuntu/Pedidos360/backend
docker compose stop
```

Después de copiar/actualizar los archivos del proyecto en EC2, vuelve a `backend/`, verifica que exista la red y crea `.env` solo si aún no existe:

```bash
cd /home/ubuntu/Pedidos360/backend
docker network ls | grep pedidos360-ep5-infra_default
if [ ! -f .env ]; then cp .env.example .env; fi
```

Edita `.env`: añade el origen `https://<API_ID>.execute-api.us-east-1.amazonaws.com` a `FRONTEND_ORIGINS`, cambia `DB_PASSWORD` y asegúrate de que `RABBITMQ_USER` y `RABBITMQ_PASSWORD` coincidan con los del clúster que ya está iniciado. No compartas esas contraseñas aquí. El ejemplo usa `admin/admin` para una instalación nueva; cambiar `.env` no cambia usuarios guardados en volúmenes RabbitMQ existentes. Usa `FRONTEND_BIND=0.0.0.0` para publicar el puerto 80. Deja `API_BIND=127.0.0.1`; API Gateway no necesita acceder al puerto 3000 porque Nginx en el 80 enruta la API.

Desde `backend/`, inicia la aplicación actualizada. Compose retirará los contenedores huérfanos del proyecto `pedidos360` si añades `--remove-orphans`; no uses `-v`, porque elimina volúmenes. Para preservar también los contenedores detenidos mientras confirmas la migración, ejecuta primero sin esa opción:

```bash
docker compose up -d --build
docker compose ps
```

La red `pedidos360-ep5-infra` debe permanecer levantada. No ejecutes `docker compose down` desde la raíz durante esta configuración.

Comprueba localmente desde EC2:

```bash
curl -I http://localhost/
curl -i http://localhost:3000/actuator/health
```

Estas son comprobaciones desde el servidor, no enlaces para el navegador.

## 2. Asegurar que estás usando la IPv4 pública de EC2

En **EC2 → Instances → tu instancia → Details**, copia el campo **Public IPv4 address**. No uses una dirección que muestre el navegador, una VPN, el computador local ni el campo **Private IPv4 address**.

La dirección `100.53.254.184` cae dentro del bloque `100.64.0.0/10`, que IETF reserva para direcciones compartidas de Carrier-Grade NAT y que no se enruta globalmente. Si ese valor aparece literalmente como **Public IPv4 address** en AWS, detén la configuración y revisa ese dato de red: API Gateway público no podrá conectarse a una dirección compartida no enrutable. Una IPv4 pública asignada por EC2 se muestra en los detalles de la instancia y puede cambiar al detener/iniciar la instancia.

No necesitas abrir `:4200` ni el puerto 3000 en el Security Group. Autoriza entrada TCP en **80** para la integración HTTP pública de Gateway y conserva SSH 22 según tu forma de administrar la instancia. No abras 8080, 15672, 9092 ni 2181 a Internet.

## 3. Crear una integración y dos rutas HTTP API

En **API Gateway → APIs → Pedidos360-Gateway → Integrations**, crea o edita una sola integración HTTP:

```text
http://<IPV4_PUBLICA_EC2>:80
```

Luego, en **Routes**, conecta las dos rutas a esa misma integración:

| Ruta | Integración | Autorización |
|---|---|---|
| `$default` | La integración HTTP anterior | `NONE` |
| `ANY /api/{proxy+}` | La misma integración HTTP | JWT Entra ID |

Si ya existe la ruta amplia `ANY /{proxy+}`, elimínala. El `$default` sirve `index.html`, los archivos JS/CSS y `/redirect`; `ANY /api/{proxy+}` captura solo las peticiones de API. Las integraciones HTTP proxy pasan la solicitud al endpoint Nginx. No configures un segundo destino al puerto 3000.

Reemplaza `<IPV4_PUBLICA_EC2>` por la dirección **Public IPv4 address** actual de EC2. Si la consola muestra un mapeo de ruta para la integración, conserva la ruta completa (`$request.path`) para que Nginx reciba, por ejemplo, `/api/products`. El backend Spring vuelve a validar el JWT.

Para el JWT authorizer de la ruta API, usa:

- **Identity source**: `$request.header.Authorization`
- **Issuer URL**: `https://login.microsoftonline.com/1a1fed8a-8960-4a10-95a1-f9d77a98832a/v2.0`
- **Audience**: `d0b2e05c-58b9-4d02-aade-281d22bb3074`
- **Authorization scopes** de la ruta: `access_as_user`

Mantén la etapa `$default` con **Auto-deploy** activado. El Invoke URL será parecido a `https://<API_ID>.execute-api.us-east-1.amazonaws.com`. Ese es el enlace que abrirás; no agregues `:4200`, `:80` ni `/default`.

En **API Gateway → CORS**, no necesitas CORS para el flujo de producción porque la página y `/api/*` comparten el mismo Invoke URL. Si además configuras Angular local para llamar al Gateway, permite el origen `http://localhost:4200`, métodos `GET,POST,PUT,PATCH,DELETE,OPTIONS` y headers `Authorization,Content-Type,Accept`.

## 4. Registrar el retorno de Entra ID

En **Microsoft Entra → App registrations → Pedidos360-SPA → Authentication → Single-page application**, registra como Redirect URI:

```text
https://<API_ID>.execute-api.us-east-1.amazonaws.com/redirect
```

Sustituye `<API_ID>` por el ID que aparece en el Invoke URL de tu Gateway. Conserva también `http://localhost:4200/redirect` para iniciar Angular localmente. En producción, el archivo runtime configura la API base vacía, por lo que Angular llama al mismo origen HTTPS del Invoke URL.

## 5. Probar

1. Abre el Invoke URL HTTPS de API Gateway sin sufijo; debe cargar Pedidos360.
2. Inicia sesión con Microsoft. Si aparece `AADSTS50011`, revisa que la Redirect URI de Entra coincida exactamente con `https://<API_ID>.execute-api.us-east-1.amazonaws.com/redirect`.
3. Crea o consulta un producto/pedido. Las llamadas del navegador deben ir a `https://<API_ID>.execute-api.us-east-1.amazonaws.com/api/...` y devolver datos.
4. Un `401` o `403` en `/api/*` apunta a authorizer, audience, issuer o scope. Un timeout de integración apunta a IP de destino, Security Group, puerto 80 o contenedores no saludables.

## Si cambia la IPv4 de EC2

El Invoke URL de API Gateway, la URL guardada en el navegador y la Redirect URI de Entra se mantienen iguales. Actualiza el host de la única integración al puerto 80 con la IPv4 pública nueva y espera el auto-deploy. No cambies la URL de la aplicación a `IP:4200`.
