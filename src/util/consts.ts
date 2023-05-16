import { Color } from "three";
import { brightColor } from "./color";

export const boundX = 0.251;
export const boundZ = 1.8;

const P = Math.PI
export const cycle_num = 7;
//num - I,L,J,O,T,S,Z
export const pre_dec_shape = [4, 0, 2, 3, 6, 4, 0]; // TIJOZTI
export const pre_dec_Y = [1.5, 1.5, 1.5, 1.5, 2.1, 3.0, 3.3];
export const pre_dec_Z = [-1, 0, 0, 0, 0.7, -0.4, 0.3];
export const pre_dec_theta = [0, 0, 0, 0, 0, 1.5*P, 0];
export const pre_dec_frame = [0, 145, 800, 1000, 1525, 1800, 2200]
export const pre_dec_color = [
  brightColor(280),// new Color(0x8120B1),  // purple
  brightColor(195),// new Color(0x2EB5D0), // cyan
  brightColor(220),// new Color(0x0341AE), // blue
  brightColor(55),// new Color(0xFFD500), // yellow
  brightColor(100),// new Color(0x72CB3B), // green
  brightColor(35),// new Color(0xFF971C), // orange
  brightColor(5),// new Color(0xFF3213), // red
]