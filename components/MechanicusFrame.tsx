'use client';

export default function GrimlogFrame() {
  return (
    <>
      {/* Top accent bar - simplified */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-grimlog-orange opacity-75 z-50 pointer-events-none" aria-hidden="true"></div>

      {/* Bottom accent bar */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-grimlog-orange opacity-75 z-50 pointer-events-none" aria-hidden="true"></div>

      {/* Corner brackets - simplified and less prominent */}
      <div className="fixed top-0 left-0 w-8 h-8 md:w-12 md:h-12 border-t-2 border-l-2 border-grimlog-orange opacity-40 z-50 pointer-events-none" aria-hidden="true"></div>
      <div className="fixed top-0 right-0 w-8 h-8 md:w-12 md:h-12 border-t-2 border-r-2 border-grimlog-orange opacity-40 z-50 pointer-events-none" aria-hidden="true"></div>
      <div className="fixed bottom-0 left-0 w-8 h-8 md:w-12 md:h-12 border-b-2 border-l-2 border-grimlog-orange opacity-40 z-50 pointer-events-none" aria-hidden="true"></div>
      <div className="fixed bottom-0 right-0 w-8 h-8 md:w-12 md:h-12 border-b-2 border-r-2 border-grimlog-orange opacity-40 z-50 pointer-events-none" aria-hidden="true"></div>
    </>
  );
}

