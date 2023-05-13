export function record(canvas: HTMLCanvasElement, time: number = 4000) {
  let recordedChunks: Array<Blob> = [];
  return new Promise(function (res, rej) {
    let  stream = canvas.captureStream(25 /*fps*/);
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