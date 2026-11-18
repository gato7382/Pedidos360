import { Component, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: `
    <main class="secure-origin-page">
      <section class="secure-origin-card">
        <p class="secure-origin-eyebrow">Pedidos360 · Inicio seguro</p>
        <h1>Esta dirección no permite iniciar sesión</h1>
        <p>
          Microsoft Entra ID necesita las funciones criptográficas del navegador.
          Estas funciones están disponibles en <strong>localhost</strong> para desarrollo
          y en direcciones <strong>HTTPS</strong> para la nube; no funcionan desde una IP
          abierta con HTTP.
        </p>
        <div class="secure-origin-options">
          <p><strong>Prueba local:</strong> abre <code>http://localhost:4200</code> en este computador.</p>
          <p><strong>Prueba en AWS:</strong> abre el Invoke URL <code>https://…execute-api…</code> de API Gateway.</p>
        </div>
        <p class="secure-origin-current">Dirección actual: <code>{{ currentOrigin }}</code></p>
      </section>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; font-family: Arial, sans-serif; color: #192333; }
    .secure-origin-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f2f4f1; }
    .secure-origin-card { width: min(680px, 100%); padding: clamp(24px, 6vw, 48px); border-radius: 18px; background: white; box-shadow: 0 18px 60px #15223818; }
    .secure-origin-eyebrow { color: #9a6b1d; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 16px 0; color: #142238; font-size: clamp(30px, 6vw, 46px); line-height: 1.08; }
    p { line-height: 1.65; }
    .secure-origin-options { margin-top: 24px; padding: 16px 20px; border-left: 3px solid #d8a84d; background: #f8f7f2; }
    code { overflow-wrap: anywhere; color: #31465d; }
    .secure-origin-current { margin-top: 24px; color: #667180; font-size: 13px; }
  `]
})
class InsecureOriginComponent {
  readonly currentOrigin = window.location.origin;
}

@NgModule({
  imports: [BrowserModule],
  declarations: [InsecureOriginComponent],
  bootstrap: [InsecureOriginComponent]
})
export class InsecureOriginModule {}
