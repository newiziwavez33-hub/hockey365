/**
 * Hockey365 Ice Rink SVG Component
 */

import { el } from '../core/dom.js';

export function createRinkSvg(events = []) {
  // 200 x 85 standard IIHF / NHL rink aspect ratio representation
  const svg = el('svg', {
    className: 'rink-svg',
    viewBox: '0 0 600 300',
    xmlns: 'http://www.w3.org/2000/svg'
  },
    // Ice Surface
    el('rect', { x: '10', y: '10', width: '580', height: '280', rx: '40', ry: '40', fill: '#f2f8fc', stroke: '#204060', 'stroke-width': '4' }),
    // Red Goal Lines
    el('line', { x1: '50', y1: '30', x2: '50', y2: '270', stroke: '#da1e28', 'stroke-width': '2' }),
    el('line', { x1: '550', y1: '30', x2: '550', y2: '270', stroke: '#da1e28', 'stroke-width': '2' }),
    // Blue Lines
    el('line', { x1: '230', y1: '10', x2: '230', y2: '290', stroke: '#0f62fe', 'stroke-width': '4' }),
    el('line', { x1: '370', y1: '10', x2: '370', y2: '290', stroke: '#0f62fe', 'stroke-width': '4' }),
    // Center Red Line
    el('line', { x1: '300', y1: '10', x2: '300', y2: '290', stroke: '#da1e28', 'stroke-width': '4', 'stroke-dasharray': '8,6' }),
    // Center Faceoff Circle & Spot
    el('circle', { cx: '300', cy: '150', r: '45', fill: 'none', stroke: '#0f62fe', 'stroke-width': '2' }),
    el('circle', { cx: '300', cy: '150', r: '4', fill: '#0f62fe' }),
    // End Zone Faceoff Circles (Left & Right)
    el('circle', { cx: '110', cy: '80', r: '45', fill: 'none', stroke: '#da1e28', 'stroke-width': '2' }),
    el('circle', { cx: '110', cy: '80', r: '3', fill: '#da1e28' }),
    el('circle', { cx: '110', cy: '220', r: '45', fill: 'none', stroke: '#da1e28', 'stroke-width': '2' }),
    el('circle', { cx: '110', cy: '220', r: '3', fill: '#da1e28' }),
    el('circle', { cx: '490', cy: '80', r: '45', fill: 'none', stroke: '#da1e28', 'stroke-width': '2' }),
    el('circle', { cx: '490', cy: '80', r: '3', fill: '#da1e28' }),
    el('circle', { cx: '490', cy: '220', r: '45', fill: 'none', stroke: '#da1e28', 'stroke-width': '2' }),
    el('circle', { cx: '490', cy: '220', r: '3', fill: '#da1e28' }),
    // Goalie Creases
    el('path', { d: 'M 50 135 A 15 15 0 0 1 50 165 Z', fill: '#d0e2ff', stroke: '#da1e28', 'stroke-width': '2' }),
    el('path', { d: 'M 550 135 A 15 15 0 0 0 550 165 Z', fill: '#d0e2ff', stroke: '#da1e28', 'stroke-width': '2' })
  );

  return el('div', { className: 'card' },
    el('div', { className: 'card-header' },
      el('h4', { className: 'card-title' }, 'Хоккейная площадка')
    ),
    el('div', { className: 'rink-view-card' }, svg)
  );
}
