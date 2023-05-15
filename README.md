# PBD-Simulation

[![Demo Video](http://img.youtube.com/vi/9tQFjZhdb7E/0.jpg)](https://youtu.be/9tQFjZhdb7E)

[Demo Link](https://ygr4789.github.io/PBD-Simulation/)

## Convert an OBJ model to JSON format

The `src/models/object` directory stores models in `obj` format. In the `src/models` directory, `make all` command converts those to a tetrahedron mesh and parse it to `.json` format, which is need for this simulatoin. [PyMesh](https://github.com/PyMesh/PyMesh) must be installed.

## How to run local

`npm install` to install all npm dependencies

`npm start` to build and run

The server runs in port `3000`