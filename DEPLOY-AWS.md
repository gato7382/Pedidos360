# Publicar Pedidos360 con API Gateway y EC2

La app Angular se publica como archivos estáticos en Nginx, puerto 80. El puerto 4200 pertenece a `ng serve` en el computador de desarrollo y no se usa en EC2. El navegador debe abrir el Invoke URL HTTPS de API Gateway. API Gateway reenvía la web a EC2:80 y las llamadas `/api/*` a EC2:3000. Así el enlace del navegador no cambia cuando cambia la IPv4 de la instancia.

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
if [ ! -f .env ]; then cp .env.ec2.example .env; fi
```

Edita `.env`: reemplaza `API_ID`, cambia `DB_PASSWORD` y asegúrate de que `RABBITMQ_USER` y `RABBITMQ_PASSWORD` coincidan con los del clúster que ya está iniciado. No compartas esas contraseñas aquí. El archivo de ejemplo usa `admin/admin` para una instalación nueva; cambiar `.env` no cambia usuarios guardados en volúmenes RabbitMQ existentes. Los binds `FRONTEND_BIND=0.0.0.0` y `API_BIND=0.0.0.0` permiten que Gateway alcance los puertos publicados.

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

No necesitas abrir `:4200` en el Security Group. Autoriza entrada TCP en **80** y **3000** para la integración HTTP pública de Gateway. Conserva SSH 22 según tu forma de administrar la instancia. No abras 8080, 15672, 9092 ni 2181 a Internet.

## 3. Crear las rutas e integraciones HTTP API

En **API Gateway → APIs → Pedidos360-Gateway → Routes**, configura estas dos rutas:

| Ruta | Integración | Autorización |
|---|---|---|
| `$default` | HTTP URL `http://<IPV4_PUBLICA_EC2>:80` | `NONE` |
| `ANY /api/{proxy+}` | HTTP URL `http://<IPV4_PUBLICA_EC2>:3000/api/{proxy}` | JWT Entra ID |

Si ya existe la ruta amplia `ANY /{proxy+}`, elimínala o cámbiala a `ANY /api/{proxy+}`. Si la dejas, capturará archivos del sitio como `/assets/config.js` y los enviará al backend API, por lo que la interfaz no cargará completa.

Reemplaza `<IPV4_PUBLICA_EC2>` con la dirección **Public IPv4 address** actual de EC2. En la segunda integración, declara el parámetro de ruta `proxy` para que el sufijo de `/api/...` se reenvíe sin perderlo. Si la consola permite seleccionar el parámetro dinámicamente, selecciona `proxy`; la URL final de destino debe conservar `/api/` seguido de ese valor.

El `$default` route sirve `index.html`, los archivos JS/CSS y la ruta de retorno `/redirect` de Entra. Por eso no le asignes el authorizer. La ruta más específica `ANY /api/{proxy+}` manda la API al proxy Nginx de puerto 3000. El backend Spring vuelve a validar el JWT.

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
4. Un `401` o `403` en `/api/*` apunta a authorizer, audience, issuer o scope. Un timeout de integración apunta a IP de destino, Security Group, puertos 80/3000 o contenedores no saludables.

## Si cambia la IPv4 de EC2

El Invoke URL de API Gateway, la URL guardada en el navegador y la Redirect URI de Entra se mantienen iguales. Actualiza el host de las dos integraciones (`$default` a puerto 80 y `/api/{proxy+}` a puerto 3000) con la IPv4 pública nueva y espera el auto-deploy. No cambies la URL de la aplicación a `IP:4200`.
