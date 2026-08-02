/**
 * Unit / interaction tests for the HotspotLayer island (task 9.4).
 *
 * Covers the interactive Hero_Image hotspot behaviors that are exercisable in
 * jsdom:
 *  - Two hotspots render as accessible <button>s with aria-labels and a
 *    >=44x44px minimum activation target (Req 2.1, 2.7).
 *  - Pointer-enter / keyboard focus applies a highlight; pointer-leave / blur
 *    removes it (Req 2.2, 2.3, 2.8).
 *  - Activating the PC hotspot reveals a control that scrolls the
 *    PC_Specs_Section (#pc-specs) into view (Req 2.4, 2.5).
 *  - Activating the soldering hotspot reveals PCB-designing content (Req 2.6).
 *  - Reveal failure (PC target absent) shows an "unavailable" indication while
 *    the hero and remaining hotspots stay interactive (Req 2.9).
 *
 * The Hero_Image load-failure fallback (Req 1.6) lives in an inline Astro
 * client script inside HeroImage.astro. That script drives real image
 * load/error/timeout events against the browser and cannot be meaningfully
 * unit-tested in jsdom; it is covered by the asset-loading e2e suite
 * (task 17.5). See the documented `describe` at the end of this file.
 *
 * A deterministic `box` prop ({width:1000,height:1200}) is passed so hotspots
 * project to stable pixel positions independent of layout.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import HotspotLayer from './HotspotLayer';
import { hotspots as seedHotspots } from '@content/hero';

// Deterministic rendered image box so mapHotspotToViewport is stable.
const BOX = { width: 1000, height: 1200 };

/** Renders a #pc-specs section in the document so the PC hotspot can reveal. */
function mountPcSpecsSection(): HTMLElement {
  const section = document.createElement('section');
  section.id = 'pc-specs';
  section.textContent = 'PC Specs Section';
  document.body.appendChild(section);
  return section;
}

/** Convenience: the rendered hotspot <button> for a given subject. */
function hotspotButton(subject: 'pc' | 'soldering'): HTMLButtonElement {
  const btn = document.querySelector<HTMLButtonElement>(
    `button[data-hotspot-subject="${subject}"]`,
  );
  if (!btn) throw new Error(`no hotspot button for subject "${subject}"`);
  return btn;
}

beforeEach(() => {
  // jsdom does not implement scrollIntoView; provide a spyable stub.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  // Remove any #pc-specs section appended outside the testing-library container.
  document.getElementById('pc-specs')?.remove();
  vi.restoreAllMocks();
});

describe('HotspotLayer rendering (Req 2.1, 2.7)', () => {
  it('renders both hotspots as buttons with aria-labels', () => {
    render(<HotspotLayer box={BOX} />);

    const buttons = screen.getAllByRole('button');
    // Only the two hotspot buttons exist before any activation.
    expect(buttons).toHaveLength(2);

    for (const hotspot of seedHotspots) {
      const btn = screen.getByRole('button', { name: hotspot.label });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('aria-label', hotspot.label);
    }

    // One PC and one soldering hotspot are present.
    expect(hotspotButton('pc')).toBeInTheDocument();
    expect(hotspotButton('soldering')).toBeInTheDocument();
  });

  it('gives every hotspot a >=44x44px minimum activation target', () => {
    render(<HotspotLayer box={BOX} />);

    for (const btn of screen.getAllByRole('button')) {
      expect(btn.style.minWidth).toBe('44px');
      expect(btn.style.minHeight).toBe('44px');
    }
  });
});

describe('HotspotLayer highlight (Req 2.2, 2.3, 2.8)', () => {
  it('applies a highlight on pointer-enter and removes it on pointer-leave', () => {
    render(<HotspotLayer box={BOX} />);
    const btn = hotspotButton('pc');

    fireEvent.pointerEnter(btn);
    expect(btn).toHaveAttribute('data-highlight', 'on');

    fireEvent.pointerLeave(btn);
    expect(btn).toHaveAttribute('data-highlight', 'off');
  });

  it('applies a highlight on keyboard focus and removes it on blur', () => {
    render(<HotspotLayer box={BOX} />);
    const btn = hotspotButton('soldering');

    fireEvent.focus(btn);
    expect(btn).toHaveAttribute('data-highlight', 'on');

    fireEvent.blur(btn);
    expect(btn).toHaveAttribute('data-highlight', 'off');
  });
});

describe('HotspotLayer PC hotspot activation (Req 2.4, 2.5)', () => {
  it('reveals a control that scrolls the PC specs section into view', () => {
    const section = mountPcSpecsSection();
    render(<HotspotLayer box={BOX} />);

    const pcButton = hotspotButton('pc');
    expect(pcButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(pcButton);

    // The related content is revealed inline without navigating away.
    expect(pcButton).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: /details/i });
    const jump = within(panel).getByRole('button', { name: /jump to pc specs/i });
    expect(jump).toBeInTheDocument();

    // Activating the control scrolls the PC_Specs_Section into view.
    fireEvent.click(jump);
    expect(section.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('HotspotLayer soldering hotspot activation (Req 2.6)', () => {
  it('reveals PCB-designing content', () => {
    render(<HotspotLayer box={BOX} />);

    const solderButton = hotspotButton('soldering');
    fireEvent.click(solderButton);

    expect(solderButton).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: /details/i });
    expect(within(panel).getByText(/PCB designing bench/i)).toBeInTheDocument();
    expect(within(panel).getByText(/KiCad/i)).toBeInTheDocument();
  });
});

describe('HotspotLayer reveal-failure handling (Req 2.9)', () => {
  it('shows an "unavailable" indication when the PC target is absent while other hotspots stay interactive', () => {
    // Note: no #pc-specs section mounted, so the PC hotspot cannot reveal.
    render(<HotspotLayer box={BOX} />);

    const pcButton = hotspotButton('pc');
    fireEvent.click(pcButton);

    // The PC hotspot surfaces an unavailable indication and does not expand.
    expect(pcButton).toHaveAttribute('aria-expanded', 'false');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/unavailable/i);

    // No details region was revealed for the PC hotspot.
    expect(screen.queryByRole('region', { name: /details/i })).not.toBeInTheDocument();

    // The remaining (soldering) hotspot stays interactive and reveals its content.
    const solderButton = hotspotButton('soldering');
    fireEvent.click(solderButton);
    expect(solderButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: /details/i })).toBeInTheDocument();
  });
});

describe('HeroImage fallback (Req 1.6)', () => {
  // The 5s load-timeout / onerror fallback is implemented as an inline Astro
  // client script in HeroImage.astro that reacts to real <img> load/error and a
  // window timeout. That DOM/timing behavior is not exercisable via a jsdom
  // unit test and is covered by the asset-loading e2e suite (task 17.5).
  it.skip('is covered by the asset-loading e2e suite (task 17.5)', () => {
    // Intentionally skipped — see comment above.
  });
});
