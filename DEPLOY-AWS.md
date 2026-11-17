# Despliegue de Pedidos360 EP5 en AWS

El navegador carga Angular por HTTPS e inicia sesión con Microsoft Entra ID. Angular envía su access token al HTTP API de AWS. API Gateway valida el token y reenvía la solicitud por HTTPS hacia EC2. El proxy de EC2 conserva la ruta y el encabezado `Authorization` para que Spring Boot también valide el token. Los microservicios acceden a PostgreSQL, Kafka y RabbitMQ desde la red de Docker.

```text
Navegador → HTTPS de EC2 → Angular
Angular → HTTPS de API Gateway → HTTPS de EC2 → Spring Boot
                                               ├─ PostgreSQL
                                               ├─ Kafka + ZooKeeper
                                               └─ RabbitMQ
```

## 1. Datos necesarios antes de publicar

| Dato | Por qué hace falta |
| --- | --- |
| Región, ID de instancia, DNS o IP pública, y AMI de EC2 | Permiten ubicar la instancia, elegir el usuario SSH y preparar los comandos de instalación para su sistema operativo. Comprueba también que la instancia tenga memoria y disco para los clústeres, los cinco servicios y las compilaciones. |
| ID o Invoke URL del HTTP API y nombre del stage | Identifican el API que ya existe y la URL que usará Angular. Confirma si el stage tiene Auto-deploy y si hay rutas explícitas para este proyecto. |
| Dominio HTTPS disponible y control de su DNS | Entra devuelve el navegador a la URL registrada de Angular y exige HTTPS fuera de localhost. El mismo dominio puede servir como origen HTTPS de la integración. |
| Client ID del registro SPA, si es distinto del Client ID de la API | MSAL utiliza el ID de la SPA para iniciar sesión. El token debe tener como audiencia el ID de la API. Si el mismo registro cumple ambas funciones, se puede usar el ID confirmado en ambos sitios. |
| Decisión sobre PostgreSQL | Compose incluye una base con volumen en EC2. Para usar RDS hace falta una instancia existente o autorizar su aprovisionamiento, el endpoint privado y un usuario de base de datos. |

Comparte identificadores y URLs para ubicar los recursos. Introduce las contraseñas y la clave SSH en tu equipo o en la instancia autorizada. [Restricciones de la URI de retorno en Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)

## 2. Preparar la instancia y subir el proyecto

1. Entra por SSH con la clave existente, o por el método de acceso que habilite tu laboratorio. Para Ubuntu, el usuario habitual es `ubuntu`. Confirma la AMI para elegir el usuario y los comandos correctos.
2. Instala Docker Engine con el complemento Compose para ese sistema y comprueba que `docker compose version` responde. Para Ubuntu, sigue las instrucciones del repositorio oficial e instala `docker-compose-plugin` junto a Docker Engine. [Instalación oficial en Ubuntu](https://docs.docker.com/engine/install/ubuntu/) · [Complemento Docker Compose](https://docs.docker.com/compose/install/linux/)
3. Desde tu PC, sube el ZIP completo. El Compose de backend necesita que Angular siga en la carpeta hermana `frontend-angular`. Sustituye el archivo de clave, el host y el usuario por los de tu instancia.

   ```powershell
   scp -i "mi-clave.pem" "pedidos360-ep5.zip" "ubuntu@ec2.example.com:~/"
   ```

4. En la instancia, extrae el paquete en una carpeta nueva y crea su configuración inicial. Si `unzip` no está instalado, instálalo con el gestor de paquetes del sistema. Ejecuta los comandos Docker con `sudo` si tu usuario necesita elevar permisos.

   ```bash
   mkdir -p ~/ep5
   unzip ~/pedidos360-ep5.zip -d ~/ep5
   cd ~/ep5/pedidos360/backend
   cp .env.example .env
   chmod 600 .env
   ```

5. Edita `.env`. Sustituye los valores de ejemplo de dominio e Invoke URL antes de levantar la aplicación en EC2. Genera contraseñas distintas para `DB_PASSWORD`, `RABBIT_PASSWORD` y `KAFKA_UI_PASSWORD`, además de un valor para `RABBITMQ_ERLANG_COOKIE`, que compartirán los tres nodos RabbitMQ para autenticarse entre sí. Puedes generar cada valor directamente en EC2 con `openssl rand -hex 24`. Hazlo antes del primer arranque para que los volúmenes nuevos se inicialicen con esas credenciales.

   ```dotenv
   FRONTEND_BIND=127.0.0.1
   FRONTEND_PORT=8081
   API_BIND=127.0.0.1
   API_PORT=3000
   KAFKA_UI_BIND=127.0.0.1
   RABBIT_UI_BIND=127.0.0.1
   FRONTEND_ORIGINS=https://pedidos.example.com
   API_BASE_URL=https://api-id.execute-api.us-east-1.amazonaws.com/ep5
   ```

   `API_BASE_URL` es el Invoke URL del stage sin `/api` al final. Para un stage con nombre, conserva ese segmento. Para `$default`, usa solo el origen. Los puertos internos quedan accesibles al proxy de la misma EC2.

6. Inicia el conjunto y revisa la salud de los servicios. La primera compilación requiere acceso saliente para descargar imágenes y dependencias.

   ```bash
   docker compose config --quiet
   docker compose up -d --build
   docker compose ps
   curl -fsS http://127.0.0.1:3000/actuator/health
   ```

## 3. Configurar HTTPS y Entra

En EC2, permite TCP `443` para el sitio y la integración HTTPS. Si utilizas Caddy con emisión automática y redirección, publica también TCP `80`. Limita SSH `22` a tu IP pública o al método de acceso aprobado. Accede a las consolas de mensajería mediante túnel SSH y deja `3000`, `8080`, `15672`, `5432`, `5672`, `2181` y el rango `9092–9094` fuera de las reglas públicas. [Reglas de ejemplo de EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)

Apunta un registro DNS al IPv4 público estable de EC2. Si ya existe un proxy con certificado HTTPS válido, dirige `/api/*` a `127.0.0.1:3000` conservando el prefijo `/api`, y el resto a `127.0.0.1:8081`. Para un proxy en la misma instancia sin configurar, una opción es instalar Caddy y aplicar este Caddyfile con tu dominio real. [Instalación de Caddy](https://caddyserver.com/docs/install) · [HTTPS automático](https://caddyserver.com/docs/automatic-https)

```caddyfile
pedidos.example.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:3000
    }
    handle {
        reverse_proxy 127.0.0.1:8081
    }
}
```

Para una instalación de Caddy con systemd y archivo `/etc/caddy/Caddyfile`, comprueba la configuración y recarga el servicio.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

En el registro de la SPA en Entra, abre **Authentication → Single-page application** y agrega `https://pedidos.example.com/redirect` con el dominio real. Configura `ENTRA_SPA_CLIENT_ID` en `.env` si la SPA tiene un ID propio. La SPA debe poder pedir el permiso delegado `api://d0b2e05c-58b9-4d02-aade-281d22bb3074/access_as_user`. Para las pantallas de administración, asigna el rol de aplicación `Admin` a las cuentas autorizadas para que aparezca en sus access tokens. [Página de retorno de MSAL Browser](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge)

## 4. Conectar el HTTP API existente

1. En la consola **API Gateway**, abre el API de tipo **HTTP** correcto en su región. Revisa sus rutas y stages antes de cambiarlo. Los cambios pueden quedar publicados enseguida si el stage tiene Auto-deploy.
2. En **Integrations**, crea una integración **HTTP proxy** con el método `ANY` y el destino `https://pedidos.example.com/api/{proxy}`. En **Routes**, enlázala a `ANY /api/{proxy+}`. Por ejemplo, una solicitud `PATCH /api/orders/123/state` llega a EC2 como `PATCH /api/orders/123/state`. Las rutas explícitas se seleccionan antes que el proxy. Si ya hay una ruta explícita de Pedidos360, revisa su integración y su autorizador para que apunten al destino correcto. [Integraciones HTTP proxy](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-http.html) · [Prioridad de rutas](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-routes.html)
3. En **Authorization**, crea o reutiliza el autorizador JWT con estos valores. Asígnalo a las rutas de la aplicación y exige el scope indicado.

   | Campo | Valor |
   | --- | --- |
   | Identity source | `$request.header.Authorization` |
   | Issuer | `https://login.microsoftonline.com/1a1fed8a-8960-4a10-95a1-f9d77a98832a/v2.0` |
   | Audience | `d0b2e05c-58b9-4d02-aade-281d22bb3074` |
   | Scope de la ruta | `access_as_user` |

   La audiencia coincide con el claim `aud` que informaste. Angular envía `Authorization: Bearer …`. La integración HTTP proxy reenvía la solicitud y Spring valida el mismo token. [Autorizadores JWT para HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)

4. Configura **CORS** en el HTTP API. Permite el origen exacto de Angular, por ejemplo `https://pedidos.example.com`, métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y encabezados `Authorization, Content-Type`. Mantén el mismo origen en `FRONTEND_ORIGINS`. CORS de HTTP API responde a preflight automáticamente. Si un autorizador está interceptando `OPTIONS` —por ejemplo, en una ruta `$default`— agrega una ruta explícita `OPTIONS /api/{proxy+}` sin autorización, enlazada a la integración correspondiente. [CORS para HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html)
5. En **Stages**, confirma que el cambio se publicó en el stage elegido si tiene Auto-deploy. Si se administra manualmente, usa **Deploy** para publicar en ese stage. Copia el Invoke URL exacto a `API_BASE_URL`. Después de editar `.env`, vuelve a ejecutar `docker compose up -d` para que Angular reciba la URL. [Stages de HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-stages.html)

Con esta variante pública, el endpoint de EC2 también es alcanzable directamente por HTTPS. Spring valida JWT y el rol `Admin` incluso por esa ruta. Para exigir que todo acceso pase por API Gateway, hace falta una integración privada separada y confirmar que el laboratorio permite sus recursos. [Integraciones privadas de HTTP API](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-private.html)

## 5. Comprobar la integración

Desde PowerShell, sustituye los valores de ejemplo y comprueba CORS y el rechazo de una petición sin token.

```powershell
$api = 'https://api-id.execute-api.us-east-1.amazonaws.com/ep5'
$origin = 'https://pedidos.example.com'
curl.exe -i -X OPTIONS "$api/api/products" -H "Origin: $origin" -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Headers: authorization,content-type'
curl.exe -i "$api/api/products"
```

El preflight debe responder correctamente y devolver `Access-Control-Allow-Origin` con el origen configurado. El `GET` sin token debe devolver `401`. En Angular, inicia sesión y confirma en **Red** del navegador que `GET /api/products` va al Invoke URL y devuelve `200`. Crea un producto y luego un pedido. Revisa que aparezca en Pedidos y que los eventos lleguen a las vistas de Auditoría y Reportes. Para una incidencia concreta, revisa los nombres de servicio con `docker compose ps` y sus mensajes con `docker compose logs --tail 80 NOMBRE_SERVICIO`.

Para inspeccionar las dos consolas desde tu PC sin publicar sus puertos, deja abierta esta sesión SSH y visita `http://localhost:18080` para Kafka UI o `http://localhost:15672` para RabbitMQ Management.

```powershell
ssh -i "mi-clave.pem" -N -L 18080:127.0.0.1:8080 -L 15672:127.0.0.1:15672 "ubuntu@ec2.example.com"
```

## PostgreSQL en EC2 o Amazon RDS

Para partir con el PostgreSQL de Compose, deja `DB_URL=jdbc:postgresql://database:5432/pedidos360` y configura sus credenciales en `.env`. El volumen de PostgreSQL conserva datos en la instancia. Si la entrega exige una base administrada, confirma ese requisito antes de cambiar la conexión o contratar un recurso.

Para RDS PostgreSQL, deja la base en red privada y permite TCP `5432` desde el Security Group de EC2 hacia el de RDS. Usa el endpoint DNS real de RDS y credenciales de la aplicación. Establece `DB_URL=jdbc:postgresql://ENDPOINT_RDS:5432/pedidos360?sslmode=verify-full&sslrootcert=/run/certs/rds.pem`. Monta el certificado CA oficial de RDS en esa ruta, en modo de solo lectura, en `catalog-service`, `orders-service`, `audit-service` y `report-service`, mediante un archivo de extensión de Compose. Actualiza `DB_USER` y `DB_PASSWORD` antes de recrear los servicios y confirma que se conectan. El cambio de URL apunta a una base distinta. Si necesitas los datos del volumen anterior, respáldalos y migra antes de hacer el cambio. [TLS con RDS para PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/ssl-certificate-rotation-postgresql.html)
