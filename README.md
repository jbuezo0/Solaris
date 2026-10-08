# Solaris GT

Sitio independiente para venta de lámparas solares, iluminación y decoración.

## Uso local

Abra `index.html` en un navegador. La tienda funciona sin instalación.

El administrador solicita crear una contraseña la primera vez. Los productos y la contraseña se guardan únicamente en el navegador del dispositivo mediante almacenamiento local. Esta modalidad es apropiada para revisar y administrar una versión local, pero antes de publicar un administrador accesible desde Internet deberá conectarse a autenticación y base de datos independientes.

## Datos del negocio

- WhatsApp: +502 5272 8320
- Correo: solarisgt@gmail.com
- Dirección: Esquipulas, zona 1, 6.ª avenida, 4-51
- Repositorio previsto: `solarisgt`

Los productos actuales son demostrativos y pueden reemplazarse desde el administrador.

## Catálogo ampliado y cuentas

- La tienda incluye búsqueda, categorías, ordenamiento por precio o nombre y diseño responsivo.
- Los clientes pueden registrarse, iniciar sesión y solicitar recuperación de contraseña desde `Mi cuenta`.
- El administrador puede guardar marca, modelo, precio anterior, precio actual, etiqueta, disponibilidad y garantía.
- En un proyecto Supabase creado con la primera versión, ejecute `MIGRACION_CATALOGO_Y_CUENTAS.sql` una sola vez desde **SQL Editor** antes de guardar productos con los campos nuevos.
- Para varias imágenes por producto, ejecute una sola vez `MIGRACION_VARIAS_IMAGENES.sql` en **SQL Editor**.
- El acceso con Google y Facebook requiere activar ambos proveedores en **Supabase > Authentication > Providers** y agregar `https://jbuezo0.github.io/Solaris/` en **Authentication > URL Configuration > Redirect URLs**.

## Preparación de Supabase

- `supabase-config.js` contiene únicamente la URL y la clave pública del proyecto.
- `supabase-setup.sql` crea las tablas, el cálculo protegido de pedidos y las políticas RLS.
- El administrador autorizado es `jbuezo0@gmail.com`.
- Nunca deben guardarse aquí claves `sb_secret_` ni `service_role`.
