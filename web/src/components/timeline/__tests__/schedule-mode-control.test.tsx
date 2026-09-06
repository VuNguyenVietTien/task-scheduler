import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@/i18n/i18n-config';
import { ScheduleModeControl } from '../ScheduleModeControl';
import type { ScheduleDisplayMode } from '@/types/taxonomy';

describe('ScheduleModeControl', () => {
  it('renders both WBS_DETAIL and MASTER_SCHEDULE options', () => {
    const onChange = jest.fn();
    render(<ScheduleModeControl mode="WBS_DETAIL" onModeChange={onChange} />);

    expect(screen.getByRole('button', { name: /wbs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /master/i })).toBeInTheDocument();
  });

  it('marks the active mode with aria-pressed', () => {
    render(<ScheduleModeControl mode="MASTER_SCHEDULE" onModeChange={jest.fn()} />);

    const wbsButton = screen.getByRole('button', { name: /wbs/i });
    const masterButton = screen.getByRole('button', { name: /master/i });
    expect(wbsButton).toHaveAttribute('aria-pressed', 'false');
    expect(masterButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the newly selected mode without mutating anything', () => {
    const onChange = jest.fn();
    const frozenMode: ScheduleDisplayMode = Object.freeze('WBS_DETAIL') as ScheduleDisplayMode;
    render(<ScheduleModeControl mode={frozenMode} onModeChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /master/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('MASTER_SCHEDULE');

    fireEvent.click(screen.getByRole('button', { name: /wbs/i }));
    expect(onChange).toHaveBeenCalledWith('WBS_DETAIL');
  });

  it('exposes an accessible group label', () => {
    render(<ScheduleModeControl mode="WBS_DETAIL" onModeChange={jest.fn()} />);
    expect(screen.getByRole('group', { name: /schedule (view )?mode/i })).toBeInTheDocument();
  });
});
