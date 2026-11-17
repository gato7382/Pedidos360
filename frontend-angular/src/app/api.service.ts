import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { apiBaseUrl } from './runtime-config';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  products(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/api/products`);
  }

  createProduct(value: ProductInput): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/api/products`, value);
  }

  orders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.baseUrl}/api/orders`);
  }

  createOrder(value: OrderInput): Observable<Order> {
    return this.http.post<Order>(`${this.baseUrl}/api/orders`, value);
  }

  setState(id: string, state: string, actorUserId: string): Observable<Order> {
    return this.http.patch<Order>(`${this.baseUrl}/api/orders/${id}/state`, { state, actorUserId });
  }

  audit(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(`${this.baseUrl}/api/audit/events`);
  }

  rabbitAudit(): Observable<RabbitAuditEvent[]> {
    return this.http.get<RabbitAuditEvent[]>(`${this.baseUrl}/api/audit/rabbit-events`);
  }

  auditTimeline(): Observable<AuditEvent[]> {
    return this.http.get<AuditEvent[]>(`${this.baseUrl}/api/reports/audit-timeline`);
  }

  reports(): Observable<ReportSummary> {
    return this.http.get<ReportSummary>(`${this.baseUrl}/api/reports/summary`);
  }

  topics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${this.baseUrl}/api/admin/kafka/topics`);
  }
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  active: boolean;
}
export type ProductInput = Omit<Product, 'id' | 'active'>;
export interface Order {
  id: string;
  customerId: string;
  state: string;
  total: number;
  items: Array<{ productId: string; name: string; quantity: number }>;
}
export interface OrderInput {
  customerId: string;
  actorUserId: string;
  channel: string;
  commune: string;
  branchId: string;
  items: Array<{ productId: string; quantity: number }>;
}
export interface AuditEvent {
  eventId: string;
  pedidoId: string;
  tipo: string;
  estadoNuevo: string;
  fecha: string;
}
export interface RabbitAuditEvent {
  eventId: string;
  pedidoId: string;
  tipo: string;
  recibidaEn: string;
}
export interface ReportSummary {
  totalPedidos: number;
  entregados: number;
  cancelados: number;
  ventasCreadas: number;
  leadTimePromedioSeg: number;
}
export interface Topic {
  name: string;
  partitions: number;
  minReplicationFactor: number;
  config: Record<string, string>;
}
