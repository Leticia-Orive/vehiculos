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
  cilindrada?: number;
  potencia?: number;
}
