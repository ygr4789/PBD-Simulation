import * as JSZip from "jszip";
import { saveAs } from "file-saver";

export class zipFileSaver {
  count: number;
  zip: JSZip;
  constructor() {
    this.count = 0;
    this.zip = new JSZip();
  }
  store(canvas: HTMLCanvasElement) {
    let dataURL = canvas.toDataURL("image/png", 1.0);
    let base64Data = dataURL.split(";base64,")[1];
    this.zip?.file(`PBD${++this.count}.png`, base64Data, { base64: true });
    if(this.count % 100 === 0) {
      this.save();
      this.flush();
    }
  }
  save() {
    this.zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, "PBD_SequntialCapture.zip");
    });
  }
  flush() {
    this.zip = new JSZip();
  }
}

export function captureCanvas(canvas: HTMLCanvasElement) {
  canvas.toBlob((blob: Blob) => {
    saveAs(blob, "PBD_image" + ".png");
  });
}

export function recordCanvas(canvas: HTMLCanvasElement, time: number) {
  const recording = record(canvas, time);
  // play it on another video element
  let video$ = document.createElement("video");
  recording.then((url: string) => video$.setAttribute("src", url));
  // download it
  let link$ = document.createElement("a");
  link$.setAttribute("download", "PBD_video");
  recording.then((url: string) => {
    link$.setAttribute("href", url);
    link$.click();
  });
}

function record(canvas: HTMLCanvasElement, time: number) {
  let recordedChunks: Array<Blob> = [];
  return new Promise(function (res, rej) {
    let stream = canvas.captureStream(25 /*fps*/);
    let mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm; codecs=vp9",
    });

    //ondataavailable will fire in interval of `time`
    mediaRecorder.start(time);

    mediaRecorder.ondataavailable = function (event) {
      recordedChunks.push(event.data);
      // after stop `dataavilable` event run one more time
      if (mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
    };

    mediaRecorder.onstop = function (event) {
      let blob = new Blob(recordedChunks, { type: "video/webm" });
      let url = URL.createObjectURL(blob);
      res(url);
    };
  });
}
