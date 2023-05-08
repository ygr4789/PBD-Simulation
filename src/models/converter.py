import os
import pymesh
import json
import numpy as np
import argparse
import pathlib

parser = argparse.ArgumentParser(
    description='convert msh file into json format')
parser.add_argument('filename')
parser.add_argument('-s', '--scale', type=float, default=1.0)
parser.add_argument('-l', '--length', type=float)
parser.add_argument('-o', '--output')
parser.add_argument('-d', '--directory', default='./')

if __name__ == '__main__':
    args = parser.parse_args()
    mesh = pymesh.load_mesh(args.filename)

    if (args.output == None):
        suffix = '.json'
        filename = pathlib.Path(args.filename).name
        args.output = pathlib.PurePath(args.directory).joinpath(
            filename).with_suffix(suffix)

    data = {}
    data['name'] = args.filename
    data['tetIds'] = np.concatenate(mesh.voxels).tolist()
    data['tetSurfaceTriIds'] = np.concatenate(mesh.faces).tolist()

    attribute = np.transpose(mesh.vertices)
    minY = np.min(attribute[1])
    minArr = np.min(attribute, axis=1)
    maxArr = np.max(attribute, axis=1)
    boundingSize = maxArr - minArr
    scale = args.scale
    L = np.linalg.norm(boundingSize)
    if(args.length != None):
        scale = args.length / L

    addToVert = np.array([(minArr[0]+maxArr[0])/2, minY,
                         (minArr[2]+maxArr[2])/2] * mesh.num_vertices)
    data['verts'] = ((np.concatenate(mesh.vertices)-addToVert)
                     * scale).tolist()

    tetIds = mesh.voxels.tolist()
    edgeList = []
    for ids in tetIds:
        edgeList.append(tuple(set([ids[0], ids[1]])))
        edgeList.append(tuple(set([ids[0], ids[2]])))
        edgeList.append(tuple(set([ids[0], ids[3]])))
        edgeList.append(tuple(set([ids[1], ids[2]])))
        edgeList.append(tuple(set([ids[1], ids[3]])))
        edgeList.append(tuple(set([ids[2], ids[3]])))
    edgeList = list(set(edgeList))
    edgeIds = []
    for edge in edgeList:
        edgeIds.append(edge[0])
        edgeIds.append(edge[1])

    data['tetEdgeIds'] = edgeIds

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w') as output:
        output.write(json.dumps(data))
