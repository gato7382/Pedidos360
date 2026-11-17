import { Component, OnInit } from '@angular/core';
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

@Component({
  standalone: false,
  selector: 'app-auth-redirect',
  template: '<p class="empty" role="status">{{ message }}</p>'
})
export class RedirectComponent implements OnInit {
  message = 'Procesando la respuesta de Microsoft…';

  ngOnInit(): void {
    void broadcastResponseToMainFrame().catch(() => {
      this.message = 'Abre la página de inicio de Pedidos360 para ingresar.';
    });
  }
}
