interface RuntimeConfig {
  clientId: string;
  tenantId: string;
  scope: string;
  apiBaseUrl: string;
}

declare global {
  interface Window {
    PEDIDOS360_CONFIG?: RuntimeConfig;
  }
}

export const runtimeConfig = window.PEDIDOS360_CONFIG ?? {
  clientId: 'd0b2e05c-58b9-4d02-aade-281d22bb3074',
  tenantId: '1a1fed8a-8960-4a10-95a1-f9d77a98832a',
  scope: 'api://d0b2e05c-58b9-4d02-aade-281d22bb3074/access_as_user',
  apiBaseUrl: ''
};

export const apiBaseUrl = (runtimeConfig.apiBaseUrl || window.location.origin).replace(/\/+$/, '');
export const redirectPath = '/redirect';
