# Opcional — Añadir Cloudflare Access más adelante

La versión principal no exige dominio y funciona gratis en `workers.dev` con una contraseña compartida guardada como Worker Secret.

Si más adelante ya tienes un dominio gestionado por Cloudflare, puedes poner Cloudflare Access delante de la aplicación para añadir autenticación por identidad/email.

Esquema recomendado:

```text
app.tudominio.com
      ↓
Cloudflare Access
      ↓
New BenifaClika Worker
```

Puedes usar One-time PIN y permitir solamente los correos de los miembros del grupo.

Documentación oficial:

- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/
- https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/

Si activas Access, puedes mantener también la contraseña interna como segunda capa o retirarla después de comprobar que Access está configurado correctamente.
