// Constantes do mundo (compartilhadas entre worker e thread principal).
export const WORLD = {
  seed: 20260927,
  size: 2048, // m (área jogável: -1024..1024)
  res: 2049, // amostras por lado (1 m)
  farSize: 20480, // m do anel distante (só visual)
  farRes: 321,
  latitudeDeg: 18.44, // Jezero
  eastLonDeg: 77.45,
  gravity: 3.721,
};

export interface Crater { x: number; z: number; r: number; depth: number; rim: number; age: number }
export interface TerrainData {
  heights: Float32Array; // res*res, linha = z
  far: Float32Array; // farRes*farRes
  craters: Crater[];
  minH: number;
  maxH: number;
}
