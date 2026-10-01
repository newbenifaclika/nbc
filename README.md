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
