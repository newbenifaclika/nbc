# Tutorial completo — New BenifaClika solo en Cloudflare

Este tutorial parte de cero. No migra canciones, fotos ni datos de Supabase: crearás una instalación limpia y volverás a subir vuestra música desde la propia web.

## 0. Qué vas a tener al final

```text
Nuevo repositorio de GitHub
        ↓ (cada push despliega automáticamente)
Cloudflare Worker
        ├── frontend/PWA
        ├── API privada de edición
        ├── D1: metadatos
        └── R2: música e imágenes
```

No se usa:
- Supabase
- GitHub Pages
- base de datos externa
- almacenamiento externo

GitHub solo almacena el código.

---

# PARTE 1 — Crear el nuevo repositorio de GitHub

1. Entra en la nueva cuenta de GitHub.
2. Pulsa **New repository**.
3. Nombre recomendado: `new-benifaclika`.
4. Puede ser público o privado. Si solo lo vas a conectar desde tu propia cuenta de Cloudflare, privado está bien.
5. No marques README, `.gitignore` ni licencia: ya vienen incluidos.
6. Crea el repositorio.
7. Descomprime el ZIP que te he dado.
8. Sube **todo el contenido de la carpeta `new-benifaclika-cloudflare` a la raíz del repositorio**.

La raíz debe verse así:

```text
public/
src/
.gitignore
package.json
README.md
schema.sql
TUTORIAL_MIGRACION_CLOUDFLARE.md
wrangler.jsonc
```

No subas MP3 ni fotos al repositorio.

---

# PARTE 2 — Crear R2

1. Entra en Cloudflare Dashboard.
2. Ve a **R2 Object Storage**.
3. Pulsa **Create bucket**.
4. Nombre exacto recomendado:

```text
new-benifaclika-media
```

5. Usa **Standard storage**. No uses Infrequent Access: el free tier de R2 se aplica a Standard.
6. Crea el bucket.

No hace falta hacerlo público. Los archivos se sirven de forma controlada a través del Worker.

---

# PARTE 3 — Crear D1

1. En Cloudflare ve a **Storage & databases → D1 SQL Database**.
2. Pulsa **Create database**.
3. Nombre:

```text
new-benifaclika-db
```

4. Crea la base.
5. Copia su **Database ID**. Será un UUID largo.

Ahora abre en GitHub:

```text
wrangler.jsonc
```

Busca:

```json
"database_id": "PASTE_YOUR_D1_DATABASE_ID_HERE"
```

Y sustituye SOLO ese texto por el ID de tu D1.

Ejemplo:

```json
"database_id": "12345678-abcd-1234-abcd-123456789abc"
```

Guarda el commit.

---

# PARTE 4 — Crear las tablas de D1

1. Dentro de tu D1 abre **Console**.
2. En GitHub abre `schema.sql`.
3. Copia TODO el contenido.
4. Pégalo en la consola SQL de D1.
5. Ejecuta la consulta.

Debe crear:

```text
artists
albums
tracks
track_artists
app_settings
```

También crea automáticamente los cinco artistas:

```text
Neggoneko
erizo eskizo
xAMMO
TGT
Perrancos
```

La app arrancará con 0 canciones y 0 álbumes.

---

# PARTE 5 — Conectar el NUEVO GitHub a Cloudflare

Cloudflare Workers permite conectar directamente un repositorio GitHub y desplegar cada vez que haces push.

1. Cloudflare → **Workers & Pages**.
2. Pulsa **Create application**.
3. Elige **Import a repository**.
4. Conecta la NUEVA cuenta de GitHub.
5. Autoriza la app oficial de Cloudflare para ese repositorio.
6. Selecciona `new-benifaclika`.
7. El nombre del Worker debe ser:

```text
new-benifaclika
```

IMPORTANTE: debe coincidir con `"name": "new-benifaclika"` de `wrangler.jsonc`.

8. Rama: `main`.
9. Build command: puedes dejarlo vacío.
10. Deploy command:

```text
npx wrangler deploy
```

11. Guarda y despliega.

Cloudflare instalará las dependencias de `package.json`, leerá `wrangler.jsonc` y desplegará:

- el Worker
- los archivos de `public/`
- el binding `DB`
- el binding `MEDIA`

Tu URL será parecida a:

```text
https://new-benifaclika.TU-SUBDOMINIO.workers.dev
```

---

# PARTE 6 — Añadir la contraseña de edición

NO pongas la contraseña en GitHub.

Ve al Worker:

**Workers & Pages → new-benifaclika → Settings → Variables and Secrets**

Crea dos **Secrets**, no variables normales:

## ADMIN_PASSWORD

La contraseña compartida que usaréis vosotros.

Ejemplo de formato bueno:

```text
Benifa-una-frase-larga-2026-que-solo-sabemos-nosotros
```

No uses ese ejemplo literalmente.

## SESSION_SECRET

Una cadena aleatoria diferente a la contraseña. Hazla muy larga, por ejemplo 64–100 caracteres aleatorios.

No la tienes que recordar ni usar para iniciar sesión.

Sirve para firmar las sesiones del navegador.

Después guarda los secrets y despliega/aplica la nueva versión si Cloudflare te lo solicita.

---

# PARTE 7 — Primera prueba

Abre:

```text
https://TU-WORKER.workers.dev/api/health
```

Deberías ver algo parecido a:

```json
{
  "ok": true,
  "service": "new-benifaclika-cloudflare",
  "database": "D1",
  "media": "R2"
}
```

Después abre la URL normal del Worker.

Debe aparecer la página vacía.

Pulsa:

```text
Editar
```

Escribe `ADMIN_PASSWORD`.

Si entra en **Editar página**, ya tienes funcionando:

- frontend
- Worker
- autenticación
- D1
- R2

---

# PARTE 8 — Subir la primera canción

1. Editar → **Añadir tema**.
2. Título.
3. Marca uno o varios artistas.
4. Selecciona MP3.
5. Portada opcional.
6. Guardar.

El flujo es:

```text
MP3 → Worker → R2
metadatos → Worker → D1
```

La web NO guarda el archivo en GitHub.

---

# PARTE 9 — Subir un álbum

1. Editar → **Añadir álbum**.
2. Nombre.
3. Portada del álbum.
4. Selecciona o arrastra varios MP3.
5. La web genera una fila por canción.
6. Revisa el título y los participantes.
7. Pulsa **Subir álbum**.

No existe portada individual por canción: todo el álbum usa la portada general.

Si falla antes de guardar los metadatos, la web intenta borrar los archivos ya subidos para no dejar basura en R2.

---

# PARTE 10 — Editar álbumes

Editar → **Editar álbumes**.

Puedes:

- renombrar álbum
- cambiar portada
- reordenar canciones
- editar título
- cambiar participantes
- marcar canciones para borrar
- volver a mantener una canción marcada
- añadir varios MP3 nuevos
- borrar el álbum entero

La fecha original de las canciones no se toca al editarlas.

---

# PARTE 11 — Fotos de artistas

Editar → **Artistas**.

Puedes subir/cambiar/eliminar la foto y editar la biografía.

Las fotos se guardan en:

```text
R2 → artists/
```

No hay ninguna foto personal incluida en el proyecto inicial.

---

# PARTE 12 — Mantenerlo a 0 €

La aplicación tiene un límite preventivo configurado en `wrangler.jsonc`:

```json
"STORAGE_SOFT_LIMIT_BYTES": "9663676416"
```

Eso son aproximadamente **9 GiB**.

R2 Standard incluye actualmente 10 GB-mes/mes sin coste. He dejado margen para no trabajar pegados al límite.

Cuando la suma de R2 llegue al límite configurado, la API rechazará nuevas subidas.

En **Editar página** verás:

```text
Almacenamiento
7.20 GB / 9.00 GB (80%)
```

El botón **Recalcular** vuelve a recorrer R2 y corrige el contador si alguna vez modificas archivos manualmente desde Cloudflare.

IMPORTANTE: el free tier de R2 se calcula en GB-mes, no es simplemente un disco duro con un corte exacto en 10 GB. El límite de 9 GiB de esta aplicación es una protección conservadora del tamaño almacenado actualmente, no un sistema de facturación oficial.

Para 1.000 canciones, intenta que el MP3 medio se mantenga aproximadamente en 6–8 MB.

Recomendación de exportación para vuestra biblioteca:

```text
MP3
256 kbps
44.1 o 48 kHz
Stereo
```

No recomiendo convertir audio dentro del navegador: es mucho más pesado y menos fiable en móviles. La app comprime automáticamente las imágenes grandes, pero conserva el audio que vosotros subís.

---

# PARTE 13 — PWA / pantalla apagada

La reproducción utiliza:

- HTMLAudioElement
- Media Session API
- peticiones HTTP Range desde R2
- controles del sistema para play/pausa/anterior/siguiente

El Service Worker **NO intercepta `/media/`**, a propósito. Esto evita que una caché de PWA intente tratar un MP3 como un archivo estático normal y rompa seek/rangos/reproducción en background.

En Android:

1. Abre la web en Chrome.
2. Pulsa **Instalar** cuando esté disponible o menú → Instalar aplicación.
3. Abre la versión instalada.
4. Reproduce una canción.
5. Bloquea el móvil.

Deberías tener controles multimedia en la pantalla de bloqueo si Android/navegador lo permiten.

Ninguna PWA puede impedir que el sistema operativo mate completamente la aplicación por ahorro de batería, pero esta arquitectura utiliza el mecanismo correcto para reproducción web en segundo plano.

---

# PARTE 14 — Qué pasa cuando subáis 600–1.000 canciones

La pestaña Canciones no pinta las 1.000 filas de golpe.

Carga inicialmente:

```text
50 canciones
```

y aparece:

```text
Cargar más canciones
```

Cada pulsación añade otras 50.

D1 sí devuelve la biblioteca completa en `/api/bootstrap`, pero 1.000 registros de metadatos siguen siendo pequeños. Si en el futuro crecéis muchísimo más, el siguiente paso sería paginar también la API.

---

# PARTE 15 — Límites gratuitos relevantes (octubre de 2026)

Compruébalos siempre en la documentación de Cloudflare porque pueden cambiar.

## R2 Standard

- 10 GB-mes/mes de almacenamiento incluidos
- 1 millón de operaciones Class A/mes
- 10 millones de operaciones Class B/mes
- egress a Internet gratis

https://developers.cloudflare.com/r2/pricing/

## D1 — Workers Free

- 5 millones de filas leídas al día
- 100.000 filas escritas al día
- 5 GB totales de almacenamiento incluidos

https://developers.cloudflare.com/d1/platform/pricing/

## Workers Free

- 100.000 invocaciones de Worker al día
- los archivos estáticos servidos como Workers Static Assets son gratis e ilimitados

https://developers.cloudflare.com/workers/platform/limits/
https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/

Con aproximadamente cinco usuarios y 600–1.000 canciones, las operaciones no deberían acercarse a esos límites en un uso normal. El factor que debes vigilar es principalmente R2.

---

# PARTE 16 — Por qué no he usado Cloudflare Access por defecto

Cloudflare Access es una opción muy buena si tienes un dominio en Cloudflare. Sin embargo, para proteger una aplicación web pública con Access normalmente trabajas con un hostname de un dominio activo en Cloudflare.

Como tu condición principal es **0 €**, no quiero obligarte a comprar un dominio.

Por eso esta versión usa:

```text
ADMIN_PASSWORD → secret de Worker
SESSION_SECRET → secret de Worker
cookie HttpOnly + Secure + SameSite=Strict
```

La contraseña nunca está en `app.js`, GitHub, HTML ni D1.

Si más adelante ya tienes un dominio, puedes añadir Cloudflare Access delante de la aplicación sin rehacer D1 ni R2.

---

# PARTE 17 — Cuando todo funcione, retirar la versión antigua

NO borres lo antiguo antes de comprobar la nueva app.

Orden recomendado:

1. Configura esta versión.
2. Sube 2–3 canciones de prueba.
3. Prueba móvil, PWA, aleatorio, bucle, álbum y pantalla bloqueada.
4. Prueba Editar.
5. Cuando estés satisfecho, vuelve a subir vuestra biblioteca real.
6. Solo entonces deja de usar el proyecto antiguo de Supabase/Worker/R2.

Si quieres empezar totalmente limpio, usa un **R2 nuevo** (`new-benifaclika-media`) como indica este tutorial. Así no arrastras archivos del proyecto anterior.

---

# PARTE 18 — Desarrollo futuro

A partir de ahora cualquier cambio en GitHub puede desplegarse automáticamente por Workers Builds.

La arquitectura queda mucho más sencilla:

```text
Frontend/API: Worker
Datos: D1
Archivos: R2
Login: secrets + sesión firmada
Código: GitHub
```

No vuelvas a añadir Supabase salvo que en el futuro la app se convierta en una plataforma multiusuario con cuentas individuales y funcionalidades que realmente lo justifiquen.
