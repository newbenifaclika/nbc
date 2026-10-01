# Revisión funcional incluida en esta versión

## Reproducción
- Un único `<audio>` persistente para toda la aplicación.
- Media Session configurada para play, pause, anterior, siguiente, seek ±10 s y seek directo.
- El Worker sirve R2 con soporte de `Range`, `Accept-Ranges` y `Content-Range`.
- El Service Worker ignora `/media/*` y `/api/*` para no romper audio por rangos ni respuestas dinámicas.
- Bucle usa `audio.loop`.
- Aleatorio reconstruye la cola manteniendo la canción actual.
- Álbum/artista: primero reproduce esa selección y después añade canciones del resto de la biblioteca.
- Si un archivo falla, se reintenta una vez con URL nueva y después salta al siguiente.

## Rendimiento
- No hay Supabase Realtime ni refrescos por cada cambio remoto.
- La biblioteca se recarga únicamente después de operaciones de edición o al recuperar conexión.
- Canciones se renderizan 50 en 50.
- Animaciones cortas, sin blur pesado en la interfaz principal.
- Imágenes grandes se reducen a WebP antes de subir.

## PWA
- Service Worker network-first para el shell, evitando quedarse enganchado a versiones antiguas.
- Botón Instalar solo aparece cuando el navegador emite `beforeinstallprompt` y se oculta en modo standalone.
- Manifest e icono genérico incluidos.

## Edición
- Una cuenta compartida mediante `ADMIN_PASSWORD` guardada como Worker Secret.
- Sesión firmada con HMAC, cookie HttpOnly + Secure + SameSite=Strict.
- Los modales no se cierran por hacer clic fuera; solo por sus botones explícitos.
- Canciones individuales no tienen campo álbum/proyecto.
- Canciones de álbum no tienen portada propia.
- Se pueden añadir/eliminar pistas al editar un álbum.
- La fecha de creación se genera en D1 y no se modifica al editar.

## Almacenamiento
- Medidor interno de bytes almacenados.
- Límite preventivo por defecto: 9 GiB.
- Botón Recalcular recorre R2 para corregir el contador.
- Eliminación de objetos R2 únicamente cuando ya no están referenciados por D1.

## No incluido deliberadamente
- Supabase.
- Letras.
- Estadísticas/reproducciones.
- Compartir.
- Destacados.
- Descripciones de álbum.
- Fechas editables.
- MP3 de usuario.
- Fotos personales de usuario.
