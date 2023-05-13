import { Color } from "three";

export function randomColor() {
  return new Color(`hsl(${getRandomInt(0, 360)}, 100%, 50%)`)
}

function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}