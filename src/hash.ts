import { Vector3 } from "three";

export class SpatialHash {
  spacing: number;
  tableSize: number;
  countTable: Array<number>;
  particleTable: Array<number>;
  numParticles: number;

  constructor(spacing_: number, tableSize_: number, numParticles_: number) {
    this.spacing = spacing_;
    this.tableSize = tableSize_;
    this.numParticles = numParticles_;
    this.countTable = Array(tableSize_ + 1);
    this.particleTable = Array(this.numParticles);
  }

  hash(v: Vector3) {
    let h = (this.index(v.x) * 92837111) ^ (this.index(v.y) * 689287499) ^ (this.index(v.z) * 283923481);
    return Math.abs(h) % this.tableSize;
  }

  index(x: number) {
    return Math.floor(x / this.spacing);
  }

  update(positions: Array<Vector3>) {
    this.numParticles = positions.length;
    this.countTable.fill(0);
    
    for (let i = 0; i < this.numParticles; i++) {
      this.countTable[this.hash(positions[i])]++;
    }
    for (let i = 0; i < this.tableSize; i++) {
      this.countTable[i + 1] += this.countTable[i];
    }
    for (let i = 0; i < this.numParticles; i++) {
      this.particleTable[this.countTable[this.hash(positions[i])]--] = i;
    }
  }

  // return the indices of points whose distance from v is within closer than dist
  query(v: Vector3, dist: number) {
    let xMin = this.index(v.x - dist);
    let yMin = this.index(v.y - dist);
    let zMin = this.index(v.z - dist);
    let xMax = this.index(v.x + dist);
    let yMax = this.index(v.y + dist);
    let zMax = this.index(v.z + dist);

    let ret: Array<number | undefined> = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        for (let z = zMin; z <= zMax; z++) {
          let h = this.hash(new Vector3(x, y, z));
          let begin = this.countTable[h];
          let end = this.countTable[h + 1];
          for (let k = begin; k < end; k++) {
            ret.push(this.particleTable[k]);
          }
        }
      }
    }
    return ret;
  }
}
