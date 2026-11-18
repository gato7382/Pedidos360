import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

async function bootstrap(): Promise<void> {
  const hasSecureCrypto =
    window.isSecureContext &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined';

  if (hasSecureCrypto) {
    const { AppModule } = await import('./app/app.module');
    await platformBrowserDynamic().bootstrapModule(AppModule);
    return;
  }

  const { InsecureOriginModule } = await import('./app/insecure-origin.module');
  await platformBrowserDynamic().bootstrapModule(InsecureOriginModule);
}

bootstrap().catch((error: unknown) => console.error(error));
