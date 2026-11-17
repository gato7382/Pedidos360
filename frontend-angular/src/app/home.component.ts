import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import { InteractionStatus } from '@azure/msal-browser';
import { map } from 'rxjs';
import { runtimeConfig } from './runtime-config';

@Component({
  standalone: false,
  selector: 'app-home',
  template: `
    <main class="hero">
      <div class="eyebrow">OPERACIÓN Y TRAZABILIDAD</div>
      <h1>Cada pedido,<br><em>en movimiento.</em></h1>
      <p>Gestiona el catálogo, sigue los pedidos y consulta la actividad que procesan Kafka y RabbitMQ.</p>
      <div class="actions">
        <button class="primary" [disabled]="!(canSignIn | async)" (click)="enter()">Ingresar con Microsoft</button>
        <span>Acceso con Entra ID</span>
      </div>
      <p *ngIf="loginError || (route.queryParamMap | async)?.has('auth')" role="alert">
        No se pudo iniciar sesión. Intenta ingresar nuevamente.
      </p>
      <div class="signals">
        <div><b>01</b><span>Catálogo y pedidos</span></div>
        <div><b>02</b><span>Eventos distribuidos</span></div>
        <div><b>03</b><span>Auditoría y reportes</span></div>
      </div>
    </main>
  `
})
export class HomeComponent {
  readonly canSignIn = this.broadcast.inProgress$.pipe(map(status => status === InteractionStatus.None));
  loginError = false;

  constructor(
    private readonly msal: MsalService,
    private readonly broadcast: MsalBroadcastService,
    private readonly router: Router,
    readonly route: ActivatedRoute
  ) {}

  enter(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    if (account) {
      void this.router.navigateByUrl('/workspace');
      return;
    }
    this.loginError = false;
    this.msal.loginRedirect({ scopes: [runtimeConfig.scope] }).subscribe({
      error: error => {
        this.loginError = true;
        console.error('Microsoft Entra ID:', error?.errorCode ?? 'login_failed');
      }
    });
  }
}
