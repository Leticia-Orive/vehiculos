export interface Vehiculo {
  id: number;
  marca: string;
  modelo: string;
  anio: number;
  color: string;
  precio: number;
  tipo: 'auto' | 'camioneta' | 'moto' | 'camion';
  disponible: boolean;
}
