import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import CertificationCard from './CertificationCard';

/**
 * Unit / example tests for the CertificationCard island (task 14.2).
 *
 * Covers:
 *  - Renders exactly one image with the provided alt text + a persistent name
 *    caption (Req 7.1, 7.2).
 *  - Hover (pointer-enter) and keyboard focus apply the highlight transform
 *    (data-highlight="on" on the frame); pointer-leave and blur revert it
 *    (data-highlight="off") within the interaction (Req 7.3, 7.4).
 *  - Image-load failure swaps to the fallback showing the cert name +
 *    "Image unavailable" with no <img> / broken-image icon remaining (Req 7.5).
 */

const NAME = 'AWS Certified Solutions Architect – Professional';
const IMAGE_URL = '/certs/aws-sa-pro.avif';
const ALT_TEXT = 'AWS Certified Solutions Architect – Professional badge';

function renderCard(overrides: Partial<React.ComponentProps<typeof CertificationCard>> = {}) {
  return render(
    <CertificationCard name={NAME} imageUrl={IMAGE_URL} altText={ALT_TEXT} {...overrides} />,
  );
}

describe('CertificationCard — image + caption (Req 7.1, 7.2)', () => {
  it('renders exactly one image with the provided alt text', () => {
    renderCard();

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);

    const image = images[0];
    expect(image).toHaveAttribute('alt', ALT_TEXT);
    expect(image).toHaveAttribute('src', IMAGE_URL);
  });

  it('renders a persistent caption naming the certification', () => {
    const { container } = renderCard();

    const caption = container.querySelector('figcaption');
    expect(caption).not.toBeNull();
    expect(caption).toHaveTextContent(NAME);
  });
});

describe('CertificationCard — hover/focus transform + revert (Req 7.3, 7.4)', () => {
  it('applies the highlight on pointer-enter and reverts on pointer-leave', () => {
    renderCard();
    const frame = screen.getByRole('group', { name: NAME });

    // Before interaction the frame is not highlighted.
    expect(frame).not.toHaveAttribute('data-highlight', 'on');

    fireEvent.pointerEnter(frame);
    expect(frame).toHaveAttribute('data-highlight', 'on');

    fireEvent.pointerLeave(frame);
    expect(frame).toHaveAttribute('data-highlight', 'off');
  });

  it('applies the highlight on keyboard focus and reverts on blur', () => {
    renderCard();
    const frame = screen.getByRole('group', { name: NAME });

    // The frame is keyboard-focusable.
    expect(frame).toHaveAttribute('tabindex', '0');

    fireEvent.focus(frame);
    expect(frame).toHaveAttribute('data-highlight', 'on');

    fireEvent.blur(frame);
    expect(frame).toHaveAttribute('data-highlight', 'off');
  });
});

describe('CertificationCard — image-load failure fallback (Req 7.5)', () => {
  it('swaps to a fallback showing the cert name + "Image unavailable" and drops the <img>', () => {
    const { container } = renderCard();

    const image = screen.getByRole('img', { name: ALT_TEXT });
    fireEvent.error(image);

    // No <img> / broken-image icon remains after the failure.
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByAltText(ALT_TEXT)).toBeNull();

    // Fallback identifies the certification and indicates the image is gone.
    const fallback = screen.getByRole('img', { name: `${NAME} — image unavailable` });
    expect(within(fallback).getByText(NAME)).toBeInTheDocument();
    expect(within(fallback).getByText(/image unavailable/i)).toBeInTheDocument();
  });

  it('detects an already-failed image on mount (complete + naturalWidth 0)', () => {
    // Simulate the hydration race: the native error already fired before React
    // could attach onError, so the <img> is `complete` with no pixels. The
    // mount-time check must still surface the Req 7.5 / 10.4 fallback.
    const completeSpy = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(true);
    const naturalWidthSpy = vi
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(0);

    try {
      const { container } = renderCard();

      expect(container.querySelector('img')).toBeNull();
      const fallback = screen.getByRole('img', { name: `${NAME} — image unavailable` });
      expect(within(fallback).getByText(NAME)).toBeInTheDocument();
      expect(within(fallback).getByText(/image unavailable/i)).toBeInTheDocument();
    } finally {
      completeSpy.mockRestore();
      naturalWidthSpy.mockRestore();
    }
  });

  it('keeps the persistent caption visible after image failure', () => {
    const { container } = renderCard();

    fireEvent.error(screen.getByRole('img', { name: ALT_TEXT }));

    const caption = container.querySelector('figcaption');
    expect(caption).toHaveTextContent(NAME);
  });
});
