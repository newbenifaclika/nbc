# New BenifaClika — Cloudflare Edition

Versión limpia de la biblioteca musical de New BenifaClika, sin Supabase.

## Arquitectura

```text
GitHub (solo código fuente)
        ↓
Cloudflare Workers Builds
        ↓
Cloudflare Worker + Static Assets
        ├── D1 → canciones, álbumes, artistas
        └── R2 → MP3, portadas y fotos
```

La web, la API y los archivos se sirven desde el mismo dominio `workers.dev`. No hace falta GitHub Pages.

## Incluye

- PWA instalable en móvil.
- Reproducción en segundo plano mediante `<audio>` + Media Session.
- Soporte HTTP Range desde R2 para seek y reproducción con pantalla bloqueada.
- Canciones, álbumes, colaboraciones y perfiles de artista.
- Subida múltiple de álbumes.
- Edición y borrado de canciones y álbumes.
- Añadir/eliminar canciones de álbumes existentes.
- Fotos y biografías de artista editables desde la web.
- Buscador por canción, álbum y artista.
- Aleatorio, bucle, anterior/siguiente y reproducción continua tipo radio.
- Carga progresiva de la lista de canciones (50 en 50).
- Modo edición protegido con contraseña guardada como secret de Cloudflare.
- Medidor de almacenamiento y límite preventivo de 9 GiB para intentar mantenerse por debajo de los 10 GB-mes gratuitos de R2.
- Sin estadísticas, letras, compartir, destacados, fechas editables ni descripciones de álbum.

## Importante

Este proyecto **no contiene MP3 ni fotos personales**. Arranca vacío y el contenido se sube desde la propia aplicación.

Lee primero: **TUTORIAL_MIGRACION_CLOUDFLARE.md**.

## Subidas recuperables
El formulario de álbum guarda un borrador en el mismo navegador con títulos,
colaboradores y archivos pendientes (IndexedDB). Al cerrar y volver a abrir
«Añadir álbum» se recupera. Los archivos completados no se vuelven a transferir;
el archivo que falló se reintenta completo, no por fragmentos.

Si el dispositivo no permite guardar archivos locales, la interfaz lo indica:
los datos y claves completadas se conservan y hay que volver a seleccionar los
audios pendientes tras recargar. Los borradores no se sincronizan entre móviles
o navegadores y pueden perderse al borrar los datos del sitio.

Cada archivo y álbum usa un UUID de subida para resolver reintentos cuya
respuesta se perdió. La publicación del álbum mantiene la transacción D1; no
requiere migración de esquema. «Descartar borrador» elimina los archivos de esa
subida que no estén referenciados, y comprueba primero si el álbum ya se publicó.

Los iconos de instalación están en `public/icons/`: PNG de 192/512 px,
512 px apto para recorte maskable y apple-touch-icon de 180 px.
