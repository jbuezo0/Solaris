# Fotos desde ChatGPT: estado y configuración

La función `solaris-chatgpt-fotos` carga fotos, prepara borradores ocultos y publica productos aprobados. No modifica pedidos, usuarios ni otros proyectos. La integración general de Supabase no obtiene estas acciones automáticamente.

## Activación pendiente

1. En Supabase, proyecto **Solaris GT**, abre **Edge Functions > Secrets**. Genera con un gestor de contraseñas una clave aleatoria de al menos 32 caracteres. Guárdala como `SOLARIS_CHATGPT_UPLOAD_KEY`. No uses la clave service_role, la contraseña de tu cuenta ni la clave pública. No envíes la clave por chat ni la guardes en GitHub.
2. En el editor web de un GPT personalizado privado, añade una acción importando `openapi.json`. Configura autenticación **API Key > Bearer**, con esa misma clave. Si tu cuenta no permite crear GPTs o acciones, no está disponible este procedimiento: no afirmar que funciona en un chat normal.
3. Usa `https://solarisiluminacion.com/privacidad.html` como política de privacidad si el editor la solicita. Mantén el GPT privado.
4. Abre ese GPT desde el teléfono con la misma cuenta, adjunta una foto de prueba de un producto y autoriza enviarla a Solaris. Verifica que devuelve una URL y abre la imagen. Las fotos serán públicas; nunca adjuntes patentes, identificaciones o documentos privados.
5. Reemplaza el esquema de la acción por la versión actual de `openapi.json` y pega `INSTRUCCIONES-GPT.txt` en las instrucciones del GPT. Deben aparecer tres acciones: `uploadSolarisProductPhotos`, `prepareSolarisProduct` y `publishSolarisProduct`. Conserva la misma clave privada y el GPT privado.
6. Prueba primero la carga y preparación de un borrador. Verifica nombre, precio, fotos, descripción y disponibilidad; el borrador no debe aparecer en el catálogo público. Publica solamente con aprobación del propietario y verifica la respuesta `published: true` y la tienda.

## Borradores y publicación

Publicación directa: `/create` recibe los datos y las URLs de fotos cargadas, exige `confirmed=true` y realiza la preparación y publicación en una sola solicitud. Es la acción `createAndPublishSolarisProduct`, usada cuando el propietario pide publicar ese producto. Los pedidos de prueba o solo borrador siguen sin publicarse. El GPT debe actualizar su esquema e instrucciones para ver esta cuarta acción. El diálogo de autorización de ChatGPT se conserva.

`/draft` valida las imágenes existentes del almacenamiento de Solaris y guarda `active=false`. Los mismos datos producen un identificador estable y no crean duplicados al reintentar. Los cambios generan otro borrador; el anterior permanece oculto, no se borra automáticamente.

`/publish` exige aprobación explícita (`confirmed=true`) y una firma de la vista previa, válida por 24 horas. La firma cubre todos los datos mostrados. Si el producto cambió, exige nueva vista previa. Una actualización concurrente detectada impide publicar datos distintos. La acción está marcada como consecuencial para que ChatGPT solicite autorización. La interfaz y las instrucciones del GPT deben mostrar la vista previa; el servidor no puede comprobar por sí solo las palabras del usuario.

Quien posee la clave puede subir imágenes y gestionar esta publicación: mantener el GPT privado. Esta clave ahora autoriza los tres pasos; no compartirla. La función no permite editar ni borrar productos ya publicados.

## Instrucciones para el GPT

Usa el contenido completo de `INSTRUCCIONES-GPT.txt`.

## Seguridad y límites

- Sin secreto configurado responde 503: no permite cargas anónimas.
- Comprueba la clave en el servidor; la clave de servicio nunca sale al navegador.
- Solo descarga HTTPS de `files.oaiusercontent.com` y `sdmntprcentralus.oaiusercontent.com` (servidor observado en la prueba), sin redirecciones, con límite de bytes y tiempo. No se permiten dominios arbitrarios ni todos los subdominios.
- Valida las cabeceras reales de JPG, PNG, GIF y WebP; rechaza SVG, PDF y otros archivos.
- Usa nombres aleatorios, nunca sobrescribe fotos existentes y limpia las subidas parciales de la misma solicitud cuando es posible.
- Para revocar el acceso elimina o cambia el secreto; actualiza la acción para volver a conectarla.
- No tiene cuota diaria ni límite por usuario: mantén la clave privada y vigila el consumo de Storage. No publiques el GPT ni compartas la clave.

## Verificación local

`node --test integraciones/chatgpt-fotos/upload.test.mjs`
