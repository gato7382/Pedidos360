import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MsalService } from '@azure/msal-angular';
import { ApiService, AuditEvent, Order, Product, RabbitAuditEvent, ReportSummary, Topic } from './api.service';

const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  CREADO: ['ACEPTADO', 'CANCELADO'],
  ACEPTADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['DESPACHADO', 'CANCELADO'],
  DESPACHADO: ['ENTREGADO']
};

@Component({
  standalone: false,
  selector: 'app-workspace',
  templateUrl: './workspace.component.html'
})
export class WorkspaceComponent implements OnInit {
  activeTab = 'pedidos';
  busy = false;
  updatingOrders = new Set<string>();
  message = '';
  products: Product[] = [];
  orders: Order[] = [];
  auditEvents: AuditEvent[] = [];
  rabbitEvents: RabbitAuditEvent[] = [];
  timelineEvents: AuditEvent[] = [];
  topics: Topic[] = [];
  summary?: ReportSummary;
  productForm = { name: '', category: '', description: '', price: 0 };
  selectedProductId = '';
  quantity = 1;
  commune = '';
  branchId = 'SUC-01';

  constructor(private readonly api: ApiService, private readonly msal: MsalService) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadOrders();
  }

  get userId(): string {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0];
    return account?.localAccountId || account?.username || '';
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    this.message = '';
    if (tab === 'catalogo') this.loadProducts();
    if (tab === 'pedidos') this.loadOrders();
    if (tab === 'auditoria') {
      this.api.audit().subscribe({ next: rows => this.auditEvents = rows, error: e => this.showError(e) });
      this.api.rabbitAudit().subscribe({ next: rows => this.rabbitEvents = rows, error: e => this.showError(e) });
      this.api.auditTimeline().subscribe({ next: rows => this.timelineEvents = rows, error: e => this.showError(e) });
    }
    if (tab === 'reportes') {
      this.api.reports().subscribe({ next: value => this.summary = value, error: e => this.showError(e) });
    }
    if (tab === 'administracion') {
      this.api.topics().subscribe({ next: rows => this.topics = rows, error: e => this.showError(e) });
    }
  }

  loadProducts(): void {
    this.api.products().subscribe({ next: rows => this.products = rows, error: e => this.showError(e) });
  }

  loadOrders(): void {
    this.api.orders().subscribe({ next: rows => this.orders = rows, error: e => this.showError(e) });
  }

  createProduct(): void {
    this.busy = true;
    this.api.createProduct(this.productForm).subscribe({
      next: () => {
        this.message = 'Producto guardado.';
        this.productForm = { name: '', category: '', description: '', price: 0 };
        this.busy = false;
        this.loadProducts();
      },
      error: e => { this.showError(e); this.busy = false; }
    });
  }

  createOrder(): void {
    if (!this.selectedProductId || !this.userId || !Number.isInteger(this.quantity) || this.quantity < 1) {
      this.message = 'Elige un producto y escribe una cantidad entera mayor que cero.';
      return;
    }
    this.busy = true;
    this.api.createOrder({
      customerId: this.userId,
      actorUserId: this.userId,
      channel: 'APP',
      commune: this.commune || 'Providencia',
      branchId: this.branchId,
      items: [{ productId: this.selectedProductId, quantity: this.quantity }]
    }).subscribe({
      next: () => {
        this.message = 'Pedido creado. Su evento quedó en cola para Kafka y RabbitMQ.';
        this.busy = false;
        this.loadOrders();
      },
      error: e => { this.showError(e); this.busy = false; }
    });
  }

  changeState(order: Order, event: Event): void {
    const selection = event.target as HTMLSelectElement;
    const state = selection.value;
    selection.value = '';
    if (!this.userId || !this.transitions(order).includes(state) || this.updatingOrders.has(order.id)) return;
    this.updatingOrders.add(order.id);
    this.api.setState(order.id, state, this.userId).subscribe({
      next: updated => {
        this.updatingOrders.delete(order.id);
        this.orders = this.orders.map(row => row.id === updated.id ? updated : row);
        this.message = 'Estado actualizado. El evento quedó en cola para Kafka y RabbitMQ.';
      },
      error: error => {
        this.updatingOrders.delete(order.id);
        this.showError(error);
      }
    });
  }

  transitions(order: Order): readonly string[] {
    return ORDER_TRANSITIONS[order.state] ?? [];
  }

  private showError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.message = 'El API rechazó la sesión. Vuelve a ingresar con Microsoft.';
        return;
      }
      if (error.status === 403) {
        this.message = 'Tu cuenta no tiene permisos para esta operación.';
        return;
      }
      if (error.status >= 400 && error.status < 500 && typeof error.error?.detail === 'string') {
        this.message = error.error.detail;
        return;
      }
    }
    this.message = 'No se pudo completar la solicitud. Revisa la conexión con el API e inténtalo de nuevo.';
  }
}
