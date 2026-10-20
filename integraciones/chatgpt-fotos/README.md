# Fotos desde ChatGPT: estado y configuración

La función `solaris-chatgpt-fotos` recibe referencias de archivos de una acción de GPT y devuelve URLs de Storage. No modifica productos, pedidos, usuarios ni otros proyectos. La integración general de Supabase no obtiene esta acción automáticamente.

## Activación pendiente

1. En Supabase, proyecto **Solaris GT**, abre **Edge Functions > Secrets**. Genera con un gestor de contraseñas una clave aleatoria de al menos 32 caracteres. Guárdala como `SOLARIS_CHATGPT_UPLOAD_KEY`. No uses la clave service_role, la contraseña de tu cuenta ni la clave pública. No envíes la clave por chat ni la guardes en GitHub.
2. En el editor web de un GPT personalizado privado, añade una acción importando `openapi.json`. Configura autenticación **API Key > Bearer**, con esa misma clave. Si tu cuenta no permite crear GPTs o acciones, no está disponible este procedimiento: no afirmar que funciona en un chat normal.
3. Usa `https://solarisiluminacion.com/privacidad.html` como política de privacidad si el editor la solicita. Mantén el GPT privado.
4. Abre ese GPT desde el teléfono con la misma cuenta, adjunta una foto de prueba de un producto y autoriza enviarla a Solaris. Verifica que devuelve una URL y abre la imagen. Las fotos serán públicas; nunca adjuntes patentes, identificaciones o documentos privados.
5. Para crear el producto con las URLs, usa la integración Supabase en un chat que disponga de ella. Esta primera acción solo resuelve la carga de fotos; no automatiza el alta del producto en el GPT personalizado.

## Instrucciones para el GPT

Recibe exclusivamente fotografías de productos de Solaris. Pide nombre, precio GTQ y disponibilidad. No inventes potencia real, autonomía, capacidad ni certificaciones a partir del nombre comercial. Explica que al enviar las fotos quedarán públicamente accesibles. Antes de usar la acción pide confirmación. Usa únicamente archivos adjuntos y sus referencias reales; no inventes download_link ni URLs. Tras recibir image_urls, informa que solo se guardaron fotos y que el producto aún no está publicado. Si la acción falla, explica el error y no afirmes que guardaste nada.

## Seguridad y límites

- Sin secreto configurado responde 503: no permite cargas anónimas.
- Comprueba la clave en el servidor; la clave de servicio nunca sale al navegador.
- Solo descarga HTTPS de `files.oaiusercontent.com`, sin redirecciones, con límite de bytes y tiempo.
- Valida las cabeceras reales de JPG, PNG, GIF y WebP; rechaza SVG, PDF y otros archivos.
- Usa nombres aleatorios, nunca sobrescribe fotos existentes y limpia las subidas parciales de la misma solicitud cuando es posible.
- Para revocar el acceso elimina o cambia el secreto; actualiza la acción para volver a conectarla.
- No tiene cuota diaria ni límite por usuario: mantén la clave privada y vigila el consumo de Storage. No publiques el GPT ni compartas la clave.

## Verificación local

`node --test integraciones/chatgpt-fotos/upload.test.mjs`
