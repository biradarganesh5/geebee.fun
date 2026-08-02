/**
 * Focused unit tests for the ImageCompareSlider island.
 *
 * Covers the behaviors that are meaningfully exercisable in jsdom:
 *  - Placeholder-ready: with no images (empty srcs) BOTH layers render a
 *    tasteful placeholder panel showing their respective labels, instead of
 *    broken images.
 *  - Keyboard operation: Left/Right (and Up/Down/Home/End) arrows change the
 *    slider's aria-valuenow, clamped to 0–100.
 *  - Accessibility: the divider exposes role="slider" with aria-label and
 *    aria-valuemin / aria-valuenow / aria-valuemax and is focusable.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import ImageCompareSlider from './ImageCompareSlider';

describe('ImageCompareSlider placeholders (no images)', () => {
  it('renders a placeholder panel with its label for each layer', () => {
    render(
      <ImageCompareSlider beforeLabel="Schematic" afterLabel="Photo" />,
    );

    const placeholders = screen.getAllByTestId('compare-placeholder');
    expect(placeholders).toHaveLength(2);

    // Each placeholder surfaces its own label; no <img> is rendered.
    expect(within(placeholders[0]).getByText('Photo')).toBeInTheDocument();
    expect(within(placeholders[1]).getByText('Schematic')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('uses the default labels when none are provided', () => {
    render(<ImageCompareSlider />);

    const placeholders = screen.getAllByTestId('compare-placeholder');
    expect(placeholders).toHaveLength(2);
    expect(screen.getByText('Schematic')).toBeInTheDocument();
    expect(screen.getByText('Photo')).toBeInTheDocument();
  });
});

describe('ImageCompareSlider accessibility', () => {
  it('exposes a slider role with aria bounds and is focusable', () => {
    render(<ImageCompareSlider />);

    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-label', 'Before and after comparison slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('tabindex', '0');
  });
});

describe('ImageCompareSlider keyboard operation', () => {
  it('decreases and increases aria-valuenow with arrow keys', () => {
    render(<ImageCompareSlider />);
    const slider = screen.getByRole('slider');

    // Starts centered.
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '52');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '48');
  });

  it('clamps to the 0–100 bounds via Home/End', () => {
    render(<ImageCompareSlider />);
    const slider = screen.getByRole('slider');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    // Cannot go below the minimum.
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    // Cannot go above the maximum.
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });
});
