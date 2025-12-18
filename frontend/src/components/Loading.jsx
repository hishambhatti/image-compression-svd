import React from 'react'

export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f4f3ef] text-gray-700 font-[Red_Hat_Display] z-50">
      <div className="w-10 h-10 border-4 border-[#3498DB] border-t-transparent rounded-full animate-spin mb-4"></div>
      <h1 className="text-2xl font-medium tracking-wide">
        Calculating SVD…
      </h1>
    </div>
  );
}
