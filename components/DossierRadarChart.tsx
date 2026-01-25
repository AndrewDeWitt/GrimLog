'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { RadarScores } from '@/lib/dossierAnalysis';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface DossierRadarChartProps {
  scores: RadarScores;
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
  className?: string;
}

export default function DossierRadarChart({
  scores,
  size = 'md',
  showLegend = false,
  className = '',
}: DossierRadarChartProps) {
  const chartRef = useRef<ChartJS<'radar'>>(null);

  // Dimension labels
  const labels = [
    'Killing Power',
    'Durability',
    'Mobility',
    'Board Control',
    'Flexibility',
  ];

  // Data values
  const dataValues = [
    scores.killingPower,
    scores.durability,
    scores.mobility,
    scores.boardControl,
    scores.flexibility,
  ];

  // Chart data
  const data: ChartData<'radar'> = {
    labels,
    datasets: [
      {
        label: 'Army Profile',
        data: dataValues,
        backgroundColor: 'rgba(255, 107, 0, 0.25)', // grimlog-orange with transparency
        borderColor: '#ff6b00', // grimlog-orange
        borderWidth: 2,
        pointBackgroundColor: '#ff6b00',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#d4a04c', // grimlog-amber
        pointHoverBorderColor: '#fff',
      },
    ],
  };

  // Chart options
  const options: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: showLegend,
        position: 'bottom',
        labels: {
          color: '#a8c5a0', // grimlog-green
          font: {
            family: 'Courier New, Consolas, monospace',
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: '#1a1a1a', // grimlog-darkGray
        titleColor: '#ff6b00', // grimlog-orange
        bodyColor: '#a8c5a0', // grimlog-green
        borderColor: '#4a4a4a', // grimlog-steel
        borderWidth: 1,
        padding: 12,
        titleFont: {
          family: 'Courier New, Consolas, monospace',
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          family: 'Courier New, Consolas, monospace',
          size: 12,
        },
        callbacks: {
          label: (context) => {
            const value = context.parsed.r;
            let rating = 'Average';
            if (value >= 80) rating = 'Excellent';
            else if (value >= 60) rating = 'Good';
            else if (value < 40) rating = 'Weak';
            return `${context.label}: ${value}/100 (${rating})`;
          },
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        beginAtZero: true,
        ticks: {
          stepSize: 20,
          display: true,
          color: '#4a4a4a', // grimlog-steel
          backdropColor: 'transparent',
          font: {
            family: 'Courier New, Consolas, monospace',
            size: 10,
          },
        },
        grid: {
          color: 'rgba(74, 74, 74, 0.5)', // grimlog-steel with transparency
          lineWidth: 1,
        },
        angleLines: {
          color: 'rgba(74, 74, 74, 0.5)', // grimlog-steel with transparency
          lineWidth: 1,
        },
        pointLabels: {
          color: '#a8c5a0', // grimlog-green
          font: {
            family: 'Courier New, Consolas, monospace',
            size: size === 'sm' ? 10 : size === 'lg' ? 14 : 12,
            weight: 'bold',
          },
          padding: 8,
        },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-48 h-48',
    md: 'w-72 h-72',
    lg: 'w-96 h-96',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <Radar ref={chartRef} data={data} options={options} />
    </div>
  );
}

/**
 * Static radar chart component for HTML export (uses canvas snapshot)
 * This generates the chart data URL for embedding in static HTML
 */
export function generateRadarChartDataURL(scores: RadarScores): Promise<string> {
  return new Promise((resolve) => {
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // Register Chart.js components if not already
    ChartJS.register(
      RadialLinearScale,
      PointElement,
      LineElement,
      Filler,
      Tooltip,
      Legend
    );

    // Create chart
    const chart = new ChartJS(ctx, {
      type: 'radar',
      data: {
        labels: ['Killing Power', 'Durability', 'Mobility', 'Board Control', 'Flexibility'],
        datasets: [
          {
            label: 'Army Profile',
            data: [
              scores.killingPower,
              scores.durability,
              scores.mobility,
              scores.boardControl,
              scores.flexibility,
            ],
            backgroundColor: 'rgba(255, 107, 0, 0.25)',
            borderColor: '#ff6b00',
            borderWidth: 2,
            pointBackgroundColor: '#ff6b00',
            pointBorderColor: '#fff',
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              color: '#4a4a4a',
              backdropColor: 'transparent',
            },
            grid: { color: 'rgba(74, 74, 74, 0.5)' },
            angleLines: { color: 'rgba(74, 74, 74, 0.5)' },
            pointLabels: {
              color: '#a8c5a0',
              font: { family: 'Courier New', size: 12, weight: 'bold' },
            },
          },
        },
      },
    });

    // Wait for chart to render then get data URL
    setTimeout(() => {
      const dataURL = canvas.toDataURL('image/png');
      chart.destroy();
      resolve(dataURL);
    }, 100);
  });
}

