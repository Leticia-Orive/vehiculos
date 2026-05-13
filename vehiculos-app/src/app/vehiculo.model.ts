/**
 * Modelo base de vehículo usado en catálogo, detalle, carrito y checkout.
 * Centraliza el contrato de datos para mantener tipado consistente en toda la app.
 */
export interface Vehiculo {
  id: number;
  marca: string;
  modelo: string;
  // Ruta pública de la imagen (se sirve desde /public).
  imagen: string;
  anio: number;
  color: string;
  precio: number;
  tipo: 'auto' | 'camioneta' | 'moto' | 'camion';
  disponible: boolean;
  // Datos opcionales para filtros/comparaciones técnicas.
  cilindrada?: number;
  potencia?: number;
}
