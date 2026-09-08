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

## Preparación de Supabase

- `supabase-config.js` contiene únicamente la URL y la clave pública del proyecto.
- `supabase-setup.sql` crea las tablas, el cálculo protegido de pedidos y las políticas RLS.
- El administrador autorizado es `jbuezo0@gmail.com`.
- Nunca deben guardarse aquí claves `sb_secret_` ni `service_role`.
