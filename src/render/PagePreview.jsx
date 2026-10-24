import { memo } from 'react';
import { PT } from '../layout/measure';

/**
 * One page of engine output as SVG in mm units. Every run is placed at the x
 * the engine measured, so the browser never reflows anything — Arial and
 * Helvetica share metrics, which keeps the preview a faithful proxy of the PDF.
 */
function Box({ b }) {
  if (b.t === 'text') {
    return (
      <text
        x={b.x}
        y={b.y}
        fontSize={b.size * PT}
        fontWeight={b.bold ? 700 : 400}
        fontStyle={b.italic ? 'italic' : 'normal'}
        fill={b.color}
        data-bid={b.bid && !b.bid.startsWith('__') ? b.bid : undefined}
      >
        {b.text}
      </text>
    );
  }
  if (b.t === 'line') {
    return <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} stroke={b.color} strokeWidth={b.lw} />;
  }
  if (b.t === 'circle') return <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} />;
  if (b.t === 'tri') return <polygon points={b.pts.map((p) => p.join(',')).join(' ')} fill={b.fill} />;
  if (b.t === 'image') {
    return <image href={b.src} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="none" />;
  }
  if (b.t === 'link') {
    return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" data-page={b.page} className="page-link" />;
  }
  if (b.t === 'rect') {
    return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill || 'none'} stroke={b.stroke || 'none'} strokeWidth={b.lw || 0.3} />;
  }
  return null;
}

export const PagePreview = memo(function PagePreview({ page, w, h, number }) {
  return (
    <svg
      className="page-svg"
      viewBox={`0 0 ${w} ${h}`}
      style={{ aspectRatio: `${w} / ${h}` }}
      role="img"
      aria-label={`Page ${number}`}
    >
      <rect x="0" y="0" width={w} height={h} fill="#fff" />
      {page.boxes.map((b, i) => <Box key={i} b={b} />)}
    </svg>
  );
});
