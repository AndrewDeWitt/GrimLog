'use client';

import GalleryFilterDropdown from './GalleryFilterDropdown';

interface PointsRange {
  min: number;
  max: number;
}

interface PointsRangeDropdownProps {
  value: PointsRange;
  onChange: (range: PointsRange) => void;
  className?: string;
}

const POINTS_RANGES = [
  { label: 'All Points', value: '', min: 0, max: 99999 },
  { label: '1000 pts', value: '1000', min: 0, max: 1000 },
  { label: '1500 pts', value: '1500', min: 0, max: 1500 },
  { label: '2000 pts', value: '2000', min: 0, max: 2000 },
];

/**
 * Dropdown for filtering by predefined points ranges.
 * Wraps GalleryFilterDropdown with points-specific options.
 */
export default function PointsRangeDropdown({
  value,
  onChange,
  className = '',
}: PointsRangeDropdownProps) {
  // Find current selection based on min/max values
  const currentValue = POINTS_RANGES.find(
    r => r.min === value.min && r.max === value.max
  )?.value || '';

  const handleChange = (selectedValue: string | null) => {
    const range = POINTS_RANGES.find(r => r.value === selectedValue) || POINTS_RANGES[0];
    onChange({ min: range.min, max: range.max });
  };

  return (
    <GalleryFilterDropdown
      value={currentValue || null}
      onChange={handleChange}
      options={POINTS_RANGES.map(r => ({
        value: r.value,
        label: r.label,
      }))}
      placeholder="All Points"
      searchable={false}
      className={className}
    />
  );
}
