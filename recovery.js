// Normalize legacy double-fragment links before Supabase reads the callback.
(() => {
  const hash = location.hash;
  const tokenStart = hash.indexOf('access_token=');
  if (tokenStart > 1) history.replaceState(null, '', location.pathname + location.search + '#' + hash.slice(tokenStart));
  const params = new URLSearchParams(location.hash.slice(1));
  const recoveryLink = params.get('type') === 'recovery';
  const failedLink = params.has('error') || params.has('error_code');
  window.initializeSolarisRecovery = client => {
    const form = document.getElementById('recoveryForm');
    const message = document.getElementById('recoveryMessage');
    const submit = document.getElementById('recoverySubmit');
    let ready = false;
    const show = () => { location.hash = 'recuperar'; };
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        ready = true;
        submit.disabled = false;
        message.textContent = 'Escribe y confirma tu nueva contraseña.';
        history.replaceState(null, '', location.pathname + location.search + '#recuperar');
        window.dispatchEvent(new Event('hashchange'));
      }
    });
    if (recoveryLink || failedLink) {
      // Wait for Supabase to consume tokens before cleaning the address bar.
      client.auth.getSession().then(({data, error}) => {
        if (recoveryLink && !error && data.session) {
          ready = true;
          submit.disabled = false;
          message.textContent = 'Escribe y confirma tu nueva contraseña.';
        } else {
          message.textContent = 'El enlace venció o no es válido. Solicita uno nuevo desde Mi cuenta.';
        }
        history.replaceState(null, '', location.pathname + location.search + '#recuperar');
        window.dispatchEvent(new Event('hashchange'));
      });
    }
    form.onsubmit = async event => {
      event.preventDefault();
      if (!ready) { message.textContent = 'Solicita un enlace nuevo desde Mi cuenta.'; return; }
      const password = document.getElementById('recoveryPassword').value;
      if (password.length < 8) { message.textContent = 'Usa al menos 8 caracteres.'; return; }
      if (password !== document.getElementById('recoveryConfirm').value) { message.textContent = 'Las contraseñas no coinciden.'; return; }
      submit.disabled = true;
      message.textContent = 'Guardando…';
      try {
        const {error} = await client.auth.updateUser({password});
        if (error) { message.textContent = 'No se pudo cambiar. Prueba otra contraseña o solicita un enlace nuevo.'; submit.disabled = false; return; }
        ready = false;
        form.reset();
        await client.auth.signOut();
        message.textContent = 'Contraseña actualizada. Ya puedes ingresar con tu nueva contraseña.';
      } catch {
        message.textContent = 'No se pudo conectar. Inténtalo nuevamente.';
        submit.disabled = false;
      }
    };
    document.getElementById('resetPasswordButton').onclick = async () => {
      const email = document.getElementById('customerAccountEmail').value.trim();
      const status = document.getElementById('customerAuthMessage');
      if (!email) { status.textContent = 'Escribe primero tu correo electrónico.'; return; }
      const {error} = await client.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname});
      status.textContent = error ? 'No se pudo enviar el enlace. Inténtalo nuevamente.' : 'Si el correo está registrado, recibirás el enlace. Revisa también Spam.';
    };
  };
})();
