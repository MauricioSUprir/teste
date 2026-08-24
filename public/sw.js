// Service worker do EstudaFlow — recebe notificações push e as mostra na tela.

self.addEventListener("push", (event) => {
  let dados = { titulo: "EstudaFlow", corpo: "Você tem pendências de estudo." };
  try {
    dados = event.data.json();
  } catch (e) {
    // payload fora do padrão — usa o texto puro se houver
    if (event.data) dados.corpo = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      tag: "estudaflow-resumo",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) return aba.focus();
      }
      return clients.openWindow("/");
    })
  );
});
