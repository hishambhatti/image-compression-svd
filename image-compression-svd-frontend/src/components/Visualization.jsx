import React, { useState, useEffect, useRef, useMemo } from 'react';
import ndarray from 'ndarray';
import gemm from 'ndarray-gemm';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceDot
} from 'recharts';
import circleImg from '../assets/circle.png';
import ellipseImg from '../assets/ellipse.png';

export default function Visualization({ data, onBack }) {
  const [k, setK] = useState(1);
  const [renderK, setRenderK] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef(null);

  const S_vector = data.isColor ? data.S1.data : data.S.data;
  const maxK = S_vector.length;
  const rows = data.isColor ? data.US1.shape[0] : data.US.shape[0];
  const cols = data.isColor ? data.Vt1.shape[1] : data.Vt.shape[1];

  // Calculate total sum once for the Energy Retained stat
  const totalS_Sum = useMemo(() => Array.from(S_vector).reduce((a, b) => a + b, 0), [S_vector]);

  const lastFrameTime = useRef(0);
  const FRAME_INTERVAL = 25; // ms → ~40 FPS

  useEffect(() => {
    let rafId;

    const update = (timestamp) => {
      if (timestamp - lastFrameTime.current >= FRAME_INTERVAL) {
        setRenderK(k);
        lastFrameTime.current = timestamp;
      }
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [k]);

  const chartData = useMemo(() => {
    const EPS = 1e-5;
    let runningSum = 0;

    return Array.from(S_vector).map((val, i) => {
      runningSum += val;
      return {
        index: i + 1,
        renderVal: val > 0 ? val : EPS,
        trueVal: val,
        cumulative: (runningSum / totalS_Sum) * 100
      };
    });
  }, [S_vector, totalS_Sum]);

  const currentPoint = chartData[Math.min(k - 1, chartData.length - 1)];

  // Formatter to handle 0 and 100 specifically
  const tooltipFormatter = (value, name, props) => {
    const displayName = name === "renderVal" ? "Value" : "Cumulative Sum";

    // Logic for specific values
    const actualValue = name === "renderVal" ? props.payload.trueVal : value;

    let displayValue;
    if (actualValue === 0) displayValue = "0";
    else if (actualValue === 100) displayValue = "100";
    else displayValue = actualValue.toFixed(5);

    return [displayValue, displayName];
  };

  const stats = useMemo(() => {
    const m = rows;
    const n = cols;
    const colorMult = data.isColor ? 3 : 1;

    // Parameters Uncompressed: Total pixels
    const paramsUncompressed = m * n * colorMult;

    // Parameters Compressed: k*(m + n + 1) per channel
    const paramsCompressed = k * (m + n + 1) * colorMult;

    // Compression Ratio: Compressed / Uncompressed
    const compressionRatio = paramsCompressed / paramsUncompressed;

    // Space Saved (%)
    const spacedSaved = 100 * (paramsUncompressed - paramsCompressed) / paramsUncompressed

    // MSE Calculation: Sum of squares of omitted singular values / total pixels
    // If color, we average the MSE across the 3 channels
    let sumSquaredOmitted = 0;
    if (data.isColor) {
      const s1 = Array.from(data.S1.data).slice(k);
      const s2 = Array.from(data.S2.data).slice(k);
      const s3 = Array.from(data.S3.data).slice(k);
      sumSquaredOmitted += s1.reduce((acc, val) => acc + (val * val), 0);
      sumSquaredOmitted += s2.reduce((acc, val) => acc + (val * val), 0);
      sumSquaredOmitted += s3.reduce((acc, val) => acc + (val * val), 0);
    } else {
      const s = Array.from(S_vector).slice(k);
      sumSquaredOmitted = s.reduce((acc, val) => acc + (val * val), 0);
    }

    const mse = sumSquaredOmitted / (m * n * colorMult);

    // PSNR Calculation: 10 * log10(Max^2 / MSE)
    // Since pixels are 0-1, Max is 1. We handle the edge case where MSE is 0.
    const psnr = mse > 0 ? 10 * Math.log10(1 / mse) : 100;

    return {
      paramsUncompressed,
      paramsCompressed,
      compressionRatio,
      mse,
      spacedSaved,
      psnr
    };
  }, [k, rows, cols, data, S_vector]);

  const reconstructChannel = (US, Vt, k, m, n) => {
    const result = ndarray(new Float32Array(m * n), [m, n]);

    const US_k = US.hi(m, k);         // m × k
    const Vt_k = ndarray(Vt.data, [Vt.shape[0], n]).hi(k, n); // k × n

    gemm(result, US_k, Vt_k);
    return result.data;
  };

  const renderApproximation = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(cols, rows);

    // Disable browser smoothing for crisp pixels
    ctx.imageSmoothingEnabled = false;

    if (data.isColor) {
      const r = reconstructChannel(data.US1, data.Vt1, renderK, rows, cols);
      const g = reconstructChannel(data.US2, data.Vt2, renderK, rows, cols);
      const b = reconstructChannel(data.US3, data.Vt3, renderK, rows, cols);

      for (let i = 0; i < rows * cols; i++) {
        // Multiply by 255 to move from [0, 1] range to [0, 255]
        imageData.data[i * 4] = r[i] * 255;     // R
        imageData.data[i * 4 + 1] = g[i] * 255; // G
        imageData.data[i * 4 + 2] = b[i] * 255; // B
        imageData.data[i * 4 + 3] = 255;         // Alpha
      }
    } else {
      const gray = reconstructChannel(data.US, data.Vt, renderK, rows, cols);

      // Compute min/max ONCE
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < gray.length; i++) {
        const v = gray[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }

      const range = max - min || 1; // avoid divide-by-zero

      for (let i = 0; i < rows * cols; i++) {
        const v = ((gray[i] - min) / range) * 255;
        imageData.data[i * 4]     = v;
        imageData.data[i * 4 + 1] = v;
        imageData.data[i * 4 + 2] = v;
        imageData.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    if (!isHovered) renderApproximation();
  }, [renderK, isHovered]);

  return (
    <div className='min-h-screen bg-[#f4f3ef] flex flex-col items-center py-6 px-4 font-[lilex]'>
      <header className='w-full flex flex-col items-center text-center mb-2 mt-4 px-4 text-black'>
        <div className='flex items-center justify-center gap-10 w-full'>
          <img src={circleImg} alt="Circle" className="hidden md:block w-24 h-24 object-contain" />
          <div className="flex flex-col items-center shrink-0">
            <h1 className='text-4xl md:text-5xl lg:text-6xl font-light mb-0 font-[Vend_Sans]'>SVD Image Compression</h1>
            <div className='w-12 h-px bg-gray-400 my-4'></div>
          </div>
          <img src={ellipseImg} alt="Ellipse" className="hidden md:block w-24 h-24 object-contain" />
        </div>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 flex flex-col items-center space-y-6">
          <div
            className="relative w-full aspect-square bg-white rounded-xl shadow-inner border border-gray-200 flex items-center justify-center overflow-hidden p-6 cursor-crosshair"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isHovered ? (
              <img src={data.originalPath} alt="Original" className="w-full h-full object-contain" style={{ imageRendering: rows < 100 ? 'pixelated' : 'auto' }} />
            ) : (
              <canvas ref={canvasRef} width={cols} height={rows} className="w-full h-full object-contain" style={{ imageRendering: rows < 100 ? 'pixelated' : 'auto' }} />
            )}
          </div>

          <div className="w-full space-y-2 px-4">
            <div className="flex justify-between text-xs text-gray-500 uppercase tracking-widest font-bold">
              <span>Rank (k): {k}</span>
              <span>Max: {maxK}</span>
            </div>
            <input
              type="range" min="1" max={maxK} value={k}
              onChange={(e) => setK(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-64">
              <p className="text-[10px] uppercase tracking-widest mb-4 text-gray-400 font-bold">Singular Values (Log)</p>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="index" hide />
                  <YAxis scale="log" domain={['auto', 'auto']} hide />
                  <Tooltip formatter={tooltipFormatter} />
                  <Line type="monotone" dataKey="renderVal" stroke="#0ea5e9" dot={false} strokeWidth={2} />
                  {k <= 150 && (
                    <ReferenceDot x={k} y={currentPoint.renderVal} r={5} fill="red" stroke="white" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-64">
              <p className="text-[10px] uppercase tracking-widest mb-4 text-gray-400 font-bold">Cumulative Sum (%)</p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="index" hide />
                  <YAxis domain={[0, 100]} fontSize={10} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="#ecfdf5" />
                  {k <= 150 && (
                    <ReferenceDot x={k} y={currentPoint.cumulative} r={5} fill="red" stroke="white" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Updated Statistics Section: 4 boxes side-by-side */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Parameters (Raw):</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.paramsUncompressed.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Parameters (Comp):</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.paramsCompressed.toLocaleString()}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Compression Ratio:</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.compressionRatio.toFixed(3)}x
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">Space Saved:</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.spacedSaved.toFixed(3)}%
              </p>
            </div>
          </div>

          {/* Row 2: MSE and PSNR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">MSE (Mean Squared Error):</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.mse < 0.00001 ? "0" : stats.mse.toFixed(5)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1 font-bold">PSNR (Peak Signal-to-Noise Ratio):</p>
              <p className="text-2xl font-light text-slate-800">
                {stats.psnr === 100 ? "∞" : `${stats.psnr.toFixed(2)} dB`}
              </p>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <div className="flex flex-1 gap-4">
              <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 px-6 rounded-xl shadow-sm hover:bg-gray-50 transition-colors text-slate-700">
                <i className="fa-solid fa-upload"></i>
                <span className="text-sm font-bold uppercase tracking-wider">Upload</span>
              </button>

              <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 py-3 px-6 rounded-xl shadow-sm hover:bg-gray-50 transition-colors text-slate-700">
                <i className="fa-solid fa-download"></i>
                <span className="text-sm font-bold uppercase tracking-wider">Download</span>
              </button>
            </div>

            <button
              onClick={onBack} // Assuming you pass a function to return home
              className="flex-[1.2] flex items-center justify-center gap-2 bg-slate-800 text-white py-3 px-6 rounded-xl shadow-md hover:bg-slate-900 transition-colors"
            >
              <i className="fa-solid fa-house-chimney text-xs"></i>
              <span className="text-sm font-bold uppercase tracking-wider">Return to Home Screen</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}