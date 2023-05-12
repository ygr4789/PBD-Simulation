export class SpatialHash {
  positions: Float32Array;
  spacing: number;
  table_size: number;
  count_table: Array<number>;
  particle_table: Array<number>;
  particle_num: number;

  constructor(positions_: Float32Array, spacing_: number, tableSize_: number) {
    this.positions = positions_;
    this.spacing = spacing_;
    this.table_size = tableSize_;
    this.particle_num = positions_.length / 3;
    this.count_table = Array(tableSize_ + 1);
    this.particle_table = Array(this.particle_num);
  }

  hashOf(v: Float32Array, i: number) {
    let h = (this.index(v[3 * i]) * 92837111) ^ (this.index(v[3 * i + 1]) * 689287499) ^ (this.index(v[3 * i + 2]) * 283923481);
    return Math.abs(h) % this.table_size;
  }
  hash(x: number, y: number, z: number) {
    let h = (x * 92837111) ^ (y * 689287499) ^ (z * 283923481);
    return Math.abs(h) % this.table_size;
  }

  index(x: number) {
    return Math.floor(x / this.spacing);
  }

  update() {
    this.count_table.fill(0);

    for (let i = 0; i < this.particle_num; i++) {
      this.count_table[this.hashOf(this.positions, i)]++;
    }
    for (let i = 0; i < this.table_size; i++) {
      this.count_table[i + 1] += this.count_table[i];
    }
    for (let i = 0; i < this.particle_num; i++) {
      this.particle_table[--this.count_table[this.hashOf(this.positions, i)]] = i;
    }
  }

  // return the indices of points whose distance from v is within closer than dist
  query(v: Float32Array, i: number, dist: number) {
    let xMin = this.index(v[3 * i] - dist);
    let yMin = this.index(v[3 * i + 1] - dist);
    let zMin = this.index(v[3 * i + 2] - dist);
    let xMax = this.index(v[3 * i] + dist);
    let yMax = this.index(v[3 * i + 1] + dist);
    let zMax = this.index(v[3 * i + 2] + dist);

    let ret: Array<number> = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        for (let z = zMin; z <= zMax; z++) {
          let h = this.hash(x, y, z);
          let begin = this.count_table[h];
          let end = this.count_table[h + 1];
          for (let k = begin; k < end; k++) {
            ret.push(this.particle_table[k]);
          }
        }
      }
    }
    return ret;
  }
}
