import { SVD } from "svd-js";

// We need to redefine these inside the worker because
// workers don't have access to functions in App.js
function computeSVDFromChannel(channel, m, n) {
  let matrix = new Array(m);
  for (let i = 0; i < m; i++) {
    matrix[i] = Array.from(channel.slice(i * n, (i + 1) * n));
  }

  let transposed = false;
  if (m < n) {
    const temp = new Array(n);
    for (let i = 0; i < n; i++) {
      temp[i] = new Array(m);
      for (let j = 0; j < m; j++) temp[i][j] = matrix[j][i];
    }
    matrix = temp;
    transposed = true;
  }

  const { u, q, v } = SVD(matrix);
  const sortedIndices = q.map((val, idx) => idx).sort((a, b) => q[b] - q[a]);

  const qSorted = sortedIndices.map(i => q[i]);
  const uSorted = u.map(row => sortedIndices.map(i => row[i]));
  const vSorted = v.map(row => sortedIndices.map(i => row[i]));

  let U_data, S_data, Vt_data, r = qSorted.length;

  if (!transposed) {
    U_data = uSorted.flat();
    S_data = Array.from(qSorted);
    Vt_data = new Float32Array(r * n);
    for (let i = 0; i < r; i++)
      for (let j = 0; j < n; j++)
        Vt_data[i * n + j] = vSorted[j][i];
  } else {
    U_data = vSorted.flat();
    S_data = Array.from(qSorted);
    Vt_data = new Float32Array(r * n);
    for (let i = 0; i < r; i++)
      for (let j = 0; j < n; j++)
        Vt_data[i * n + j] = uSorted[j][i];
  }

  // We return raw data because ndarray objects can't be easily "cloned"
  // across the worker boundary. We will rebuild the ndarray in the main thread.
  return { U_data, S_data, Vt_data, m, n, r };
}

self.onmessage = function(e) {
  const { channels, width, height, isColor } = e.data;
  const results = {};

  if (isColor) {
    const colors = ['1', '2', '3'];
    channels.forEach((ch, idx) => {
      const res = computeSVDFromChannel(ch, height, width);
      results[`U${colors[idx]}`] = res.U_data;
      results[`S${colors[idx]}`] = res.S_data;
      results[`Vt${colors[idx]}`] = res.Vt_data;
    });
  } else {
    const res = computeSVDFromChannel(channels[0], height, width);
    results.U = res.U_data;
    results.S = res.S_data;
    results.Vt = res.Vt_data;
  }

  self.postMessage(results);
};